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
      const response = await fetch(ctx.config.apiUrl + '/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: bounded }),
        signal: controller.signal,
      });
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
    <div className="chat-layout">
      <div className="chat-intro">
        <h3>Eine Frage reicht.</h3>
        <p>
          Unser Assistent kennt die Hilfe-Inhalte, das Team und die aktuellen
          Meldungen. Für dringende Störungen bleibt die Hotline der direkte Weg.
        </p>
        <p className="data-state">
          Öffentlicher Chat · Verlauf nur in dieser Sitzung
        </p>
      </div>
      <div className="chat-panel">
        <div className="chat-history" aria-live="polite" aria-busy={busy}>
          {!messages.length && (
            <p className="message assistant">Wie kann ich Ihnen helfen?</p>
          )}
          {messages.map((m, i) => (
            <div key={i} className={'message ' + m.role}>
              <span className="sr-only">
                {m.role === 'user' ? 'Sie: ' : 'Assistent: '}
              </span>
              {m.content || 'Antwort wird vorbereitet …'}
            </div>
          ))}
        </div>
        {sources.length > 0 && (
          <div className="sources">
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
        <form className="chat-form" onSubmit={submit}>
          <label className="sr-only" htmlFor="chat-input">
            Ihre Frage
          </label>
          <textarea
            id="chat-input"
            className="search"
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
        {error && (
          <p className="chat-error" role="alert">
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
      label: 'Assistent',
      title: 'Antworten ohne Warteschleife.',
      order: 60,
      component: Chat,
    },
  ],
} satisfies BrowserPlugin;
