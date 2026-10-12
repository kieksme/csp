import { cspPlugin } from '../package.json';
import { chatTools } from './tools.js';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type {
  BrowserPlugin,
  BrowserContext,
  Source,
  ChatResponder,
} from '@kieksme/csp-sdk';
import { answerParts, sourceHref } from './answer.js';
import { SupportChat } from './support-chat.js';
import {
  ChatHeading,
  ChatWelcome,
  NewMessages,
  Shortcut,
  sendShortcut,
  useChatScroll,
} from './chat-controls.js';
import { VoiceInput } from './voice-input.js';
interface Message {
  role: 'user' | 'assistant';
  content: string;
  responder?: ChatResponder;
  sources?: Omit<Source, 'text'>[];
  complete?: boolean;
}
function resizeInput(field: HTMLTextAreaElement | null) {
  if (!field) return;
  field.style.height = 'auto';
  field.style.height = `${field.scrollHeight + field.offsetHeight - field.clientHeight}px`;
}
function Chat(ctx: BrowserContext) {
  return ctx.config.chatSupport ? (
    <SupportChat {...ctx} />
  ) : (
    <LegacyChat {...ctx} />
  );
}
function LegacyChat(ctx: BrowserContext) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [resolved, setResolved] = useState(false);
  const inputField = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => resizeInput(inputField.current), [input]);
  useEffect(() => {
    const field = inputField.current;
    if (!field) return;
    let width = field.clientWidth;
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth;
        resizeInput(field);
      }
    });
    observer.observe(field);
    return () => observer.disconnect();
  }, []);
  const [busy, setBusy] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const scroll = useChatScroll(messages);
  const sending = useRef(false);
  const [error, setError] = useState('');
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!input.trim() || busy || voiceBusy || resolved || sending.current)
      return;
    sending.current = true;
    scroll.follow();
    const history = [
      ...messages.map(({ role, content }) => ({ role, content })),
      { role: 'user' as const, content: input.trim() },
    ].slice(-19);
    let bounded = [...history];
    while (
      bounded.reduce((n, m) => n + m.content.length, 0) > 16000 &&
      bounded.length > 1
    )
      bounded = bounded.slice(1);
    setMessages([
      ...messages,
      { role: 'user', content: input.trim() },
      { role: 'assistant', content: '', sources: [], complete: false },
    ]);
    setInput('');
    setBusy(true);
    setError('');
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
          if (controller.signal.aborted) break;
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
            if (type === 'sources' || type === 'responder' || type === 'done')
              setMessages((previous) =>
                previous.map((message, index) =>
                  index === previous.length - 1
                    ? {
                        ...message,
                        ...(type === 'sources'
                          ? { sources: event }
                          : type === 'responder'
                            ? { responder: event }
                            : { complete: true }),
                      }
                    : message,
                ),
              );
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
      sending.current = false;
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
        <ChatHeading
          headingLevel={ctx.surface === 'hero' ? 2 : 3}
          state={resolved ? 'closed' : 'bot'}
          status={resolved ? 'Problem gelöst' : 'Digitaler Assistent'}
          notice="Ihre Frage wird automatisch beantwortet. Persönlichen Kontakt finden Sie über die Hotline."
        />
        {!messages.length && <ChatWelcome />}
        <div
          ref={scroll.history}
          onScroll={scroll.onScroll}
          tabIndex={0}
          role="log"
          className="chat-history empty:hidden grid gap-3.75 max-h-[min(400px,45dvh)] overflow-auto overscroll-contain mb-4"
          aria-label="Gesprächsverlauf"
          aria-live="polite"
          aria-busy={busy}
        >
          {messages.map((m, i) => (
            <div key={i} className={'message ' + m.role}>
              {m.role === 'user' ? (
                <span className="chat-author">Sie</span>
              ) : (
                <span className="chat-author">
                  {m.responder?.role === 'on-duty' && m.responder.name
                    ? `Digitaler Assistent von ${m.responder.name}`
                    : 'Digitaler Assistent des Service-Teams'}
                </span>
              )}
              {m.role === 'user'
                ? m.content
                : m.content
                  ? answerParts(m.content, m.sources ?? [], !m.complete).map(
                      (part, index) =>
                        part.href ? (
                          <a key={index} href={part.href}>
                            {part.text}
                          </a>
                        ) : (
                          <span key={index}>{part.text}</span>
                        ),
                    )
                  : 'Antwort wird vorbereitet …'}
              {m.role === 'assistant' && !!m.sources?.length && (
                <div className="sources text-[0.6875rem] text-muted mt-3 mb-1 [&_a]:mr-3">
                  Referenzquellen:{' '}
                  {m.sources.map((source) =>
                    sourceHref(source.href) ? (
                      <a key={source.id} href={sourceHref(source.href)}>
                        {source.title}
                        {source.stale ? ' (veraltet)' : ''}
                      </a>
                    ) : (
                      <span key={source.id}>{source.title} </span>
                    ),
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <NewMessages visible={scroll.unread} follow={scroll.follow} />
        <div className="chat-composer">
          <VoiceInput
            ctx={ctx}
            value={input}
            setValue={setInput}
            disabled={resolved}
            onBusy={setVoiceBusy}
          >
            {(controls, details) => (
              <>
                <form
                  className="chat-form flex gap-2.5 items-end"
                  onSubmit={submit}
                >
                  <label className="sr-only" htmlFor="chat-input">
                    Ihre Frage
                  </label>
                  <textarea
                    id="chat-input"
                    ref={inputField}
                    rows={1}
                    autoFocus
                    className="search bg-card border border-line rounded-card pt-3.5 pb-7 px-4.5 text-ink w-full block max-h-[180px] overflow-auto"
                    value={input}
                    disabled={resolved}
                    maxLength={4000}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) =>
                      sendShortcut(
                        e,
                        busy || voiceBusy || resolved || !input.trim(),
                      )
                    }
                    aria-keyshortcuts="Control+Enter Meta+Enter"
                    aria-describedby="chat-shortcut"
                    placeholder="Ihre Frage an unser Team …"
                    required
                  />

                  <div className="chat-compose-toolbar">
                    <Shortcut id="chat-shortcut" />
                    <div className="chat-compose-actions">
                      {controls}
                      <button
                        type="submit"
                        disabled={
                          busy || voiceBusy || resolved || !input.trim()
                        }
                        className="chat-send"
                        aria-label="Frage senden"
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
        {messages.length > 0 && !resolved && (
          <button
            type="button"
            className="chat-action"
            onClick={() => {
              abort.current?.abort();
              setResolved(true);
              setError('');
              setInput('');
              setMessages((previous) =>
                previous.map((m) =>
                  m.complete === false
                    ? {
                        ...m,
                        complete: true,
                        content: m.content + '\n(Antwort unterbrochen)',
                      }
                    : m,
                ),
              );
            }}
          >
            Problem gelöst
          </button>
        )}
        {resolved && (
          <div className="mt-3">
            <button
              type="button"
              className="underline mt-2"
              disabled={busy}
              onClick={() => {
                scroll.follow();
                setMessages([]);
                setResolved(false);
                setInput('');
                setError('');
              }}
            >
              Neuen Chat starten
            </button>
          </div>
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
  tools: chatTools,
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
