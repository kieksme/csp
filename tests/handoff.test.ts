import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import {
  MemoryStore,
  PostgresStore,
  setupConversations,
  setupAnonymousSessions,
  conversation,
  append,
  requestSupport,
  action,
  dutyTargets,
  parseDutyMap,
  type Delivery,
} from '../packages/core/src/support.js';
import chat from '../packages/plugin-chat/src/server.js';
import { card as slackCard } from '../packages/plugin-slack/src/slack.js';
import { card as teamsCard } from '../packages/plugin-teams/src/teams.js';
import { card as telegramCard } from '../packages/plugin-telegram/src/telegram.js';
const owner = { tenantId: 't', userId: 'u', name: 'Besucher' };
const apps: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
it('interrupts the bot, deduplicates requests and preserves atomic takeover and resolution', async () => {
  const store = new MemoryStore(),
    c = conversation(owner);
  await store.create(c);
  await store.change(c.id, (current, queue) => {
    append(current, {
      id: 'answer',
      kind: 'bot',
      content: 'Anfang',
      complete: false,
    });
    current.generation = 'answer';
    requestSupport(current, ['U111'], queue);
    requestSupport(current, ['U222'], queue);
  });
  const waiting = (await store.get(c.id))!;
  expect(waiting.status).toBe('waiting');
  expect(waiting.generation).toBeUndefined();
  expect(waiting.messages[0].content).toContain('unterbrochen');
  expect(store.jobs.filter((j) => j.kind === 'request')).toHaveLength(1);
  for (const build of [slackCard, teamsCard, telegramCard]) {
    expect(JSON.stringify(build(waiting))).toContain('KI pausiert');
    expect(JSON.stringify(build(waiting))).toContain('Übernehmen');
  }
  const outcomes = await Promise.allSettled(
    ['A', 'B'].map((id) =>
      store.change(c.id, (current, queue) =>
        action(current, 'take', { id, name: id }, queue),
      ),
    ),
  );
  expect(outcomes.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
  expect((await store.get(c.id))?.status).toBe('support');
  await store.change(c.id, (current, queue) =>
    action(current, 'resolve', current.support!, queue),
  );
  expect((await store.get(c.id))?.resolution?.by).toBe('support');
});
it('uses fresh duty mappings, falls back on missing/unavailable data and rejects mention injection', async () => {
  expect(
    await dutyTargets(async () => ['lena', 'lena'], { lena: 'U111' }, ['U222']),
  ).toEqual(['U111']);
  expect(
    await dutyTargets(undefined, { 'demo-lena': 'U111' }, ['U222']),
  ).toEqual(['U222']);
  expect(
    await dutyTargets(
      async () => {
        throw new Error('offline');
      },
      {},
      [],
    ),
  ).toEqual([]);
  expect(await dutyTargets(async () => ['unknown'], {}, ['U222'])).toEqual([
    'U222',
  ]);
  expect(() => parseDutyMap('{"lena":"<@everyone>"}')).toThrow();
});
it('protects visitor requests, stops generation and forwards later messages without generating', async () => {
  const store = new MemoryStore(),
    sent: Delivery[] = [];
  let outage = true;
  const generated = vi.fn();
  const app = await createServer({
    config: {
      ...publicConfig({}),
      chatSupport: { mode: 'slack', auth: 'anonymous' },
    },
    env: { CSP_DEMO: 'true' },
    plugins: [
      chat,
      {
        id: 'test-support',
        sdkVersion: chat.sdkVersion,
        requires: ['chat'],
        configSchema: chat.configSchema,
        async setup(ctx) {
          const authenticate = setupAnonymousSessions(ctx, '1'.repeat(64));
          ctx.chat = {
            async *stream(_messages, signal) {
              generated();
              yield { type: 'delta', data: { text: 'Teilantwort' } };
              await new Promise<void>((resolve) => {
                if (signal.aborted) resolve();
                else
                  signal.addEventListener('abort', () => resolve(), {
                    once: true,
                  });
              });
            },
          };
          await setupConversations(
            ctx,
            store,
            authenticate,
            false,
            async () => ({
              async send(job) {
                if (outage) throw new Error('offline');
                sent.push(job);
              },
              async close() {},
            }),
          );
        },
      },
    ],
  });
  apps.push(app);
  const first = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations/session' })
  ).json();
  const second = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations/session' })
  ).json();
  const headers = { authorization: `Bearer ${first.token}` };
  const c = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations', headers })
  ).json();
  const url = `/api/v1/conversations/${c.id}`;
  for (const auth of [undefined, `Bearer ${second.token}`])
    expect(
      (
        await app.inject({
          method: 'POST',
          url: url + '/request-support',
          headers: auth ? { authorization: auth } : {},
          payload: {},
        })
      ).statusCode,
    ).toBe(auth ? 404 : 401);
  expect(
    (
      await app.inject({
        method: 'POST',
        url: url + '/request-support',
        headers,
        payload: { targets: ['U111'] },
      })
    ).statusCode,
  ).toBe(400);
  await app.inject({
    method: 'POST',
    url: url + '/messages',
    headers,
    payload: { id: randomUUID(), content: 'Bitte helfen' },
  });
  await vi.waitFor(() => expect(generated).toHaveBeenCalledTimes(1));
  const waiting = await app.inject({
    method: 'POST',
    url: url + '/request-support',
    headers,
    payload: {},
  });
  expect(waiting.json().status).toBe('waiting');
  await app.inject({
    method: 'POST',
    url: url + '/request-support',
    headers,
    payload: {},
  });
  expect(store.jobs.filter((j) => j.kind === 'request')).toHaveLength(1);
  await app.inject({
    method: 'POST',
    url: url + '/messages',
    headers,
    payload: { id: randomUUID(), content: 'Weitere Details' },
  });
  expect(generated).toHaveBeenCalledTimes(1);
  await vi.waitFor(
    async () =>
      expect((await store.get(c.id))?.supportRequest?.notification).toBe(
        'failed',
      ),
    { timeout: 4000 },
  );
  outage = false;
  await vi.waitFor(
    async () =>
      expect((await store.get(c.id))?.supportRequest?.notification).toBe(
        'sent',
      ),
    { timeout: 5000 },
  );
  expect(sent.filter((j) => j.kind === 'request')).toHaveLength(1);
  const reload = (await app.inject({ url, headers })).json();
  expect(reload.status).toBe('waiting');
  expect(reload.messages.at(-1).content).toBe('Weitere Details');
});
it.skipIf(!process.env.CSP_TEST_DATABASE_URL)(
  'persists the waiting state and request delivery across a PostgreSQL runtime restart',
  async () => {
    let store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
    await store.init();
    const c = conversation(owner);
    try {
      await store.create(c);
      await store.change(c.id, (current, queue) =>
        requestSupport(current, ['U111'], queue),
      );
      await store.close();
      store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
      await store.init();
      expect((await store.get(c.id))?.status).toBe('waiting');
      const sent: Delivery[] = [];
      for (let i = 0; i < 3; i++)
        await store.drain(async (job) => {
          if (job.conversationId === c.id) sent.push(job);
        });
      expect(sent.filter((job) => job.kind === 'request')).toHaveLength(1);
      expect(sent.find((job) => job.kind === 'request')?.targets).toEqual([
        'U111',
      ]);
    } finally {
      await store.pool.query('DELETE FROM csp_conversations WHERE id=$1', [
        c.id,
      ]);
      await store.close();
    }
  },
);
