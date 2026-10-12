import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import {
  setupAnonymousSessions,
  setupConversations,
  MemoryStore,
} from '../packages/core/src/support.js';
import chat from '../packages/plugin-chat/src/server.js';
import { configSchema } from '../packages/plugin-slack/src/config.js';

const apps: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => {
  vi.useRealTimers();
  for (const app of apps.splice(0)) await app.close();
});
async function setup() {
  const app = await createServer({
    plugins: [chat],
    config: publicConfig({}),
    env: { CSP_DEMO: 'true' },
  });
  apps.push(app);
  const authenticate = setupAnonymousSessions(
    { app } as Parameters<typeof setupAnonymousSessions>[0],
    '1'.repeat(64),
  );
  await setupConversations(
    {
      app,
      env: {},
      chat: {
        async *stream() {
          yield { type: 'done', data: {} } as const;
        },
      },
    } as unknown as Parameters<typeof setupConversations>[0],
    new MemoryStore(),
    authenticate,
    false,
    async () => ({ async send() {}, async close() {} }),
  );
  return app;
}
it('isolates anonymous conversations and rejects forged, absent and expired sessions', async () => {
  const app = await setup();
  const first = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations/session' })
  ).json();
  const second = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations/session' })
  ).json();
  const headers = { authorization: `Bearer ${first.token}` };
  const created = await app.inject({
    method: 'POST',
    url: '/api/v1/conversations',
    headers,
  });
  expect(created.statusCode).toBe(201);
  const path = `/api/v1/conversations/${created.json().id}`;
  for (const suffix of ['', '/events']) {
    expect(
      (
        await app.inject({
          url: path + suffix,
          headers: { authorization: `Bearer ${second.token}` },
        })
      ).statusCode,
    ).toBe(404);
  }
  expect(
    (
      await app.inject({
        method: 'POST',
        url: path + '/messages',
        headers: { authorization: `Bearer ${second.token}` },
        payload: { id: crypto.randomUUID(), content: 'wrong visitor' },
      })
    ).statusCode,
  ).toBe(404);
  for (const headers of [{ authorization: `Bearer ${second.token}` }, {}]) {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: path + '/resolve',
          headers,
          payload: {},
        })
      ).statusCode,
    ).toBe('authorization' in headers ? 404 : 401);
  }
  expect(
    (
      await app.inject({
        url: '/api/v1/conversations',
        headers: { authorization: `Bearer ${second.token}` },
      })
    ).json(),
  ).toEqual([]);
  for (const authorization of [
    undefined,
    `Bearer ${first.token.slice(0, -8)}forged12`,
  ])
    expect(
      (
        await app.inject({
          url: path,
          headers: authorization ? { authorization } : {},
        })
      ).statusCode,
    ).toBe(401);
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(first.expiresAt + 1000);
  expect((await app.inject({ url: path, headers })).statusCode).toBe(401);
});
it('limits anonymous session minting by IP independently of existing sessions', async () => {
  const app = await setup();
  for (let i = 0; i < 5; i++)
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/conversations/session',
        })
      ).statusCode,
    ).toBe(200);
  expect(
    (await app.inject({ method: 'POST', url: '/api/v1/conversations/session' }))
      .statusCode,
  ).toBe(429);
});
it('requires anonymous signing secrets and keeps Entra as the Slack default', () => {
  expect(configSchema.parse({}).CSP_SLACK_AUTH).toBe('entra');
  expect(
    configSchema.safeParse({
      CSP_SLACK_AUTH: 'anonymous',
      CSP_SLACK_ENABLED: 'true',
    }).success,
  ).toBe(false);
});
