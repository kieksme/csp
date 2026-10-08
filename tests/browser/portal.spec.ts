import AxeBuilder from '@axe-core/playwright';
import { test, expect } from '@playwright/test';
test('serves every module, filters FAQ, downloads vCard and streams chat', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.locator('.site-header')).toHaveCSS('display', 'flex');
  await expect(page.locator('.contact-grid')).toHaveCSS('display', 'grid');
  await expect(
    page.getByRole('heading', { name: 'Hallo, mein Name ist Lena Beispiel.' }),
  ).toBeVisible();
  await expect(
    page.getByRole('link', { name: 'Jetzt anrufen' }),
  ).toHaveAttribute('href', 'tel:+49000000000');
  await expect(
    page.getByText('Lena Beispiel im Dienst', { exact: false }),
  ).toBeVisible();
  await expect(
    page.locator('#status .monitor').filter({ hasText: 'Cloud-Infrastruktur' }),
  ).toBeVisible();
  await page.locator('#faq-search').fill('Ticket');
  await expect(page.locator('#faq details')).toHaveCount(1);
  await page.locator('#faq summary').click();
  await expect(page.locator('#faq .markdown')).toContainText('Fehlermeldung');
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Kontakt speichern' }).first().click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('contact.vcf');
  await page.locator('#chat-input').fill('Was mache ich bei einer Störung?');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  await expect(page.locator('.chat-history')).toContainText(
    'synthetische Demo-Antwort',
  );
  await expect(
    page.getByRole('button', { name: 'Frage senden' }),
  ).toBeDisabled(); // Empty input after a completed answer.
  await page.getByRole('button', { name: 'Dunkles Design aktivieren' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByRole('button', { name: 'Helles Design aktivieren' }).click();
  await page.locator('#faq-search').fill('');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({
    path: `test-results/portal-${info.project.name}.png`,
    fullPage: true,
    animations: 'disabled',
  });
  expect(errors).toEqual([]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
test('keeps static contact and help offline without presenting cached live data', async ({
  page,
  context,
}) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
    if (!navigator.serviceWorker.controller)
      await new Promise<void>((resolve) =>
        navigator.serviceWorker.addEventListener(
          'controllerchange',
          () => resolve(),
          { once: true },
        ),
      );
  });
  await page.reload();
  await expect(
    page.locator('#status .monitor').filter({ hasText: 'Cloud-Infrastruktur' }),
  ).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('link', { name: 'Jetzt anrufen' })).toBeVisible();
  await expect(page.locator('.offline-bar')).toContainText('Offline');
  await expect(page.locator('#status')).toContainText(
    'Verbindung unterbrochen',
  );
  await expect(page.locator('#status')).not.toContainText('Verfügbar');
  await page.locator('#faq-search').fill('dringenden');
  await expect(page.locator('#faq details')).toHaveCount(1);
  await context.setOffline(false);
});
test('isolates a second brand and removed plugins', async ({ page }) => {
  await page.goto('http://127.0.0.1:4174');
  await expect(
    page.getByRole('heading', { name: 'Gute Hilfe. Klare Wege.' }),
  ).toBeVisible();
  await expect(page.locator('#alerts')).toHaveCount(0);
  await expect(page.locator('#team')).toHaveCount(0);
  await expect(page.locator('#status')).toHaveCount(0);
  await page.locator('#chat-input').fill('Hilfe');
  await page.getByRole('button', { name: 'Frage senden' }).click();
  await expect(page.locator('.chat-history')).toContainText(
    'synthetische Demo-Antwort',
  );
  const response = await page.request.get(
    'http://127.0.0.1:3002/api/v1/alerts',
  );
  expect(response.status()).toBe(404);
});
test('marks a failed live source and keeps hotline available', async ({
  page,
}) => {
  await page.route('**/api/v1/status', (route) =>
    route.fulfill({
      json: {
        data: {
          monitors: [{ id: 'a', name: 'Test Service', status: 'up' }],
          url: 'https://status.example.invalid',
        },
        stale: true,
        updatedAt: '2026-10-06T10:00:00Z',
        error: 'Provider ausgefallen',
      },
    }),
  );
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#status')).toContainText(
    'Letzter bekannter Zustand',
  );
  await expect(page.locator('#status')).toContainText('Provider ausgefallen');
  await expect(page.locator('#status .dot')).not.toHaveClass(
    /(?:^|\s)up(?:\s|$)/,
  );
  await expect(page.getByRole('link', { name: 'Jetzt anrufen' })).toBeVisible();
});

test('supports keyboard navigation and accessible light/dark themes', async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('#status')).toContainText('Cloud-Infrastruktur');
  await page.keyboard.press('Tab');
  await expect(
    page.getByRole('link', { name: 'Zum Inhalt springen' }),
  ).toBeFocused();
  await page.keyboard.press('Enter');
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
  }
});

test('shows the duty portrait and one working question field in the header', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.locator('.hero h1')).toContainText('Lena Beispiel');
  await expect(page.locator('.hero')).toContainText(
    'Jetzt im Dienst · Für Sie zuständig',
  );
  await expect(page.locator('.duty-portrait img')).toHaveAttribute(
    'src',
    '/team/lena-example.png',
  );
  await expect(page.locator('.duty-portrait img')).toBeVisible();
  await expect(page.locator('.hero #chat-input')).toBeVisible();
  await expect(page.locator('#chat-input')).toHaveCount(1);
  await expect(page.locator('.hero')).toContainText('Digitaler Assistent');
});

test('shows the next shift, unknown schedule and stale data without claiming duty', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  let shifts = [
    {
      userId: 'demo-noah',
      name: 'Noah Muster',
      start: '2026-10-09T06:00:00Z',
      end: '2026-10-09T14:00:00Z',
    },
  ];
  let stale = false;
  await page.route('**/api/v1/schedule', (route) =>
    route.fulfill({
      json: {
        data: { timezone: 'Europe/Berlin', shifts },
        stale,
        updatedAt: '2026-10-08T12:00:00Z',
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.hero h1')).toHaveText(
    'Derzeit hat niemand Schicht.',
  );
  await expect(page.locator('.hero')).toContainText(
    'Ab morgen um 8 Uhr sind wir wieder für Sie da.',
  );
  await expect(page.locator('.duty-portrait')).toHaveCount(0);
  shifts = [
    {
      ...shifts[0],
      start: '2026-10-10T06:00:00Z',
      end: '2026-10-10T14:00:00Z',
    },
  ];
  await page.reload();
  await expect(page.locator('.hero')).toContainText('Ab übermorgen um 8 Uhr');
  shifts = [];
  await page.reload();
  await expect(page.locator('.hero')).toContainText(
    'Der nächste Schichtbeginn ist noch nicht bekannt.',
  );
  stale = true;
  await page.reload();
  await expect(page.locator('.hero h1')).toHaveText(
    'Erreichbarkeit derzeit nicht bestätigt.',
  );
  await expect(page.locator('.hero')).not.toContainText(
    'Derzeit hat niemand Schicht.',
  );
});

test('changes duty at the shift boundary without reloading', async ({
  page,
}) => {
  await page.clock.install({ time: new Date('2026-10-08T12:00:00Z') });
  await page.route('**/api/v1/schedule', (route) =>
    route.fulfill({
      json: {
        data: {
          timezone: 'Europe/Berlin',
          shifts: [
            {
              userId: 'demo-lena',
              name: 'Lena Beispiel',
              start: '2026-10-08T11:00:00Z',
              end: '2026-10-08T12:00:05Z',
            },
            {
              userId: 'demo-noah',
              name: 'Noah Muster',
              start: '2026-10-08T12:00:05Z',
              end: '2026-10-08T13:00:00Z',
            },
          ],
        },
        stale: false,
        updatedAt: '2026-10-08T12:00:00Z',
      },
    }),
  );
  await page.goto('/');
  await expect(page.locator('.hero h1')).toContainText('Lena Beispiel');
  await page.clock.fastForward(6000);
  await expect(page.locator('.hero h1')).toContainText('Noah Muster');
  await expect(page.locator('.duty-portrait img')).toHaveAttribute(
    'src',
    '/team/noah-example.png',
  );
});
