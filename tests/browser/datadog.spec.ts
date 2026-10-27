import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('Datadog static demo supports cases, health, schedules and chat without provider traffic', async ({
  page,
}, info) => {
  const errors: string[] = [],
    traffic: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('request', (r) => {
    if (/datadoghq\.|\/api\/v[12]\//.test(r.url())) traffic.push(r.url());
  });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.clock.install({ time: new Date('2026-10-14T12:00:00Z') });
  await page.goto(process.env.CSP_DATADOG_TEST_URL ?? 'http://127.0.0.1:4178');
  await expect(page.locator('.duty-greeting')).toContainText('Demo');
  await expect(page.locator('#datadog-cases article')).toHaveCount(20);
  await page.getByRole('button', { name: 'Weitere Tickets' }).click();
  await expect(page.locator('#datadog-cases article')).toHaveCount(4);
  await page.getByLabel('Ticketstatus').selectOption('CLOSED');
  await expect(page.locator('#datadog-cases article')).toHaveCount(8);
  await expect(page.locator('#datadog-cases')).toContainText('Geschlossen');
  await expect(
    page.getByRole('button', { name: 'Weitere Tickets' }),
  ).toBeDisabled();
  await expect(page.locator('#datadog-health')).toContainText('Keine Daten');
  await expect(page.locator('#datadog-health')).toContainText('Ziel verfehlt');
  await expect(page.locator('#datadog-health')).toContainText('-80 %');
  await expect(page.locator('#datadog-schedule article')).toHaveCount(22);
  await expect(page.locator('#datadog-schedule')).toContainText(
    'Europe/Berlin',
  );
  await expect(page.locator('a[href*="datadoghq"]')).toHaveCount(0);
  await page.locator('#chat-input').fill('Wie ist der Datadog-Status?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  await expect(page.locator('.chat-history')).toContainText(
    'Synthetische Demo',
  );
  await expect(page.locator('.chat-history')).toContainText('Error Budget');
  for (const dark of [false, true]) {
    if (dark)
      await page
        .getByRole('button', { name: 'Dunkles Design aktivieren' })
        .click();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(
      results.violations.map((v) => ({
        id: v.id,
        targets: v.nodes.map((n) => n.target),
      })),
    ).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/${process.env.CSP_DATADOG_SCREENSHOT_PREFIX ?? 'datadog'}-${info.project.name}-${dark ? 'dark' : 'light'}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
  expect(traffic).toEqual([]);
});

test('Datadog static demo registers read-only WebMCP tools backed by demo data', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const tools = new Map<
      string,
      { execute: (a: object) => Promise<unknown> }
    >();
    Object.defineProperty(document, 'modelContext', {
      configurable: true,
      value: {
        registerTool(tool: { name: string; execute: never }) {
          tools.set(tool.name, tool);
          return Promise.resolve();
        },
      },
    });
    (window as unknown as { __tools: typeof tools }).__tools = tools;
  });
  await page.goto(process.env.CSP_DATADOG_TEST_URL ?? 'http://127.0.0.1:4178');
  const call = (name: string, args: object = {}) =>
    page.evaluate(
      async ([n, a]) => {
        const tools = (
          window as unknown as {
            __tools: Map<
              string,
              {
                execute: (
                  a: object,
                ) => Promise<{ content: { text: string }[] }>;
              }
            >;
          }
        ).__tools;
        return JSON.parse(
          (await tools.get(n as string)!.execute(a as object)).content[0].text,
        );
      },
      [name, args] as const,
    );
  await expect
    .poll(() =>
      page.evaluate(() =>
        [
          ...(
            window as unknown as { __tools: Map<string, unknown> }
          ).__tools.keys(),
        ]
          .filter((n) => n.startsWith('datadog_'))
          .sort(),
      ),
    )
    .toEqual([
      'datadog_get_on_duty',
      'datadog_get_oncall_schedule',
      'datadog_list_cases',
      'datadog_list_monitors',
      'datadog_list_slos',
    ]);
  expect((await call('datadog_get_on_duty')).onDuty[0].name).toContain('Demo');
  expect(
    (await call('datadog_list_monitors', { status: 'alert' })).monitors[0].name,
  ).toBe('Zahlungsdienst');
  expect(
    (await call('datadog_list_cases', { status: 'CLOSED' })).cases.length,
  ).toBe(8);
});
