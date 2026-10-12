import { expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  conversation,
  action,
  append,
  resolveConversation,
  type Delivery,
} from '../packages/core/src/support.js';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import chat from '../packages/plugin-chat/src/server.js';
import slack from '../packages/plugin-slack/src/server.js';
import { card as slackCard } from '../packages/plugin-slack/src/slack.js';
import { card as teamsCard } from '../packages/plugin-teams/src/teams.js';
import { card as telegramCard } from '../packages/plugin-telegram/src/telegram.js';
const owner = { tenantId: 'demo', userId: 'demo-user', name: 'Besucher' };
const lena = { id: 'lena', name: 'Lena' };
it('resolves bot and human conversations, interrupts output and deduplicates resolution', () => {
  for (const mode of ['bot', 'support'] as const) {
    const c = conversation(owner),
      queue: Delivery[] = [];
    if (mode === 'support') action(c, 'take', lena, queue);
    c.generation = 'answer';
    append(c, {
      id: 'answer',
      kind: 'bot',
      content: 'Teilantwort',
      complete: false,
    });
    resolveConversation(c, { by: 'visitor', name: owner.name }, queue);
    expect(c.status).toBe('closed');
    expect(c.resolution?.by).toBe('visitor');
    expect(c.support).toBeUndefined();
    expect(c.generation).toBeUndefined();
    expect(c.messages.find((m) => m.id === 'answer')?.content).toContain(
      'unterbrochen',
    );
    expect(queue.at(-1)?.kind).toBe('card');
    expect(c.events.findLast((e) => e.type === 'status')?.data).toMatchObject({
      status: 'closed',
      resolution: { by: 'visitor' },
    });
    const count = c.messages.length;
    resolveConversation(c, { by: 'support', name: 'Andere' }, queue);
    expect(c.messages).toHaveLength(count);
    expect(c.resolution?.by).toBe('visitor');
  }
});
it('allows support resolution in bot mode, but protects the assigned conversation and historical closure', () => {
  const c = conversation(owner),
    queue: Delivery[] = [];
  action(c, 'take', lena, queue);
  expect(() =>
    action(c, 'resolve', { id: 'other', name: 'Andere' }, queue),
  ).toThrow('zuständige');
  action(c, 'resolve', lena, queue);
  expect(c.resolution).toMatchObject({ by: 'support', name: 'Lena' });
  const bot = conversation(owner);
  action(bot, 'resolve', lena, []);
  expect(bot.status).toBe('closed');
  const closed = conversation(owner);
  action(closed, 'take', lena, []);
  action(closed, 'close', lena, []);
  expect(closed.resolution).toBeUndefined();
  expect(() =>
    resolveConversation(closed, { by: 'visitor', name: 'V' }, []),
  ).toThrow('bereits abgeschlossen');
});
it('offers Problem gelöst in all channel cards before and after takeover and removes actions after resolution', () => {
  const c = conversation(owner);
  for (const build of [slackCard, teamsCard, telegramCard]) {
    expect(JSON.stringify(build(c))).toContain('Problem gelöst');
    action(c, 'take', lena, []);
    expect(JSON.stringify(build(c))).toContain('Problem gelöst');
    action(c, 'release', lena, []);
  }
  action(c, 'resolve', lena, []);
  expect(teamsCard(c).actions).toEqual([]);
  expect(telegramCard(c).reply_markup.inline_keyboard).toEqual([]);
  expect(slackCard(c).some((b) => b.type === 'actions')).toBe(false);
});
it('exposes owner-only idempotent resolution and rejects later messages and forged actor data', async () => {
  const app = await createServer({
    plugins: [chat, slack],
    config: {
      ...publicConfig({ CSP_DEMO: 'true' }),
      chatSupport: { mode: 'demo' },
    },
    env: { CSP_DEMO: 'true', CSP_SLACK_DEMO: 'true' },
  });
  try {
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${randomUUID()}/resolve`,
          payload: {},
        })
      ).statusCode,
    ).toBe(404);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/resolve`,
          payload: { by: 'support' },
        })
      ).statusCode,
    ).toBe(400);
    const path = `/api/v1/conversations/${c.id}/resolve`;
    const first = await app.inject({ method: 'POST', url: path, payload: {} });
    expect(first.statusCode).toBe(200);
    expect(first.json().resolution.by).toBe('visitor');
    const again = await app.inject({ method: 'POST', url: path, payload: {} });
    expect(again.json().messages).toHaveLength(first.json().messages.length);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/messages`,
          payload: { id: randomUUID(), content: 'Noch eine Frage' },
        })
      ).statusCode,
    ).toBe(409);
  } finally {
    await app.close();
  }
});
