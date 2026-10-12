import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
export function sendShortcut(
  event: KeyboardEvent<HTMLTextAreaElement>,
  disabled: boolean,
) {
  if (
    event.key !== 'Enter' ||
    !(event.ctrlKey || event.metaKey) ||
    event.nativeEvent.isComposing ||
    event.repeat
  )
    return;
  event.preventDefault();
  if (!disabled) event.currentTarget.form?.requestSubmit();
}
export function Shortcut({ id }: { id: string }) {
  const [mac, setMac] = useState(false);
  useEffect(() => setMac(/Mac|iPhone|iPad/.test(navigator.platform)), []);
  return (
    <span id={id} className="chat-shortcut">
      {mac ? '⌘' : 'Strg'} Enter zum Senden
    </span>
  );
}
export function useChatScroll(content: unknown, conversation?: string) {
  const history = useRef<HTMLDivElement>(null),
    pinned = useRef(true);
  const [unread, setUnread] = useState(false);
  const follow = () => {
    pinned.current = true;
    setUnread(false);
    const element = history.current;
    if (element) element.scrollTop = element.scrollHeight;
  };
  useLayoutEffect(follow, [conversation]);
  useLayoutEffect(() => {
    if (pinned.current) follow();
    else setUnread(true);
  }, [content]);
  useEffect(() => {
    const element = history.current;
    if (!element) return;
    const observer = new ResizeObserver(() => {
      if (pinned.current) follow();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return {
    history,
    follow,
    unread,
    onScroll: () => {
      const element = history.current;
      if (!element) return;
      pinned.current =
        element.scrollHeight - element.scrollTop - element.clientHeight < 80;
      if (pinned.current) setUnread(false);
    },
  };
}
export function NewMessages({
  visible,
  follow,
}: {
  visible: boolean;
  follow: () => void;
}) {
  return visible ? (
    <button type="button" className="chat-new-messages" onClick={follow}>
      Neue Nachrichten ↓
    </button>
  ) : null;
}

export function ChatHeading({
  status,
  state = 'bot',
  notice,
  headingLevel = 2,
}: {
  status: ReactNode;
  state?: string;
  notice?: string;
  headingLevel?: 2 | 3;
}) {
  const Heading = headingLevel === 2 ? 'h2' : 'h3';
  return (
    <header className="chat-heading" data-state={state}>
      <span className="chat-emblem" aria-hidden="true">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
        >
          <path d="M5 10a7 7 0 0 1 14 0v6a3 3 0 0 1-3 3h-4" />
          <rect x="3" y="10" width="4" height="7" rx="2" />
          <rect x="17" y="10" width="4" height="7" rx="2" />
          <path d="M10 19h3" />
        </svg>
      </span>
      <div className="chat-heading-copy">
        <Heading>Service-Chat</Heading>
        <p className="chat-status" role="status">
          <span className="chat-status-dot" aria-hidden="true" />
          {status}
        </p>
        {notice && <p className="chat-notice">{notice}</p>}
      </div>
    </header>
  );
}
export function ChatWelcome() {
  return (
    <div className="chat-welcome">
      <p className="chat-welcome-title">Was können wir für Sie tun?</p>
      <p>
        Beschreiben Sie kurz Ihr Anliegen. Wir helfen Ihnen Schritt für Schritt
        weiter.
      </p>
    </div>
  );
}
