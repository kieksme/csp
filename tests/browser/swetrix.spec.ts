import { test, expect } from '@playwright/test';
import { build } from 'vite';
import { resolve } from 'node:path';
let bundle: string;
test.beforeAll(async () => {
  const result = await build({
    configFile: false,
    logLevel: 'error',
    build: {
      write: false,
      lib: {
        entry: resolve('packages/plugin-swetrix/src/tracker.ts'),
        name: 'SwetrixTest',
        formats: ['iife'],
      },
    },
  });
  const outputs = Array.isArray(result) ? result : [result];
  bundle = outputs
    .flatMap((r: any) => r.output)
    .filter((o: any) => o.type === 'chunk')
    .map((o: any) => o.code)
    .join('\n');
});
const config = {
  projectId: 'browserTest',
  apiUrl: 'https://analytics.test/log',
  enabled: true,
  respectDNT: true,
  variant: 'browser',
};
test('browser integration sends private payloads, deduplicates and cleans up', async ({
  page,
}) => {
  const requests: { url: string; payload: any }[] = [];
  await page.route('https://analytics.test/**', (route) => {
    requests.push({
      url: route.request().url(),
      payload: route.request().postDataJSON(),
    });
    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
  await page.route('https://portal.test/**', (route) =>
    route.fulfill({
      contentType: 'text/html',
      body: '<main><section id="faq" style="height:100px">FAQ</section><div class="chat-panel"><button>Start chat</button></div></main>',
    }),
  );
  await page.goto('https://portal.test/portal/?email=private#private');
  await page.addScriptTag({ content: bundle });
  await page.evaluate((settings) => {
    const w = window as any;
    w.cleanup = w.SwetrixTest.startTracking(
      settings,
      w.SwetrixTest.createTracker(settings),
    );
  }, config);
  await page.getByRole('button', { name: 'Start chat' }).click();
  await expect
    .poll(() => requests.map((r) => r.payload.ev))
    .toContain('SECTION_VIEW');
  expect(requests.map((r) => r.payload.ev).filter(Boolean)).toEqual([
    'PORTAL_VIEW',
    'CHAT_OPEN',
    'SECTION_VIEW',
  ]);
  expect(JSON.stringify(requests)).not.toMatch(
    /private|email|referrer|profileId|qs/,
  );
  expect(requests[0].payload.pg).toBe('/portal/');
  expect(requests[1].payload.meta).toEqual({ variant: 'browser' });
  await page.evaluate((settings) => {
    const w = window as any;
    w.cleanup();
    w.SwetrixTest.startTracking(
      settings,
      w.SwetrixTest.createTracker(settings),
    )();
    window.dispatchEvent(
      new CustomEvent('csp:analytics', { detail: { event: 'TICKET_CLICK' } }),
    );
  }, config);
  expect(requests.filter((r) => !r.payload.ev)).toHaveLength(1);
  expect(requests.map((r) => r.payload.ev)).not.toContain('TICKET_CLICK');
});
test('browser integration suppresses DNT and localhost without requests', async ({
  page,
}) => {
  const requests: string[] = [];
  await page.route('https://analytics.test/**', (route) => {
    requests.push(route.request().url());
    return route.abort();
  });
  await page.route('http://localhost:9999/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<main>Local</main>' }),
  );
  await page.goto('http://localhost:9999/');
  await page.addScriptTag({ content: bundle });
  await page.evaluate((settings) => {
    const w = window as any;
    w.SwetrixTest.startTracking(
      settings,
      w.SwetrixTest.createTracker(settings),
    )();
  }, config);
  expect(requests).toEqual([]);
  await page.route('https://portal.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<main>DNT</main>' }),
  );
  await page.goto('https://portal.test/');
  await page.addScriptTag({ content: bundle });
  await page.evaluate((settings) => {
    Object.defineProperty(navigator, 'doNotTrack', {
      value: '1',
      configurable: true,
    });
    const w = window as any;
    w.SwetrixTest.startTracking(
      settings,
      w.SwetrixTest.createTracker(settings),
    )();
  }, config);
  expect(requests).toEqual([]);
});
