import { emitAnalytics } from '@kieksme/csp-sdk/browser';
import { useEffect, useRef, useState } from 'react';
import type { BrowserContext, ChatResponder } from '@kieksme/csp-sdk';
import { answerParts } from './answer.js';
import { supportSession } from './support-session.js';
import {
  ChatHeading,
  ChatWelcome,
  NewMessages,
  Shortcut,
  sendShortcut,
  useChatScroll,
} from './chat-controls.js';
import { VoiceInput } from './voice-input.js';
type Session = Awaited<ReturnType<typeof supportSession>>;
interface Message {
  id: string;
  kind: 'user' | 'bot' | 'support' | 'system';
  content: string;
  name?: string;
  complete: boolean;
  responder?: ChatResponder;
  sources?: Parameters<typeof answerParts>[1];
}
interface Conversation {
  id: string;
  status: 'bot' | 'waiting' | 'support' | 'closed';
  supportRequest?: { notification: 'pending' | 'sent' | 'failed' };
  support?: { id: string; name: string };
  resolution?: { by: 'visitor' | 'support'; name: string; at: number };
  messages: Message[];
  seq: number;
}
export function SupportChat(ctx: BrowserContext) {
  const [current, setCurrent] = useState<Conversation | null>(null),
    [input, setInput] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [ready, setReady] = useState(false),
    [auth, setAuth] = useState<Session | null>(null);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const scroll = useChatScroll(current?.messages, current?.id);
  const seenResolutions = useRef(new Set<string>());
  const seenReplies = useRef(new Set<string>());
  const chatMode = ctx.config.chatSupport?.mode ?? 'bot';
  useEffect(() => {
    for (const message of current?.messages ?? []) {
      if (
        message.complete &&
        ['bot', 'support'].includes(message.kind) &&
        !seenReplies.current.has(message.id)
      ) {
        seenReplies.current.add(message.id);
        emitAnalytics('CHAT_REPLY_RECEIVED', { chatMode });
      }
    }
  }, [current?.messages, chatMode]);
  useEffect(() => {
    if (current?.resolution && !seenResolutions.current.has(current.id)) {
      seenResolutions.current.add(current.id);
      emitAnalytics('CONVERSATION_RESOLVED', { chatMode });
    }
  }, [current?.resolution, current?.id, chatMode]);
  const sending = useRef(false);
  const blocked =
    busy ||
    voiceBusy ||
    !ready ||
    current?.status === 'closed' ||
    !!current?.messages.some((m) => !m.complete);
  const seq = useRef(0),
    requestRef =
      useRef<(path: string, init?: RequestInit) => Promise<Response>>(null);
  const anonymous = ctx.config.chatSupport?.auth === 'anonymous';
  const demo = ctx.config.chatSupport?.mode === 'demo';
  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    async function init() {
      try {
        const identity = await supportSession(ctx);
        if (!alive) return;
        setAuth(identity);
        const request = async (path: string, init: RequestInit = {}) => {
          const token = await identity.token();
          const response = await (ctx.request ?? fetch)(
            ctx.config.apiUrl + '/api/v1/conversations' + path,
            {
              ...init,
              credentials: 'same-origin',
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
          for (const m of latest.messages)
            if (m.complete) seenReplies.current.add(m.id);
          if (latest.resolution) seenResolutions.current.add(latest.id);
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
    scroll.follow();
    seq.current = c.seq;
    setCurrent(c);
    return c;
  }
  // Keep one request id across retries so a lost HTTP acknowledgement cannot duplicate a question.
  const pending = useRef<{ id: string; content: string } | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || blocked || sending.current) return;
    sending.current = true;
    scroll.follow();
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
      emitAnalytics('CHAT_MESSAGE_SENT', { chatMode });
      pending.current = null;
      setInput('');
      const refreshed: Conversation = await (
        await requestRef.current!(`/${c.id}`)
      ).json();
      applySnapshot(refreshed);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nachricht nicht gesendet.');
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  function applySnapshot(result: Conversation) {
    setCurrent((previous) =>
      previous?.id === result.id && previous.seq > result.seq
        ? previous
        : result,
    );
  }
  async function requestHuman() {
    if (busy || !ready || sending.current) return;
    sending.current = true;
    setBusy(true);
    setError('');
    try {
      const c = current ?? (await newConversation());
      const result: Conversation = await (
        await requestRef.current!(`/${c.id}/request-support`, {
          method: 'POST',
          body: '{}',
        })
      ).json();
      applySnapshot(result);
      if (['waiting', 'support'].includes(result.status))
        emitAnalytics('HUMAN_SUPPORT_REQUESTED', { chatMode });
      scroll.follow();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : 'Support konnte nicht angefragt werden.',
      );
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  async function resolve() {
    if (!current || busy) return;
    setBusy(true);
    setError('');
    try {
      const result: Conversation = await (
        await requestRef.current!(`/${current.id}/resolve`, {
          method: 'POST',
          body: '{}',
        })
      ).json();
      applySnapshot(result);
      pending.current = null;
      setInput('');
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : 'Problem konnte nicht als gelöst markiert werden.',
      );
    } finally {
      sending.current = false;
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
      <ChatHeading
        headingLevel={ctx.surface === 'hero' ? 2 : 3}
        state={current?.status ?? 'bot'}
        notice={
          demo
            ? 'Synthetische Demo · keine Weiterleitung an den Support.'
            : `Nachrichten werden mit dem Support in ${ctx.config.chatSupport?.mode === 'slack' ? 'Slack' : ctx.config.chatSupport?.mode === 'telegram' ? 'Telegram' : 'Microsoft Teams'} geteilt.`
        }
        status={
          <>
            {current?.status === 'support'
              ? `${current.support?.name} · Support`
              : current?.status === 'waiting'
                ? current.supportRequest?.notification === 'sent'
                  ? 'Support-Team informiert · KI pausiert'
                  : current.supportRequest?.notification === 'failed'
                    ? 'Zustellung verzögert · erneuter Versuch läuft · KI pausiert'
                    : 'Persönlicher Support angefragt · KI pausiert'
                : current?.status === 'closed'
                  ? current.resolution
                    ? 'Problem gelöst'
                    : 'Gespräch abgeschlossen'
                  : 'Digitaler Assistent'}
            {auth && ready && !demo
              ? anonymous
                ? ` · ${auth.name}`
                : ` · Angemeldet als ${auth.name}`
              : ''}
          </>
        }
      />
      {!current?.messages.length && <ChatWelcome />}
      <div
        ref={scroll.history}
        onScroll={scroll.onScroll}
        tabIndex={0}
        role="log"
        className="chat-history grid gap-3 max-h-[min(400px,45dvh)] overflow-auto overscroll-contain mb-4"
        aria-live="polite"
        aria-label="Gesprächsverlauf"
      >
        {current?.messages.map((m) => (
          <div
            key={m.id}
            className={`message ${m.kind === 'user' ? 'user' : m.kind === 'system' ? 'system' : m.kind === 'support' ? 'assistant human' : 'assistant'} text-[0.8125rem] whitespace-pre-wrap [overflow-wrap:anywhere]`}
          >
            <span className="chat-author">
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
      <NewMessages visible={scroll.unread} follow={scroll.follow} />
      {!ready && (
        <button
          type="button"
          className="bg-accent text-accent-ink rounded-card px-4 py-2"
          disabled={!auth}
          onClick={() =>
            void auth
              ?.login()
              .catch(() =>
                setError(
                  anonymous
                    ? 'Chat konnte nicht neu verbunden werden.'
                    : 'Microsoft-Anmeldung konnte nicht gestartet werden.',
                ),
              )
          }
        >
          {anonymous
            ? 'Chat neu verbinden'
            : ctx.config.chatSupport?.auth === 'session'
              ? 'Portal-Anmeldung erneuern'
              : 'Mit Microsoft anmelden'}
        </button>
      )}
      {ready && (
        <div className="chat-composer">
          <VoiceInput
            ctx={ctx}
            value={input}
            setValue={setInput}
            disabled={current?.status === 'closed'}
            token={auth?.token}
            onBusy={setVoiceBusy}
          >
            {(controls, details) => (
              <>
                <form
                  onSubmit={submit}
                  className="chat-form flex gap-2.5 items-end"
                >
                  <label htmlFor="support-chat-input" className="sr-only">
                    Ihre Nachricht
                  </label>
                  <div className="chat-compose-field">
                    <textarea
                      id="support-chat-input"
                      value={input}
                      rows={1}
                      maxLength={4000}
                      disabled={current?.status === 'closed'}
                      className="flex-1 min-w-0 max-h-[180px] overflow-auto resize-none border border-line rounded-card bg-card p-3"
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) =>
                        sendShortcut(e, blocked || !input.trim())
                      }
                      aria-keyshortcuts="Control+Enter Meta+Enter"
                      aria-describedby="support-chat-shortcut"
                      placeholder="Wie können wir Ihnen helfen?"
                    />
                    <Shortcut id="support-chat-shortcut" />
                  </div>
                  <div className="chat-compose-toolbar">
                    <div className="chat-compose-actions">
                      {controls}
                      <button
                        type="submit"
                        className="chat-send"
                        disabled={blocked || !input.trim()}
                      >
                        Senden
                      </button>
                    </div>
                  </div>
                </form>

                {details}
              </>
            )}
          </VoiceInput>
        </div>
      )}
      {ready && (!current || current.status === 'bot') && (
        <button
          type="button"
          className="chat-action chat-human-request"
          disabled={busy}
          onClick={() => void requestHuman()}
        >
          <span aria-hidden="true" className="chat-action-icon">
            ↗
          </span>
          Ich möchte mit einer echten Person sprechen
        </button>
      )}
      {ready &&
        current &&
        current.status !== 'closed' &&
        current.messages.some((m) => m.kind === 'user') && (
          <button
            type="button"
            className="chat-action"
            disabled={busy}
            onClick={() => void resolve()}
          >
            Problem gelöst
          </button>
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
          {current.status === 'bot' || current.status === 'waiting' ? (
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
                setError(
                  anonymous
                    ? 'Chat konnte nicht neu verbunden werden.'
                    : 'Microsoft-Anmeldung konnte nicht gestartet werden.',
                ),
              )
          }
        >
          {anonymous
            ? 'Chat neu verbinden'
            : ctx.config.chatSupport?.auth === 'session'
              ? 'Portal-Anmeldung erneuern'
              : 'Microsoft-Anmeldung erneuern'}
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
