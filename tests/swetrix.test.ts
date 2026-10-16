import { afterEach, expect, it, vi } from 'vitest';
import {
  createTracker,
  sanitizeMeta,
  startTracking,
  trackingAllowed,
} from '../packages/plugin-swetrix/src/tracker.js';
import { emitAnalytics } from '@kieksme/csp-sdk/browser';
const config = {
  projectId: 'test',
  apiUrl: 'https://analytics.example.org/log',
  enabled: true,
  variant: 'support',
  respectDNT: true,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});
it('blocks disabled tracking, DNT and all local host forms', () => {
  for (const host of [
    'localhost',
    'demo.localhost',
    '127.0.0.1',
    '127.9.8.7',
    '::1',
    '[::1]',
    '0.0.0.0',
  ])
    expect(trackingAllowed(config, host, null)).toBe(false);
  expect(trackingAllowed(config, 'portal.test', '1')).toBe(false);
  expect(
    trackingAllowed({ ...config, enabled: false }, 'portal.test', null),
  ).toBe(false);
  expect(
    trackingAllowed({ ...config, respectDNT: false }, 'portal.test', '1'),
  ).toBe(true);
});
it('only allows bounded content-free metadata', () => {
  expect(
    sanitizeMeta({
      faqId: 'vpn-setup',
      section: 'faq',
      query: 'private',
      email: 'secret@example.org',
      channel: 'private@email.test',
      processId: 'a'.repeat(65),
    }),
  ).toEqual({ faqId: 'vpn-setup', section: 'faq' });
});
function browser() {
  vi.stubGlobal('location', {
    hostname: 'portal.test',
    pathname: '/portal/',
    search: '?email=secret',
    hash: '#secret',
  });
  vi.stubGlobal('navigator', { language: 'de-DE', doNotTrack: null });
  vi.stubGlobal('window', new EventTarget());
  class Custom extends Event {
    detail: unknown;
    constructor(name: string, options: { detail: unknown }) {
      super(name);
      this.detail = options.detail;
    }
  }
  vi.stubGlobal('CustomEvent', Custom);
}
it('sends allowlisted payloads without query, referrer or cookies and tolerates transport errors', async () => {
  browser();
  const fetcher = vi.fn().mockResolvedValue({ ok: true });
  vi.stubGlobal('fetch', fetcher);
  const tracker = createTracker(config);
  tracker.view();
  tracker.track({ ev: 'FAQ_OPEN', meta: { faqId: 'vpn' } });
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(JSON.parse(fetcher.mock.calls[0][1].body)).not.toHaveProperty(
    'unique',
  );
  const [url, options] = fetcher.mock.calls[1];
  expect(url).toBe('https://analytics.example.org/log/custom');
  expect(options).toMatchObject({
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
    keepalive: true,
  });
  expect(JSON.parse(options.body)).toMatchObject({
    pid: 'test',
    pg: '/portal/',
    ev: 'FAQ_OPEN',
  });
  expect(options.body).not.toMatch(/secret|search|ref|qs|profileId/);
  fetcher.mockRejectedValue(new Error('blocked'));
  tracker.view();
  await Promise.resolve();
});
it('deduplicates pageviews, observes dwell time and disconnects all listeners', () => {
  browser();
  vi.useFakeTimers();
  const root = Object.assign(new EventTarget(), { querySelectorAll: () => [] });
  let callback: (entries: unknown[]) => void = () => {};
  const disconnect = vi.fn(),
    unobserve = vi.fn();
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(cb: typeof callback) {
        callback = cb;
      }
      observe() {}
      disconnect = disconnect;
      unobserve = unobserve;
    },
  );
  const tracker = { view: vi.fn(), track: vi.fn() };
  const cleanup = startTracking(
    config,
    tracker,
    root as unknown as HTMLElement,
  );
  emitAnalytics('FAQ_OPEN', { faqId: 'vpn' });
  expect(tracker.track).toHaveBeenLastCalledWith({
    ev: 'FAQ_OPEN',
    meta: { faqId: 'vpn', variant: 'support' },
  });
  const target = { id: 'faq' };
  callback([{ target, isIntersecting: true, intersectionRatio: 0.6 }]);
  vi.advanceTimersByTime(999);
  expect(unobserve).not.toHaveBeenCalled();
  callback([{ target, isIntersecting: false, intersectionRatio: 0 }]);
  vi.advanceTimersByTime(1000);
  expect(unobserve).not.toHaveBeenCalled();
  callback([{ target, isIntersecting: true, intersectionRatio: 0.6 }]);
  vi.advanceTimersByTime(1000);
  expect(unobserve).toHaveBeenCalledWith(target);
  cleanup();
  expect(disconnect).toHaveBeenCalled();
  const calls = tracker.track.mock.calls.length;
  emitAnalytics('TICKET_CLICK');
  expect(tracker.track).toHaveBeenCalledTimes(calls);
  startTracking(config, tracker, root as unknown as HTMLElement)();
  expect(tracker.view).toHaveBeenCalledTimes(1);
});
