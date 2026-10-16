import {
  analyticsEvents,
  ANALYTICS_EVENT,
  type AnalyticsEvent,
  type AnalyticsMeta,
} from '@kieksme/csp-sdk/browser';
import type { SwetrixConfig } from '@kieksme/csp-sdk';
export interface Tracker {
  view: () => void;
  track: (options: { ev: string; meta: Record<string, string> }) => unknown;
}
/** Minimal Swetrix Events API adapter: never reads query strings or referrers. */
export function createTracker(config: SwetrixConfig): Tracker {
  const send = (path: string, payload: Record<string, unknown>) => {
    if (!trackingAllowed(config, location.hostname, navigator.doNotTrack))
      return;
    void fetch(config.apiUrl.replace(/\/$/, '') + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'omit',
      referrerPolicy: 'no-referrer',
      keepalive: true,
      body: JSON.stringify({
        pid: config.projectId,
        pg: location.pathname,
        lc: navigator.language,
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...payload,
      }),
    }).catch(() => {});
  };
  return {
    view: () => send('', { unique: true }),
    track: (event) => send('/custom', event),
  };
}
export function trackingAllowed(
  config: SwetrixConfig | undefined,
  hostname: string,
  dnt: string | null,
) {
  return (
    !!config?.enabled &&
    !(config.respectDNT && dnt === '1') &&
    !/^(localhost|.*\.localhost|127(?:\.\d+){3}|0\.0\.0\.0|\[?::1\]?)$/i.test(
      hostname,
    )
  );
}
const keys: (keyof AnalyticsMeta)[] = [
  'section',
  'faqId',
  'processId',
  'channel',
  'chatMode',
];
export function sanitizeMeta(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  const result: Record<string, string> = {};
  for (const key of keys) {
    const entry = (value as Record<string, unknown>)[key];
    if (typeof entry === 'string' && /^[a-zA-Z0-9_-]{1,64}$/.test(entry))
      result[key] = entry;
  }
  return result;
}
// Keep pageview deduplication across React integration remounts.
const viewed = new Set<string>();
export function startTracking(
  config: SwetrixConfig,
  tracker: Tracker,
  root: HTMLElement = document.body,
) {
  if (!trackingAllowed(config, location.hostname, navigator.doNotTrack))
    return () => {};
  const key = `${config.projectId}:${config.variant}:${location.pathname}`;
  const track = (event: AnalyticsEvent, meta: unknown = {}) => {
    if (!trackingAllowed(config, location.hostname, navigator.doNotTrack))
      return;
    try {
      const result = tracker.track({
        ev: event,
        meta: { ...sanitizeMeta(meta), variant: config.variant },
      });
      if (result && typeof (result as Promise<unknown>).catch === 'function')
        void (result as Promise<unknown>).catch(() => {});
    } catch {
      /* Analytics must never interrupt portal actions. */
    }
  };
  if (!viewed.has(key)) {
    viewed.add(key);
    tracker.view();
    track('PORTAL_VIEW');
  }
  const listener = (event: Event) => {
    const detail = (event as CustomEvent).detail;
    if (detail && analyticsEvents.includes(detail.event))
      track(detail.event, detail.meta);
  };
  window.addEventListener(ANALYTICS_EVENT, listener);
  const seen = new Set<string>();
  const timers = new Map<Element, ReturnType<typeof setTimeout>>();
  const chatOpened = new Set<Element>();
  const openChat = (event: Event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const panel = target.closest('.chat-panel');
    if (panel && !chatOpened.has(panel)) {
      chatOpened.add(panel);
      track('CHAT_OPEN');
    }
  };
  root.addEventListener('focusin', openChat);
  root.addEventListener('click', openChat);
  root.addEventListener('keydown', openChat);
  const observer =
    typeof IntersectionObserver === 'undefined'
      ? undefined
      : new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              const target = entry.target;
              const id = target.id;
              if (!entry.isIntersecting || entry.intersectionRatio < 0.5) {
                clearTimeout(timers.get(target));
                timers.delete(target);
              } else if (!seen.has(id) && !timers.has(target)) {
                timers.set(
                  target,
                  setTimeout(() => {
                    timers.delete(target);
                    seen.add(id);
                    track('SECTION_VIEW', { section: id });
                    observer?.unobserve(target);
                  }, 1000),
                );
              }
            }
          },
          { threshold: 0.5 },
        );
  for (const section of root.querySelectorAll(
    'main section[id], main .hero-chat[id]',
  ))
    observer?.observe(section);
  return () => {
    window.removeEventListener(ANALYTICS_EVENT, listener);
    root.removeEventListener('focusin', openChat);
    root.removeEventListener('click', openChat);
    root.removeEventListener('keydown', openChat);
    observer?.disconnect();
    for (const timer of timers.values()) clearTimeout(timer);
  };
}
