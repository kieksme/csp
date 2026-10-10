import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
test('takes over a persisted chat, replies as Lena, releases and closes it', async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const existing = await (
    await page.request.get('http://127.0.0.1:3017/api/v1/conversations')
  ).json();
  for (const c of existing)
    if (c.status !== 'closed') {
      if (c.status === 'bot')
        await page.request.post(
          `http://127.0.0.1:3017/api/v1/conversations/${c.id}/demo`,
          { data: { action: 'take' } },
        );
      await page.request.post(
        `http://127.0.0.1:3017/api/v1/conversations/${c.id}/demo`,
        { data: { action: 'close' } },
      );
    }
  await page.goto('http://127.0.0.1:4176');
  if (existing.length)
    await page
      .getByRole('button', { name: 'Neuen Chat starten', exact: true })
      .click();
  await page
    .locator('#support-chat-input')
    .fill('Bitte helfen Sie bei einer Störung.');
  await page.getByRole('button', { name: 'Senden', exact: true }).click();
  await expect(page.locator('.chat-history')).toContainText(
    'synthetische Demo-Antwort',
  );
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
    'Hallo, ich bin Lena vom Support.',
  );
  await page.reload();
  await expect(page.locator('.chat-history')).toContainText(
    'Hallo, ich bin Lena vom Support.',
  );
  await expect(
    page.getByRole('status').filter({ hasText: 'Lena Demo · Support' }),
  ).toBeVisible();
  await page.screenshot({
    path: `test-results/support-light-${info.project.name}.png`,
    fullPage: true,
  });
  await page.getByRole('button', { name: 'Dunkles Design aktivieren' }).click();
  await page.screenshot({
    path: `test-results/support-dark-${info.project.name}.png`,
    fullPage: true,
  });
  expect(
    (await new AxeBuilder({ page }).include('.support-chat').analyze())
      .violations,
  ).toEqual([]);
  await page
    .getByRole('button', { name: 'Bot freigeben', exact: true })
    .click();
  await expect(page.locator('.chat-history')).toContainText(
    'an den digitalen Assistenten zurückgegeben',
  );
  await page.locator('#support-chat-input').fill('Danke, noch eine Frage.');
  await page.getByRole('button', { name: 'Senden', exact: true }).click();
  await expect(page.locator('.chat-history')).toContainText(
    'Danke, noch eine Frage.',
  );
  await page
    .getByRole('button', { name: 'Lena übernimmt', exact: true })
    .click();
  await page.getByRole('button', { name: 'Abschließen', exact: true }).click();
  await expect(page.locator('#support-chat-input')).toBeDisabled();
  await page
    .getByRole('button', { name: 'Neuen Chat starten', exact: true })
    .click();
  await expect(page.locator('#support-chat-input')).toBeEnabled();
  await expect(page.locator('.chat-history')).toBeEmpty();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(errors).toEqual([]);
});
