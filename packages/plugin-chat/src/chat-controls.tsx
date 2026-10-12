import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
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
    <span id={id} className="block text-[0.6875rem] text-muted mt-2">
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
    <button
      type="button"
      className="border border-line rounded-card px-3 py-2 mb-3 text-[0.8125rem]"
      onClick={follow}
    >
      Neue Nachrichten ↓
    </button>
  ) : null;
}
