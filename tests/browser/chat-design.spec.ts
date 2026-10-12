import { test, expect } from '@playwright/test';

for (const support of [false, true]) {
  test(`chat keeps its composer usable and speakers distinct (${support ? 'support' : 'assistant'})`, async ({
    page,
  }, info) => {
    let existing: { id: string; status: string }[] = [];
    if (support) {
      existing = await (
        await page.request.get('http://127.0.0.1:3017/api/v1/conversations')
      ).json();
      for (const c of existing)
        if (c.status !== 'closed')
          await page.request.post(
            `http://127.0.0.1:3017/api/v1/conversations/${c.id}/resolve`,
            { data: {} },
          );
    }
    await page.goto(support ? 'http://127.0.0.1:4176' : '/');
    const panel = page.locator('.chat-panel');
    await expect(
      panel.getByRole('heading', { name: 'Service-Chat' }),
    ).toBeVisible();
    if (support && existing.length)
      await panel
        .getByRole('button', { name: 'Neuen Chat starten', exact: true })
        .click();
    const input = panel.getByRole('textbox');
    await expect(input).toBeEnabled();
    await input.fill('Meine E-Mail funktioniert nicht. Was kann ich prüfen?');
    const send = panel.getByRole('button', {
      name: support ? 'Senden' : 'Frage senden',
      exact: true,
    });
    await send.click();
    const user = panel.locator('.message.user').last();
    await expect(user.locator('.chat-author')).toHaveText('Sie');
    await expect(panel.locator('.message.assistant').last()).toBeVisible();
    const log = panel.getByRole('log', { name: 'Gesprächsverlauf' });
    await log.focus();
    await expect(log).toBeFocused();
    const history = await log.boundingBox();
    const bubble = await user.boundingBox();
    const button = await send.boundingBox();
    expect(button!.height).toBeGreaterThanOrEqual(44);
    expect(bubble!.x).toBeGreaterThan(history!.x);
    expect(button!.x + button!.width).toBeLessThanOrEqual(
      page.viewportSize()!.width,
    );
    await input.fill('Dieser Entwurf bleibt bearbeitbar.');
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath('chat-light.png'),
    });
    await page
      .getByRole('button', { name: 'Dunkles Design aktivieren' })
      .click();
    await panel.evaluate(async (element) => {
      await Promise.all(
        element
          .getAnimations({ subtree: true })
          .map((animation) => animation.finished),
      );
    });
    await expect(input).toHaveValue('Dieser Entwurf bleibt bearbeitbar.');
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({
      path: info.outputPath('chat-dark.png'),
    });
  });
}
