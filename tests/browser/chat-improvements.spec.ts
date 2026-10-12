import { test, expect, type Page } from '@playwright/test';
const api = 'http://127.0.0.1:3017/api/v1/conversations';
async function freshSupport(page: Page) {
  const existing = await (await page.request.get(api)).json();
  for (const c of existing)
    if (c.status !== 'closed')
      await page.request.post(`${api}/${c.id}/resolve`, { data: {} });
  await page.goto('http://127.0.0.1:4176');
  await expect(page.locator('.support-chat form')).toBeVisible();
  const start = page.getByRole('button', {
    name: 'Neuen Chat starten',
    exact: true,
  });
  if (await start.isVisible()) await start.click();
  await expect(page.locator('#support-chat-input')).toBeEnabled();
}
for (const platform of ['Win32', 'MacIntel']) {
  test(`shows ${platform} shortcut and submits without losing line breaks`, async ({
    page,
  }) => {
    await page.addInitScript(
      (platform) =>
        Object.defineProperty(navigator, 'platform', { get: () => platform }),
      platform,
    );
    await freshSupport(page);
    await expect(page.locator('#support-chat-shortcut')).toHaveText(
      platform === 'MacIntel' ? '⌘ Enter zum Senden' : 'Strg Enter zum Senden',
    );
    const input = page.locator('#support-chat-input');
    await input.fill('Erste Zeile');
    await input.press('Enter');
    await input.press('Z');
    await expect(input).toHaveValue('Erste Zeile\nZ');
    await input.press(platform === 'MacIntel' ? 'Meta+Enter' : 'Control+Enter');
    await expect(page.locator('.chat-history')).toContainText('Erste Zeile\nZ');
    await expect(input).toHaveValue('');
  });
}
test('requests a human before the first message, pauses the bot and preserves waiting after reload', async ({
  page,
}) => {
  await freshSupport(page);
  await page
    .getByRole('button', {
      name: 'Ich möchte mit einer echten Person sprechen',
      exact: true,
    })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'KI pausiert' }),
  ).toBeVisible();
  await page
    .locator('#support-chat-input')
    .fill('Weitere Details für den Support');
  await page.locator('#support-chat-input').press('Control+Enter');
  await expect(page.locator('.chat-history')).toContainText(
    'Weitere Details für den Support',
  );
  await expect(page.locator('.chat-history')).not.toContainText(
    'synthetische Demo-Antwort',
  );
  await page.reload();
  await expect(
    page.getByRole('status').filter({ hasText: 'KI pausiert' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Lena übernimmt', exact: true })
    .click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Lena Demo · Support' }),
  ).toBeVisible();
  await page
    .getByRole('button', { name: 'Lena antwortet', exact: true })
    .click();
  await expect(page.locator('.chat-history')).toContainText(
    'Hallo, ich bin Lena vom Support',
  );
  await page
    .getByRole('button', { name: 'Problem gelöst', exact: true })
    .click();
});
test('follows long conversations but preserves the reader position and offers new messages', async ({
  page,
}, info) => {
  await freshSupport(page);
  await page
    .getByRole('button', {
      name: 'Ich möchte mit einer echten Person sprechen',
      exact: true,
    })
    .click();
  await page
    .getByRole('button', { name: 'Lena übernimmt', exact: true })
    .click();
  const c = (await (await page.request.get(api)).json())[0];
  for (let i = 0; i < 12; i++)
    await page.request.post(`${api}/${c.id}/demo`, {
      data: {
        action: 'reply',
        content: `Antwort ${i}: ` + 'Details zur Fehleranalyse. '.repeat(15),
      },
    });
  const history = page.locator('.chat-history');
  await expect(history).toContainText('Antwort 11:');
  await expect
    .poll(() =>
      history.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight),
    )
    .toBeLessThan(5);
  await history.evaluate((e) => {
    e.scrollTop = 0;
    e.dispatchEvent(new Event('scroll'));
  });
  await page.request.post(`${api}/${c.id}/demo`, {
    data: {
      action: 'reply',
      content: 'Eine neue Nachricht während Sie ältere lesen.',
    },
  });
  await expect(
    page.getByRole('button', { name: 'Neue Nachrichten ↓' }),
  ).toBeVisible();
  expect(await history.evaluate((e) => e.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'Neue Nachrichten ↓' }).click();
  await expect
    .poll(() =>
      history.evaluate((e) => e.scrollHeight - e.scrollTop - e.clientHeight),
    )
    .toBeLessThan(5);
  await page.screenshot({
    path: `test-results/chat-long-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.request.post(`${api}/${c.id}/resolve`, { data: {} });
});
async function mockMicrophone(page: Page) {
  await page.addInitScript(() => {
    const stream = { getTracks: () => [{ stop: () => {} }] };
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: async () => stream },
    });
    class Recorder {
      static isTypeSupported() {
        return true;
      }
      state = 'inactive';
      ondataavailable?: (event: { data: Blob }) => void;
      onstop?: () => void;
      constructor(_stream: unknown, _options: unknown) {}
      start() {
        this.state = 'recording';
      }
      stop() {
        this.state = 'inactive';
        this.ondataavailable?.({
          data: new Blob([new Uint8Array([0x1a, 0x45, 0xdf, 0xa3])]),
        });
        this.onstop?.();
      }
    }
    Object.defineProperty(window, 'MediaRecorder', { value: Recorder });
  });
  await page.route('**/api/v1/chat/capabilities', (route) =>
    route.fulfill({ json: { transcription: true } }),
  );
}
test('dictates into an editable draft, never automatically sends, and keeps the draft on errors and cancel', async ({
  page,
}) => {
  await mockMicrophone(page);
  let uploads = 0,
    sends = 0;
  await page.route('**/api/v1/chat/transcriptions', (route) => {
    uploads++;
    return uploads === 1
      ? route.fulfill({ json: { text: 'Diktierter Zusatz' } })
      : route.fulfill({
          status: 503,
          json: { error: 'Spracheingabe derzeit nicht verfügbar.' },
        });
  });
  await page.route('**/api/v1/chat', (route) => {
    sends++;
    return route.abort();
  });
  await page.goto('/');
  const input = page.locator('#chat-input');
  await input.fill('Vorhandener Entwurf');
  const microphone = page.getByRole('button', {
    name: 'Nachricht diktieren',
    exact: true,
  });
  await expect(microphone).toBeVisible();
  const [micBox, sendBox] = await Promise.all([
    microphone.boundingBox(),
    page
      .getByRole('button', { name: 'Frage senden', exact: true })
      .boundingBox(),
  ]);
  expect(micBox!.x + micBox!.width).toBeLessThanOrEqual(sendBox!.x);
  expect(sendBox!.x - micBox!.x - micBox!.width).toBeLessThanOrEqual(16);
  expect(
    Math.abs(micBox!.y + micBox!.height / 2 - sendBox!.y - sendBox!.height / 2),
  ).toBeLessThanOrEqual(1);
  expect(micBox!.height).toBe(sendBox!.height);
  const fieldBox = await page.locator('.chat-compose-field').boundingBox();
  const hintBox = await page.locator('#chat-shortcut').boundingBox();
  const inputBox = await input.boundingBox();
  expect(hintBox!.x + hintBox!.width).toBeLessThanOrEqual(
    fieldBox!.x + fieldBox!.width,
  );
  expect(
    Math.abs(hintBox!.x + hintBox!.width - fieldBox!.x - fieldBox!.width),
  ).toBeLessThanOrEqual(8);
  expect(hintBox!.y).toBeGreaterThanOrEqual(inputBox!.y + inputBox!.height);
  expect(hintBox!.y + hintBox!.height).toBeLessThanOrEqual(
    fieldBox!.y + fieldBox!.height,
  );
  await page.getByRole('button', { name: 'Nachricht diktieren' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Aufnahme läuft' }),
  ).toBeVisible();
  const recordingButtons = await Promise.all(
    ['Aufnahme stoppen', 'Abbrechen', 'Frage senden'].map((name) =>
      page.getByRole('button', { name, exact: true }).boundingBox(),
    ),
  );
  for (const button of recordingButtons) {
    expect(button!.height).toBe(44);
    expect(button!.y).toBe(recordingButtons[0]!.y);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole('button', { name: 'Aufnahme stoppen' }).click();
  await expect(input).toHaveValue('Vorhandener Entwurf\nDiktierter Zusatz');
  expect(sends).toBe(0);
  await page.getByRole('button', { name: 'Nachricht diktieren' }).click();
  await page.getByRole('button', { name: 'Aufnahme stoppen' }).click();
  await expect(page.getByRole('alert')).toContainText(
    'Spracheingabe derzeit nicht verfügbar',
  );
  await expect(input).toHaveValue('Vorhandener Entwurf\nDiktierter Zusatz');
  await page.getByRole('button', { name: 'Nachricht diktieren' }).click();
  await page.getByRole('button', { name: 'Abbrechen', exact: true }).click();
  expect(uploads).toBe(2);
  expect(sends).toBe(0);
});

test('automatically stops dictation after sixty seconds and reports microphone denial', async ({
  page,
}) => {
  await mockMicrophone(page);
  await page.route('**/api/v1/chat/transcriptions', (route) =>
    route.fulfill({ json: { text: 'Nach sechzig Sekunden' } }),
  );
  await page.goto('/');
  await page.clock.install();
  await page.getByRole('button', { name: 'Nachricht diktieren' }).click();
  await expect(
    page.getByRole('status').filter({ hasText: 'Aufnahme läuft' }),
  ).toBeVisible();
  await page.clock.fastForward(60000);
  await expect(page.locator('#chat-input')).toHaveValue(
    'Nach sechzig Sekunden',
  );
  await page.evaluate(() => {
    navigator.mediaDevices.getUserMedia = async () => {
      throw new DOMException('denied', 'NotAllowedError');
    };
  });
  await page.getByRole('button', { name: 'Nachricht diktieren' }).click();
  await expect(page.getByRole('alert')).toContainText('Mikrofonzugriff');
  await expect(page.locator('#chat-input')).toHaveValue(
    'Nach sechzig Sekunden',
  );
});
