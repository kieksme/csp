import { useEffect, useRef, useState } from 'react';
import type { BrowserContext } from '@kieksme/csp-sdk';
import { answerParts } from './answer.js';
interface Message {
  id: string;
  kind: 'user' | 'bot' | 'support' | 'system';
  content: string;
  name?: string;
  complete: boolean;
  responder?: { name: string | null };
  sources?: Parameters<typeof answerParts>[1];
}
interface Conversation {
  id: string;
  status: 'bot' | 'support' | 'closed';
  support?: { id: string; name: string };
  messages: Message[];
  seq: number;
}
interface Session {
  token(): Promise<string>;
  login(): Promise<void>;
  name: string;
}
async function session(ctx: BrowserContext): Promise<Session> {
  const c = ctx.config.chatSupport!;
  if (c.mode === 'demo')
    return {
      token: async () => '',
      login: async () => {},
      name: 'Portal-Nutzer Demo',
    };
  const { PublicClientApplication } = await import('@azure/msal-browser');
  const client = new PublicClientApplication({
    auth: {
      clientId: c.clientId!,
      authority: `https://login.microsoftonline.com/${c.tenantId}`,
      redirectUri: window.location.origin + ctx.config.basePath,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await client.initialize();
  const redirected = await client.handleRedirectPromise();
  const account =
    redirected?.account ??
    client.getAllAccounts().find((a) => a.tenantId === c.tenantId);
  return {
    name: account?.name ?? 'Microsoft-Konto',
    async token() {
      if (!account) throw new Error('Bitte mit Microsoft anmelden.');
      return (await client.acquireTokenSilent({ account, scopes: [c.scope!] }))
        .accessToken;
    },
    async login() {
      await client.acquireTokenRedirect({ scopes: [c.scope!], account });
    },
  };
}
export function SupportChat(ctx: BrowserContext) {
  const [current, setCurrent] = useState<Conversation | null>(null),
    [input, setInput] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [auth, setAuth] = useState<Session | null>(null);
  const seq = useRef(0),
    requestRef =
      useRef<(path: string, init?: RequestInit) => Promise<Response>>(null);
  const demo = ctx.config.chatSupport?.mode === 'demo';
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function init() {
      try {
        const identity = await session(ctx);
        if (!alive) return;
        setAuth(identity);
        const request = async (path: string, init: RequestInit = {}) => {
          const token = await identity.token();
          const response = await (ctx.request ?? fetch)(
            ctx.config.apiUrl + '/api/v1/conversations' + path,
            {
              ...init,
              headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
                ...(init.body !== undefined
                  ? { 'Content-Type': 'application/json' }
                  : {}),
                ...init.headers,
              },
            },
          );
          if (!response.ok) {
            let message = 'Verbindung derzeit nicht verfügbar.';
            try {
              message = (await response.json()).error ?? message;
            } catch {}
            throw new Error(message);
          }
          return response;
        };
        requestRef.current = request;
        const list: Conversation[] = await (
          await request('', { signal: controller.signal })
        ).json();
        if (!alive) return;
        const latest = list[0];
        if (latest) {
          seq.current = latest.seq;
          setCurrent(latest);
        }
        setReady(true);
      } catch (e) {
        if (alive)
          setError(
            e instanceof Error ? e.message : 'Anmeldung nicht verfügbar.',
          );
      }
    }
    void init();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [ctx.config.apiUrl]);
  useEffect(() => {
    if (!current?.id || !ready) return;
    let alive = true;
    const controller = new AbortController();
    let retry: ReturnType<typeof setTimeout>;
    async function connect() {
      try {
        const response = await requestRef.current!(
          `/${current!.id}/events?after=${seq.current}`,
          { signal: controller.signal },
        );
        if (alive) setError('');
        const reader = response.body!.getReader(),
          decoder = new TextDecoder();
        let buffer = '';
        while (alive) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const data = block.match(/^data: (.+)$/m)?.[1],
              event = block.match(/^event: (.+)$/m)?.[1],
              eventSeq = Number(block.match(/^id: (\d+)$/m)?.[1]);
            if (!data || !alive || eventSeq <= seq.current) continue;
            const parsed = JSON.parse(data);
            seq.current = eventSeq;
            setCurrent((previous) => {
              if (!previous || previous.id !== current!.id) return previous;
              if (event === 'snapshot') return parsed;
              if (event === 'status')
                return { ...previous, ...parsed, seq: eventSeq };
              const index = previous.messages.findIndex(
                  (m) => m.id === parsed.id,
                ),
                messages = [...previous.messages];
              if (index >= 0) messages[index] = parsed;
              else messages.push(parsed);
              return { ...previous, messages, seq: eventSeq };
            });
          }
        }
        if (alive) {
          setError('Verbindung wird wiederhergestellt …');
          retry = setTimeout(() => void connect(), 1000);
        }
      } catch (e) {
        if (alive) {
          setError(e instanceof Error ? e.message : 'Verbindung unterbrochen.');
          retry = setTimeout(() => void connect(), 3000);
        }
      }
    }
    void connect();
    return () => {
      alive = false;
      controller.abort();
      clearTimeout(retry);
    };
  }, [current?.id, ready]);
  async function newConversation() {
    const c: Conversation = await (
      await requestRef.current!('', { method: 'POST' })
    ).json();
    seq.current = c.seq;
    setCurrent(c);
    return c;
  }
  // Keep one request id across retries so a lost HTTP acknowledgement cannot duplicate a question.
  const pending = useRef<{ id: string; content: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy || !ready) return;
    setBusy(true);
    setError('');
    try {
      const c = current ?? (await newConversation());
      if (pending.current?.content !== input.trim())
        pending.current = { id: crypto.randomUUID(), content: input.trim() };
      await requestRef.current!(`/${c.id}/messages`, {
        method: 'POST',
        body: JSON.stringify(pending.current),
      });
      pending.current = null;
      setInput('');
      const refreshed: Conversation = await (
        await requestRef.current!(`/${c.id}`)
      ).json();
      setCurrent(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nachricht nicht gesendet.');
    } finally {
      setBusy(false);
    }
  }
  async function simulate(action: string) {
    if (!current) return;
    try {
      await requestRef.current!(`/${current.id}/demo`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      setCurrent(await (await requestRef.current!(`/${current.id}`)).json());
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Aktion fehlgeschlagen.');
    }
  }
  return (
    <div className="chat-panel support-chat text-ink bg-card border border-line p-6 rounded-card compact:p-4">
      <p className="text-[0.75rem] text-ink mb-3">
        {demo
          ? 'Synthetische Support-Demo. Keine Übertragung an Teams.'
          : 'Ihre Nachrichten und die Antworten werden an den Thinkport-Support in Microsoft Teams weitergegeben.'}
      </p>
      <p role="status" className="text-[0.8125rem] mb-3">
        {current?.status === 'support'
          ? `${current.support?.name} · Support`
          : current?.status === 'closed'
            ? 'Gespräch abgeschlossen'
            : 'Digitaler Assistent'}
        {auth && ready && !demo ? ` · Angemeldet als ${auth.name}` : ''}
      </p>
      <div
        className="chat-history grid gap-3 max-h-[400px] overflow-auto mb-4"
        aria-live="polite"
        aria-label="Gesprächsverlauf"
      >
        {current?.messages.map((m) => (
          <div
            key={m.id}
            className={`message ${m.kind === 'user' ? 'user bg-soft p-3 rounded-card' : 'assistant border-l-2 border-accent pl-4'} text-[0.8125rem] whitespace-pre-wrap [overflow-wrap:anywhere]`}
          >
            <span className="block text-[0.6875rem] text-ink mb-1">
              {m.kind === 'user'
                ? 'Sie'
                : m.kind === 'support'
                  ? `${m.name} · Support`
                  : m.kind === 'bot'
                    ? m.responder?.role === 'on-duty' && m.responder.name
                      ? `Digitaler Assistent von ${m.responder.name}`
                      : 'Digitaler Assistent des Service-Teams'
                    : 'Gespräch'}
            </span>
            {m.kind === 'bot'
              ? answerParts(m.content, m.sources ?? [], !m.complete).map(
                  (part, i) =>
                    part.href ? (
                      <a
                        key={i}
                        href={part.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline"
                      >
                        {part.text}
                      </a>
                    ) : (
                      part.text
                    ),
                )
              : m.content}
            {!m.complete && !m.content && <span>Antwort wird erstellt …</span>}
          </div>
        ))}
      </div>
      {!ready && (
        <button
          type="button"
          className="bg-accent text-accent-ink rounded-card px-4 py-2"
          disabled={!auth}
          onClick={() =>
            void auth
              ?.login()
              .catch(() =>
                setError('Microsoft-Anmeldung konnte nicht gestartet werden.'),
              )
          }
        >
          Mit Microsoft anmelden
        </button>
      )}
      {ready && (
        <form onSubmit={submit} className="chat-form flex gap-2.5 items-end">
          <label htmlFor="support-chat-input" className="sr-only">
            Ihre Nachricht
          </label>
          <textarea
            id="support-chat-input"
            value={input}
            rows={2}
            maxLength={4000}
            disabled={current?.status === 'closed'}
            className="flex-1 min-w-0 border border-line rounded-card bg-card p-3"
            onChange={(e) => setInput(e.target.value)}
            placeholder="Wie können wir Ihnen helfen?"
          />
          <button
            type="submit"
            className="bg-accent text-accent-ink rounded-card p-3"
            disabled={
              busy ||
              !input.trim() ||
              current?.status === 'closed' ||
              !!current?.messages.some((m) => !m.complete)
            }
          >
            Senden
          </button>
        </form>
      )}
      {ready && current?.status === 'closed' && (
        <button
          type="button"
          className="underline mt-3"
          onClick={() =>
            void newConversation().catch((e) => setError(e.message))
          }
        >
          Neuen Chat starten
        </button>
      )}
      {demo && current && (
        <div
          className="flex flex-wrap gap-3 mt-3 text-[0.75rem]"
          aria-label="Support-Demo-Steuerung"
        >
          {current.status === 'bot' ? (
            <button
              type="button"
              className="underline"
              onClick={() => void simulate('take')}
            >
              Lena übernimmt
            </button>
          ) : current.status === 'support' ? (
            <>
              <button
                type="button"
                className="underline"
                onClick={() => void simulate('reply')}
              >
                Lena antwortet
              </button>
              <button
                type="button"
                className="underline"
                onClick={() => void simulate('release')}
              >
                Bot freigeben
              </button>
              <button
                type="button"
                className="underline"
                onClick={() => void simulate('close')}
              >
                Abschließen
              </button>
            </>
          ) : null}
        </div>
      )}
      {error && !demo && auth && ready && (
        <button
          type="button"
          className="underline mt-3"
          onClick={() =>
            void auth
              .login()
              .catch(() =>
                setError('Microsoft-Anmeldung konnte nicht gestartet werden.'),
              )
          }
        >
          Microsoft-Anmeldung erneuern
        </button>
      )}
      {error && (
        <p role="alert" className="text-danger text-[0.75rem] mt-3">
          {error}
        </p>
      )}
    </div>
  );
}
