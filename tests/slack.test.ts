import { afterEach, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import {
  MemoryStore,
  PostgresStore,
  conversation,
  append,
  delivery,
  setupConversations,
  type Conversation,
} from '../packages/core/src/support.js';
import chat from '../packages/plugin-chat/src/server.js';
import slack from '../packages/plugin-slack/src/server.js';
import { configSchema } from '../packages/plugin-slack/src/config.js';
import {
  createSlackBridge,
  verifySlackRequest,
  slackApi,
} from '../packages/plugin-slack/src/slack.js';
import {
  MemoryInbox,
  PostgresInbox,
  type Incoming,
} from '../packages/plugin-slack/src/inbox.js';

const config = configSchema.parse({
  CSP_SLACK_ENABLED: 'true',
  CSP_SLACK_BOT_TOKEN: 'xoxb-test-only',
  CSP_SLACK_SIGNING_SECRET: 'test-signing-secret-only',
  CSP_SLACK_TEAM_ID: 'T111',
  CSP_SLACK_CHANNEL_ID: 'C111',
  CSP_SLACK_APP_ID: 'A111',
  CSP_SLACK_SUPPORT_USER_IDS: 'U111,U222',
  CSP_CHAT_DATABASE_URL: 'postgresql://localhost/test',
  CSP_ENTRA_TENANT_ID: randomUUID(),
  CSP_ENTRA_API_AUDIENCE: randomUUID(),
  CSP_ENTRA_PORTAL_CLIENT_ID: randomUUID(),
});
const owner = {
  tenantId: 'tenant',
  userId: 'owner',
  name: 'Ada <@U111>',
  email: 'ada@example.test',
};
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
const ts = (offset = 0) => ((Date.now() + offset) / 1000).toFixed(6);
function signed(
  body: unknown,
  form = false,
  timestamp = String(Math.floor(Date.now() / 1000)),
) {
  const payload = form
    ? new URLSearchParams({ payload: JSON.stringify(body) }).toString()
    : JSON.stringify(body);
  return {
    payload,
    headers: {
      'content-type': form
        ? 'application/x-www-form-urlencoded'
        : 'application/json',
      'x-slack-request-timestamp': timestamp,
      'x-slack-signature':
        'v0=' +
        createHmac('sha256', config.CSP_SLACK_SIGNING_SECRET!)
          .update(`v0:${timestamp}:${payload}`)
          .digest('hex'),
    },
  };
}
function click(c: Conversation, action = 'take', user = 'U111', stamp = ts()) {
  return {
    type: 'block_actions',
    team: { id: 'T111' },
    api_app_id: 'A111',
    user: { id: user, name: 'Forged payload name' },
    channel: { id: 'C111' },
    container: {
      type: 'message',
      channel_id: 'C111',
      message_ts: c.thread!.rootId,
    },
    actions: [
      { type: 'button', action_id: action, value: c.id, action_ts: stamp },
    ],
  };
}
function message(
  c: Conversation,
  user = 'U111',
  text = 'Hallo, ich bin Lena.',
  stamp = ts(1000),
  id = randomUUID(),
) {
  return {
    type: 'event_callback',
    team_id: 'T111',
    api_app_id: 'A111',
    event_id: id,
    event: {
      type: 'message',
      channel: 'C111',
      user,
      ts: stamp,
      thread_ts: c.thread!.rootId,
      text,
    },
  };
}
async function fixture(runtime = false) {
  const store = new MemoryStore(),
    inbox = new MemoryInbox(),
    onTake = vi.fn();
  let members = ['U111', 'U222'],
    deleted = false,
    unavailable = false;
  const calls: { method: string; body: Record<string, any> }[] = [];
  const fetcher = vi.fn(
    async (input: string | URL | Request, options?: RequestInit) => {
      const method = String(input).split('/').at(-1)!,
        body = JSON.parse(String(options?.body ?? '{}'));
      calls.push({ method, body });
      if (unavailable && method === 'users.info')
        return new Response('{}', { status: 503 });
      const result: Record<string, unknown> =
        method === 'auth.test'
          ? { team_id: 'T111' }
          : method === 'conversations.info'
            ? { channel: { id: 'C111', is_member: true } }
            : method === 'users.info'
              ? {
                  user: {
                    id: body.user,
                    team_id: 'T111',
                    real_name:
                      body.user === 'U111' ? 'Lena Echt' : 'Andere Person',
                    deleted,
                    is_bot: false,
                    is_app_user: false,
                  },
                }
              : method === 'conversations.members'
                ? { members }
                : method === 'chat.postMessage'
                  ? { channel: 'C111', ts: '100.000001' }
                  : {};
      return new Response(JSON.stringify({ ok: true, ...result }), {
        headers: { 'Content-Type': 'application/json' },
      });
    },
  ) as typeof fetch;
  let bridge!: Awaited<ReturnType<typeof createSlackBridge>>;
  const configPublic = {
    ...publicConfig({ CSP_DEMO: 'true' }),
    chatSupport: { mode: 'slack' as const },
  };
  const app = await createServer({
    config: configPublic,
    env: { CSP_DEMO: 'true' },
    plugins: runtime
      ? [
          chat,
          {
            id: 'slack',
            sdkVersion: slack.sdkVersion,
            requires: ['chat'],
            configSchema,
            async setup(ctx) {
              await setupConversations(
                ctx,
                store,
                async () => owner,
                false,
                async (abort) =>
                  (bridge = await createSlackBridge(
                    ctx.app,
                    store,
                    config,
                    fetcher,
                    (id) => {
                      onTake(id);
                      abort(id);
                    },
                    inbox,
                  )),
              );
            },
          },
        ]
      : [],
  });
  if (!runtime)
    bridge = await createSlackBridge(
      app,
      store,
      config,
      fetcher,
      onTake,
      inbox,
    );
  await app.ready();
  cleanups.push(async () => {
    await app.close();
    await bridge.close();
  });
  const c = conversation(owner);
  c.thread = { conversationId: 'C111', rootId: '100.000001' };
  await store.create(c);
  return {
    app,
    store,
    inbox,
    c,
    bridge,
    onTake,
    calls,
    fetcher,
    setMembers: (value: string[]) => (members = value),
    setDeleted: (value: boolean) => (deleted = value),
    setUnavailable: (value: boolean) => (unavailable = value),
    async sendClick(payload = click(c)) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/slack/actions',
        ...signed(payload, true),
      });
      await bridge.drain();
      return r;
    },
    async sendMessage(payload = message(c)) {
      const r = await app.inject({
        method: 'POST',
        url: '/api/slack/events',
        ...signed(payload),
      });
      await bridge.drain();
      return r;
    },
  };
}
it('verifies raw-body HMAC and rejects stale, forged and malformed signatures', () => {
  const request = signed({ type: 'url_verification', challenge: 'hello' }),
    raw = Buffer.from(request.payload),
    h = request.headers;
  expect(
    verifySlackRequest(
      config.CSP_SLACK_SIGNING_SECRET!,
      raw,
      h['x-slack-request-timestamp'],
      h['x-slack-signature'],
    ),
  ).toBe(true);
  expect(
    verifySlackRequest(
      config.CSP_SLACK_SIGNING_SECRET!,
      Buffer.concat([raw, Buffer.from(' ')]),
      h['x-slack-request-timestamp'],
      h['x-slack-signature'],
    ),
  ).toBe(false);
  expect(
    verifySlackRequest(
      config.CSP_SLACK_SIGNING_SECRET!,
      raw,
      h['x-slack-request-timestamp'],
      h['x-slack-signature'],
      Date.now() + 301000,
    ),
  ).toBe(false);
  for (const signature of [undefined, [], 'v0=x', 'v1=' + '0'.repeat(64)])
    expect(
      verifySlackRequest(
        config.CSP_SLACK_SIGNING_SECRET!,
        raw,
        h['x-slack-request-timestamp'],
        signature,
      ),
    ).toBe(false);
});
it('supports Slack verification and preserves the normal portal JSON parser', async () => {
  const f = await fixture(true);
  const r = await f.app.inject({
    method: 'POST',
    url: '/api/slack/events',
    ...signed({ type: 'url_verification', challenge: 'slack-challenge' }),
  });
  expect(r.json()).toEqual({ challenge: 'slack-challenge' });
  expect(
    (await f.app.inject({ method: 'POST', url: '/api/v1/conversations' }))
      .statusCode,
  ).toBe(201);
  expect(
    (
      await f.app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${f.c.id}/messages`,
        payload: { id: randomUUID(), content: 'Hilfe' },
      })
    ).statusCode,
  ).toBe(202);
  const bad = signed({ type: 'url_verification', challenge: 'bad' });
  bad.payload += ' ';
  expect(
    (await f.app.inject({ method: 'POST', url: '/api/slack/events', ...bad }))
      .statusCode,
  ).toBe(401);
});
it('takes over atomically, interrupts the bot, forwards only assigned replies, deduplicates retries and returns/closes manually', async () => {
  const f = await fixture();
  await f.store.change(f.c.id, (c) => {
    c.generation = 'bot';
    append(c, { id: 'bot', kind: 'bot', content: 'Partial', complete: false });
  });
  const takeover = click(f.c, 'take', 'U111', ts(100));
  expect((await f.sendClick(takeover)).statusCode).toBe(200);
  let c = (await f.store.get(f.c.id))!;
  expect(c.status).toBe('support');
  expect(c.support).toEqual({ id: 'slack:T111:U111', name: 'Lena Echt' });
  expect(c.generation).toBeUndefined();
  expect(c.messages[0].complete).toBe(true);
  expect(f.onTake).toHaveBeenCalledWith(c.id);
  await f.sendClick(takeover);
  expect(f.onTake).toHaveBeenCalledTimes(1);
  await f.sendClick(click(f.c, 'take', 'U222', ts(200)));
  expect((await f.store.get(c.id))?.support?.name).toBe('Lena Echt');
  await f.sendMessage(message(c, 'U222', 'Interne Diskussion', ts(300)));
  await f.sendMessage(message(c, 'U111', 'Vor der Übernahme', ts(-1000)));
  const reply = message(c, 'U111', 'Hallo, ich bin Lena.', ts(400));
  await f.sendMessage(reply);
  await f.sendMessage(reply);
  c = (await f.store.get(c.id))!;
  expect(c.messages.filter((m) => m.kind === 'support')).toHaveLength(1);
  expect(c.messages.at(-1)?.name).toBe('Lena Echt');
  await f.sendClick(click(c, 'release', 'U222', ts(500)));
  expect((await f.store.get(c.id))?.status).toBe('support');
  await f.sendClick(click(c, 'release', 'U111', ts(600)));
  expect((await f.store.get(c.id))?.status).toBe('bot');
  await f.sendClick(click(c, 'take', 'U111', ts(200)));
  expect((await f.store.get(c.id))?.status).toBe('bot');
  await f.sendMessage(message(c, 'U111', 'Nach der Rückgabe', ts(700)));
  await f.sendClick(click(c, 'take', 'U111', ts(800)));
  await f.sendClick(click(c, 'close', 'U111', ts(900)));
  expect((await f.store.get(c.id))?.status).toBe('closed');
  await f.sendMessage(message(c, 'U111', 'Nach Abschluss', ts(1000)));
  expect(
    (await f.store.get(c.id))?.messages.filter((m) => m.kind === 'support'),
  ).toHaveLength(1);
});
it('checks allowlist, fresh channel membership and active workspace user, never payload names', async () => {
  const f = await fixture();
  await f.sendClick(click(f.c, 'take', 'U333'));
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  f.setMembers(['U222']);
  await f.sendClick(click(f.c, 'take', 'U111', ts(100)));
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  f.setMembers(['U111']);
  f.setDeleted(true);
  await f.sendClick(click(f.c, 'take', 'U111', ts(200)));
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  f.setDeleted(false);
  await f.sendClick(click(f.c, 'take', 'U111', ts(300)));
  f.setMembers([]);
  await f.sendMessage(message(f.c));
  expect(
    (await f.store.get(f.c.id))?.messages.some((m) => m.kind === 'support'),
  ).toBe(false);
  expect(
    f.calls.filter((c) => c.method === 'conversations.members').length,
  ).toBeGreaterThanOrEqual(3);
});
it('rejects foreign app, workspace, channel, forged mappings and ignores bots, edits and unknown threads', async () => {
  const f = await fixture();
  for (const change of [
    (p: ReturnType<typeof click>) => (p.team.id = 'T999'),
    (p: ReturnType<typeof click>) => (p.api_app_id = 'A999'),
    (p: ReturnType<typeof click>) => (p.channel.id = 'C999'),
    (p: ReturnType<typeof click>) => (p.container.channel_id = 'C999'),
  ]) {
    const p = click(f.c);
    change(p);
    expect((await f.sendClick(p)).statusCode).toBe(403);
  }
  const p = click(f.c);
  p.actions[0].value = randomUUID();
  expect((await f.sendClick(p)).statusCode).toBe(404);
  await f.sendClick();
  for (const extra of [
    { subtype: 'message_changed' },
    { subtype: 'bot_message' },
    { bot_id: 'B111' },
    { hidden: true },
    { thread_ts: '999.000001' },
    { channel: 'C999' },
    { ts: f.c.thread!.rootId },
  ]) {
    const e = message(f.c);
    Object.assign(e.event, extra);
    await f.sendMessage(e);
  }
  expect(
    (await f.store.get(f.c.id))?.messages.filter((m) => m.kind === 'support'),
  ).toHaveLength(0);
});
it('persists before acknowledgement, retries Slack outages and survives duplicate action delivery', async () => {
  const f = await fixture();
  f.setUnavailable(true);
  const p = click(f.c);
  expect((await f.sendClick(p)).statusCode).toBe(200);
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  expect([...f.inbox.jobs.values()].filter(Boolean)).toHaveLength(1);
  f.setUnavailable(false);
  await f.bridge.drain();
  expect((await f.store.get(f.c.id))?.status).toBe('support');
  await f.sendClick(p);
  expect(f.onTake).toHaveBeenCalledTimes(1);
  const failed = vi
    .spyOn(f.inbox, 'put')
    .mockRejectedValueOnce(new Error('Database unavailable'));
  expect((await f.sendMessage()).statusCode).toBe(500);
  failed.mockRestore();
});
it('mirrors portal users and completed bot answers into one thread without mentions or reply echoes', async () => {
  const f = await fixture(),
    c = conversation(owner);
  await f.store.create(c);
  await f.bridge.send({ id: c.id, conversationId: c.id, kind: 'create' }, c);
  const mapped = (await f.store.get(c.id))!;
  expect(mapped.thread).toEqual({
    conversationId: 'C111',
    rootId: '100.000001',
  });
  for (const kind of ['user', 'bot'] as const) {
    const m = {
      id: randomUUID(),
      kind,
      content: '<@U111> & <!channel> ' + 'a'.repeat(12000),
      complete: true,
    };
    await f.bridge.send(delivery(mapped, 'message', m), mapped);
  }
  const outgoing = f.calls.filter((c) => c.method === 'chat.postMessage');
  expect(outgoing).toHaveLength(3);
  expect(outgoing[0].body.blocks[1].text.type).toBe('plain_text');
  expect(outgoing[1].body.thread_ts).toBe(mapped.thread?.rootId);
  expect(outgoing[1].body.mrkdwn).toBe(false);
  expect(outgoing[1].body.text).toContain('&lt;@U111&gt;');
  expect(
    outgoing[2].body.blocks.every(
      (b: { text: { text: string } }) => Array.from(b.text.text).length <= 3000,
    ),
  ).toBe(true);
});
it('rejects incomplete runtime config, mixed demo/live and mismatched Slack workspace/channel', async () => {
  expect(configSchema.safeParse({ CSP_SLACK_ENABLED: 'true' }).success).toBe(
    false,
  );
  expect(
    configSchema.safeParse({ CSP_SLACK_DEMO: 'true', CSP_DEMO: 'false' })
      .success,
  ).toBe(false);
  expect(
    configSchema.safeParse({
      CSP_SLACK_DEMO: 'true',
      CSP_DEMO: 'true',
      CSP_SLACK_ENABLED: 'true',
    }).success,
  ).toBe(false);
  expect(
    configSchema.safeParse({
      ...config,
      CSP_SLACK_SUPPORT_USER_IDS: 'U111',
      CSP_CHAT_DATABASE_URL: 'https://example.test',
    }).success,
  ).toBe(false);
  expect(
    configSchema.safeParse({
      ...config,
      CSP_SLACK_SUPPORT_USER_IDS: 'U111,not-a-slack-id',
    }).success,
  ).toBe(false);
  const f = await fixture();
  for (const override of [
    { CSP_SLACK_TEAM_ID: 'T999' },
    { CSP_SLACK_CHANNEL_ID: 'C999' },
  ])
    await expect(
      createSlackBridge(
        f.app,
        f.store,
        { ...config, ...override },
        f.fetcher,
        () => {},
        new MemoryInbox(),
      ),
    ).rejects.toThrow('Slack');
});
it('runs a Slack-only synthetic portal through takeover, reply and bot return without a Slack connection', async () => {
  const app = await createServer({
    plugins: [chat, slack],
    config: {
      ...publicConfig({ CSP_DEMO: 'true' }),
      chatSupport: { mode: 'demo' },
    },
    env: { CSP_DEMO: 'true', CSP_SLACK_DEMO: 'true' },
  });
  cleanups.push(() => app.close());
  await app.ready();
  const c = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations' })
  ).json();
  expect(
    (
      await app.inject({
        method: 'POST',
        url: '/api/v1/chat',
        payload: { messages: [{ role: 'user', content: 'Help' }] },
      })
    ).statusCode,
  ).toBe(409);
  for (const action of ['take', 'reply', 'release', 'take', 'close'])
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/demo`,
          payload: { action },
        })
      ).statusCode,
    ).toBe(200);
  expect(
    (await app.inject({ url: `/api/v1/conversations/${c.id}` })).json().status,
  ).toBe('closed');
});
it.skipIf(!process.env.CSP_TEST_DATABASE_URL)(
  'keeps Slack callbacks across restarts and removes receipts with conversation retention',
  async () => {
    let store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
    await store.init();
    const c = conversation(owner);
    try {
      await store.create(c);
      const inbox = new PostgresInbox(store);
      await inbox.init();
      const job = {
        id: randomUUID(),
        conversationId: c.id,
        rootId: '100.000001',
        user: 'U111',
        timestamp: Date.now(),
        action: 'take' as const,
      };
      await inbox.put(job);
      await inbox.put(job);
      const handle = vi.fn(async (_job: Incoming) => {});
      await store.close();
      store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
      await store.init();
      const restarted = new PostgresInbox(store);
      await restarted.drain(handle);
      await restarted.put(job);
      await restarted.drain(handle);
      expect(
        handle.mock.calls.filter(([received]) => received.id === job.id),
      ).toHaveLength(1);
      expect(
        (
          await store.pool.query(
            'SELECT body FROM csp_slack_inbox WHERE id=$1',
            [job.id],
          )
        ).rows[0].body,
      ).toBeNull();
      await store.pool.query('DELETE FROM csp_conversations WHERE id=$1', [
        c.id,
      ]);
      expect(
        (
          await store.pool.query('SELECT id FROM csp_slack_inbox WHERE id=$1', [
            job.id,
          ])
        ).rows,
      ).toHaveLength(0);
    } finally {
      await store.pool.query('DELETE FROM csp_conversations WHERE id=$1', [
        c.id,
      ]);
      await store.close();
    }
  },
);
it('returns 503 within Slack acknowledgement deadline when durable storage stalls', async () => {
  const f = await fixture();
  let release!: () => void;
  const stalled = vi.spyOn(f.inbox, 'put').mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        release = resolve;
      }),
  );
  const start = performance.now();
  const response = await f.app.inject({
    method: 'POST',
    url: '/api/slack/actions',
    ...signed(click(f.c), true),
  });
  expect(response.statusCode).toBe(503);
  expect(performance.now() - start).toBeLessThan(3000);
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  release();
  stalled.mockRestore();
});
it('honors Retry-After without sleeping or repeatedly calling the Slack API', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response('{}', { status: 429, headers: { 'Retry-After': '60' } }),
  ) as typeof fetch;
  const api = slackApi(config, fetcher);
  await expect(api('chat.postMessage')).rejects.toThrow(
    'temporarily unavailable',
  );
  await expect(api('users.info')).rejects.toThrow('rate limit active');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
