import { cspPlugin } from '../package.json';
import { useEffect, useRef, useState } from 'react';
import type { BrowserPlugin, BrowserContext, Source } from '@kieksme/csp-sdk';
interface Message {
  role: 'user' | 'assistant';
  content: string;
}
function Chat(ctx: BrowserContext) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [sources, setSources] = useState<Omit<Source, 'text'>[]>([]);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy) return;
    const history = [
      ...messages,
      { role: 'user' as const, content: input.trim() },
    ].slice(-19);
    let bounded = [...history];
    while (
      bounded.reduce((n, m) => n + m.content.length, 0) > 16000 &&
      bounded.length > 1
    )
      bounded = bounded.slice(1);
    setMessages([...history, { role: 'assistant', content: '' }]);
    setInput('');
    setBusy(true);
    setError('');
    setSources([]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const response = await (ctx.request ?? fetch)(
        ctx.config.apiUrl + '/api/v1/chat',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ messages: bounded }),
          signal: controller.signal,
        },
      );
      if (!response.ok || !response.body)
        throw new Error(
          response.status === 429
            ? 'Zu viele Anfragen. Bitte warten Sie eine Minute.'
            : 'Chat derzeit nicht erreichbar.',
        );
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let complete = false;
      try {
        while (true) {
          const { done, value } = await reader.read();
          buffer += decoder.decode(value, { stream: !done });
          let boundary: number;
          while ((boundary = buffer.indexOf('\n\n')) >= 0) {
            const block = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const type = block.match(/^event: (.+)$/m)?.[1];
            const payload = block.match(/^data: (.+)$/m)?.[1];
            if (!payload) continue;
            const event = JSON.parse(payload);
            if (type === 'delta')
              setMessages((previous) => {
                const next = [...previous];
                const last = next.at(-1)!;
                next[next.length - 1] = {
                  ...last,
                  content: last.content + event.text,
                };
                return next;
              });
            if (type === 'sources') setSources(event);
            if (type === 'error') throw new Error(event.message);
            if (type === 'done') complete = true;
          }
          if (done) break;
        }
        if (!complete)
          throw new Error(
            'Die Verbindung wurde unterbrochen. Die Antwort ist unvollständig.',
          );
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
    } catch (err) {
      if (!controller.signal.aborted)
        setError(err instanceof Error ? err.message : 'Chat nicht verfügbar.');
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }
  return (
    <div
      className={
        ctx.surface === 'hero'
          ? 'chat-layout block'
          : 'chat-layout grid grid-cols-[1fr_1.7fr] gap-13.75 compact:grid-cols-[1fr] compact:gap-3.75'
      }
    >
      {ctx.surface !== 'hero' && (
        <div className="chat-intro [&_p]:text-[0.875rem] [&_p]:text-muted [&_p]:leading-[1.8] compact:max-w-[500px]">
          <h3>Eine Frage reicht.</h3>
          <p>
            Unser Assistent kennt die Hilfe-Inhalte, das Team und die aktuellen
            Meldungen. Für dringende Störungen bleibt die Hotline der direkte
            Weg.
          </p>
          <p className="data-state font-mono text-[0.625rem] text-muted m-[calc(var(--spacing)_*_3)_0_0] [&.warning]:text-warning">
            Öffentlicher Chat · Verlauf nur in dieser Sitzung
          </p>
        </div>
      )}
      <div className="chat-panel text-ink compact:p-4 bg-card border border-line p-6 rounded-card">
        <div
          className="chat-history empty:hidden grid gap-3.75 max-h-[400px] overflow-auto mb-4"
          aria-live="polite"
          aria-busy={busy}
        >
          {!messages.length && ctx.surface !== 'hero' && (
            <p className="message assistant text-[0.8125rem] leading-[1.8] whitespace-pre-wrap [overflow-wrap:anywhere] [&.user]:bg-soft [&.user]:pt-3 [&.user]:pb-3 [&.user]:pl-4 [&.user]:pr-4 [&.user]:rounded-card [&.assistant]:[border-left:2px_solid_var(--accent)] [&.assistant]:pt-[0] [&.assistant]:pb-[0] [&.assistant]:pl-4 [&.assistant]:pr-4">
              Wie kann ich Ihnen helfen?
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                'message text-[0.8125rem] leading-[1.8] whitespace-pre-wrap [overflow-wrap:anywhere] [&.user]:bg-soft [&.user]:pt-3 [&.user]:pb-3 [&.user]:pl-4 [&.user]:pr-4 [&.user]:rounded-card [&.assistant]:[border-left:2px_solid_var(--accent)] [&.assistant]:pt-[0] [&.assistant]:pb-[0] [&.assistant]:pl-4 [&.assistant]:pr-4 ' +
                m.role
              }
            >
              <span className="sr-only">
                {m.role === 'user' ? 'Sie: ' : 'Assistent: '}
              </span>
              {m.content || 'Antwort wird vorbereitet …'}
            </div>
          ))}
        </div>
        {sources.length > 0 && (
          <div className="sources text-[0.6875rem] text-muted mt-3.75 mb-3.75 ml-[0] mr-[0] [&_a]:mr-3">
            Referenzquellen:{' '}
            {sources.map((s) =>
              s.href ? (
                <a key={s.id} href={s.href}>
                  {s.title}
                  {s.stale ? ' (veraltet)' : ''}
                </a>
              ) : (
                <span key={s.id}>{s.title} </span>
              ),
            )}
          </div>
        )}
        <form
          className="chat-form flex gap-2.5 items-end [&_textarea]:resize-y [&_textarea]:min-h-[50px] [&_textarea]:[flex:1] [&_textarea]:min-w-0 [&_button]:bg-accent [&_button]:text-accent-ink [&_button]:[border:0] [&_button]:w-[50px] [&_button]:h-[50px] [&_button]:rounded-card [&_button]:text-[1.25rem] [&_button:disabled]:opacity-[0.5]"
          onSubmit={submit}
        >
          <label className="sr-only" htmlFor="chat-input">
            Ihre Frage
          </label>
          <textarea
            id="chat-input"
            className="search bg-card border border-line rounded-card py-3.5 px-4.5 text-ink w-full"
            value={input}
            maxLength={4000}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ihre Frage an unser Team …"
            required
          />
          <button
            type="submit"
            disabled={busy || !input.trim()}
            aria-label="Frage senden"
          >
            ↑
          </button>
        </form>
        {ctx.surface === 'hero' && (
          <p className="data-state font-mono text-[0.625rem] text-muted mt-3 mb-0">
            Digitaler Assistent · Ihre Frage wird automatisch beantwortet. Für
            persönlichen Kontakt nutzen Sie die Hotline.
          </p>
        )}
        {error && (
          <p
            className="chat-error text-danger dark:text-warning text-[0.75rem]"
            role="alert"
          >
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
export default {
  id: 'chat',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'chat',
      placement: 'hero',
      label: 'Assistent',
      title: 'Antworten ohne Warteschleife.',
      order: 60,
      component: Chat,
    },
  ],
} satisfies BrowserPlugin;
