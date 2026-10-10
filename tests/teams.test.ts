import { it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { generateKeyPair, SignJWT } from 'jose';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import chat from '../packages/plugin-chat/src/server.js';
import teams, {
  setupConversations,
} from '../packages/plugin-teams/src/server.js';
import {
  MemoryStore,
  PostgresStore,
} from '../packages/plugin-teams/src/store.js';
import {
  action,
  conversation,
  append,
  owned,
  supportReply,
  type Identity,
} from '../packages/plugin-teams/src/conversations.js';
import {
  portalAuthenticator,
  supportAuthorizer,
} from '../packages/plugin-teams/src/auth.js';
import { configSchema } from '../packages/plugin-teams/src/config.js';
import { card } from '../packages/plugin-teams/src/teams.js';
const owner = { tenantId: 'tenant', userId: 'owner', name: 'Ada' },
  lena = { id: 'lena', name: 'Lena' },
  other = { id: 'other', name: 'Other' };
const env = {
  CSP_DEMO: 'true',
  CSP_TEAMS_DEMO: 'true',
  CSP_TEAMS_ENABLED: 'false',
};
const config = {
  ...publicConfig({ CSP_DEMO: 'true' }),
  chatSupport: { mode: 'demo' as const },
};
const eventually = async (load: () => Promise<boolean>) => {
  for (let i = 0; i < 100; i++) {
    if (await load()) return;
    await new Promise((r) => setTimeout(r, 10));
  }
  throw new Error('Condition timeout');
};
it('locks ownership, interrupts pending bot output and keeps other staff messages internal', async () => {
  const store = new MemoryStore(),
    c = conversation(owner);
  await store.create(c);
  await store.change(c.id, (current) => {
    current.generation = 'bot';
    append(current, {
      id: 'bot',
      kind: 'bot',
      content: 'Partial',
      complete: false,
    });
  });
  const results = await Promise.allSettled([
    store.change(c.id, (c, q) => action(c, 'take', lena, q)),
    store.change(c.id, (c, q) => action(c, 'take', other, q)),
  ]);
  expect(results.map((r) => r.status)).toEqual(['fulfilled', 'rejected']);
  let current = (await store.get(c.id))!;
  expect(current.generation).toBeUndefined();
  expect(current.messages[0]).toMatchObject({
    complete: true,
    content: 'Partial\n(Antwort unterbrochen)',
  });
  await store.change(c.id, (c, q) =>
    supportReply(c, other, 'internal', 'Internal discussion', q),
  );
  await store.change(c.id, (c, q) =>
    supportReply(c, lena, 'reply', 'Hallo!', q),
  );
  await store.change(c.id, (c, q) =>
    supportReply(c, lena, 'reply', 'Duplicate', q),
  );
  current = (await store.get(c.id))!;
  expect(current.messages.filter((m) => m.kind === 'support')).toHaveLength(1);
  expect(() => owned(current, { ...owner, userId: 'foreign' })).toThrow(
    'nicht gefunden',
  );
  expect(() => action(current, 'release', other, [])).toThrow('zuständige');
  await store.change(c.id, (c, q) => action(c, 'release', lena, q));
  expect((await store.get(c.id))?.status).toBe('bot');
  await store.change(c.id, (c, q) => action(c, 'take', lena, q));
  await store.change(c.id, (c, q) => action(c, 'close', lena, q));
  expect((await store.get(c.id))?.status).toBe('closed');
  expect(() =>
    action((current = { ...current, status: 'closed' }), 'take', lena, []),
  ).toThrow('abgeschlossen');
});
it('validates Entra signature, tenant, audience, expiry and delegated scope', async () => {
  const tenant = randomUUID(),
    user = randomUUID(),
    audience = randomUUID();
  const keys = await generateKeyPair('RS256');
  const verify = portalAuthenticator(
    tenant,
    audience,
    'Chat.Access',
    async () => keys.publicKey,
  );
  const token = async (claims: Record<string, unknown> = {}) =>
    new SignJWT({
      tid: tenant,
      oid: user,
      scp: 'Chat.Access',
      name: 'Ada',
      ...claims,
    })
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuedAt()
      .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
      .setAudience(audience)
      .setExpirationTime('5m')
      .sign(keys.privateKey);
  expect(await verify('Bearer ' + (await token()))).toMatchObject({
    tenantId: tenant,
    userId: user,
    name: 'Ada',
  });
  await expect(verify()).rejects.toMatchObject({ statusCode: 401 });
  await expect(
    verify('Bearer ' + (await token({ tid: randomUUID() }))),
  ).rejects.toMatchObject({ statusCode: 401 });
  await expect(
    verify('Bearer ' + (await token({ scp: 'Other.Access' }))),
  ).rejects.toMatchObject({ statusCode: 401 });
  await expect(
    portalAuthenticator(
      tenant,
      'wrong',
      'Chat.Access',
      async () => keys.publicKey,
    )('Bearer ' + (await token())),
  ).rejects.toMatchObject({ statusCode: 401 });
  const expired = await new SignJWT({
    tid: tenant,
    oid: user,
    scp: 'Chat.Access',
  })
    .setProtectedHeader({ alg: 'RS256' })
    .setIssuedAt()
    .setIssuer(`https://login.microsoftonline.com/${tenant}/v2.0`)
    .setAudience(audience)
    .setExpirationTime(1)
    .sign(keys.privateKey);
  await expect(verify('Bearer ' + expired)).rejects.toMatchObject({
    statusCode: 401,
  });
});
it('checks support membership on every message and denies Graph outages', async () => {
  const group = randomUUID(),
    user = randomUUID();
  let allowed = true;
  const fetcher = vi.fn(async (input: RequestInfo | URL) =>
    String(input).includes('/token')
      ? Response.json({ access_token: 'token', expires_in: 3600 })
      : Response.json({ value: allowed ? [group] : [] }),
  );
  const authorize = supportAuthorizer(
    randomUUID(),
    randomUUID(),
    'secret',
    group,
    fetcher,
  );
  expect(await authorize(user)).toBe(true);
  allowed = false;
  expect(await authorize(user)).toBe(false);
  expect(fetcher).toHaveBeenCalledTimes(3);
  expect(
    await supportAuthorizer(
      randomUUID(),
      randomUUID(),
      'secret',
      group,
      async () => {
        throw new Error('outage');
      },
    )(user),
  ).toBe(false);
});
it('exposes a resumable support demo, deduplicates questions, and enforces closure', async () => {
  const app = await createServer({ env, config, plugins: [teams, chat] });
  try {
    expect(
      (
        await app.inject({
          method: 'POST',
          url: '/api/v1/chat',
          payload: { messages: [{ role: 'user', content: 'Bypass' }] },
        })
      ).statusCode,
    ).toBe(409);
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    const message = { id: randomUUID(), content: 'Hallo' };
    const send = () =>
      app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${c.id}/messages`,
        payload: message,
      });
    expect((await send()).statusCode).toBe(202);
    expect((await send()).statusCode).toBe(202);
    await eventually(
      async () =>
        !(await app.inject(`/api/v1/conversations/${c.id}`))
          .json()
          .messages.some((m: { complete: boolean }) => !m.complete),
    );
    const demo = (action: string) =>
      app.inject({
        method: 'POST',
        url: `/api/v1/conversations/${c.id}/demo`,
        payload: { action },
      });
    expect((await demo('take')).statusCode).toBe(200);
    await demo('reply');
    let restored = (await app.inject(`/api/v1/conversations/${c.id}`)).json();
    expect(
      restored.messages.filter((m: { kind: string }) => m.kind === 'user'),
    ).toHaveLength(1);
    expect(restored.messages.at(-1)).toMatchObject({
      kind: 'support',
      name: 'Lena Demo',
    });
    await demo('release');
    expect(
      (await app.inject(`/api/v1/conversations/${c.id}`)).json().status,
    ).toBe('bot');
    await demo('take');
    await demo('close');
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/messages`,
          payload: { id: randomUUID(), content: 'Closed' },
        })
      ).statusCode,
    ).toBe(409);
    restored = (await app.inject('/api/v1/conversations')).json()[0];
    expect(restored.status).toBe('closed');
  } finally {
    await app.close();
  }
});
it('isolates API access by identity even when the conversation ID is known', async () => {
  const store = new MemoryStore();
  let identity: Identity = owner;
  const plugin = {
    ...teams,
    async setup(ctx: Parameters<typeof setupConversations>[0]) {
      await setupConversations(ctx, store, async () => identity, true);
    },
  };
  const app = await createServer({ env, config, plugins: [chat, plugin] });
  try {
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    identity = { ...owner, userId: 'another' };
    expect((await app.inject(`/api/v1/conversations/${c.id}`)).statusCode).toBe(
      404,
    );
    expect((await app.inject('/api/v1/conversations')).json()).toEqual([]);
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/messages`,
          payload: { id: randomUUID(), content: 'intrusion' },
        })
      ).statusCode,
    ).toBe(404);
  } finally {
    await app.close();
  }
});
it('recovers interrupted output after restart without returning support to the bot', async () => {
  const store = new MemoryStore(),
    c = conversation(owner);
  c.status = 'support';
  c.support = lena;
  c.generation = 'old';
  append(c, { id: 'old', kind: 'bot', content: 'Old output', complete: false });
  await store.create(c);
  const plugin = {
    ...teams,
    async setup(ctx: Parameters<typeof setupConversations>[0]) {
      await setupConversations(ctx, store, async () => owner, true);
    },
  };
  const app = await createServer({ env, config, plugins: [chat, plugin] });
  try {
    const recovered = (
      await app.inject(`/api/v1/conversations/${c.id}`)
    ).json();
    expect(recovered.status).toBe('support');
    expect(recovered.messages[0].complete).toBe(true);
  } finally {
    await app.close();
  }
});
it('fails closed for incomplete live config and forbids live demo mixing', () => {
  expect(configSchema.safeParse({ CSP_TEAMS_ENABLED: 'true' }).success).toBe(
    false,
  );
  expect(
    configSchema.safeParse({
      CSP_TEAMS_ENABLED: 'true',
      CSP_TEAMS_DEMO: 'true',
      CSP_DEMO: 'true',
    }).success,
  ).toBe(false);
  expect(card(conversation(owner)).actions[0].title).toBe('Übernehmen');
});
it.runIf(!!process.env.CSP_TEST_DATABASE_URL)(
  'persists transactions, ordered outbox retries, leases and retention in PostgreSQL',
  async () => {
    const store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
    await store.init();
    const c = conversation(owner);
    await store.create(c);
    try {
      const second = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
      await expect(second.init()).rejects.toThrow('Only one');
      await second.close();
      await store.change(c.id, (c, q) => action(c, 'take', lena, q));
      expect((await store.get(c.id))?.support).toEqual(lena);
      await store.drain(async () => {
        throw new Error('Teams unavailable');
      });
      const pending = await store.pool.query(
        'SELECT * FROM csp_teams_outbox WHERE conversation_id=$1 ORDER BY seq',
        [c.id],
      );
      expect(pending.rows).toHaveLength(3);
      expect(pending.rows[0].attempts).toBe(1);
      await store.pool.query(
        'UPDATE csp_teams_outbox SET next_at=now() WHERE conversation_id=$1',
        [c.id],
      );
      const sent: string[] = [];
      for (let i = 0; i < 4; i++)
        await store.drain(async (job) => {
          sent.push(job.kind);
        });
      expect(sent).toEqual(['create', 'message', 'card']);
      await store.pool.query(
        "UPDATE csp_conversations SET updated_at=now()-interval '31 days' WHERE id=$1",
        [c.id],
      );
      await store.purge(30);
      expect(await store.get(c.id)).toBeUndefined();
    } finally {
      await store.pool.query('DELETE FROM csp_conversations WHERE id=$1', [
        c.id,
      ]);
      await store.close();
    }
  },
);
it('stops model generation during takeover and keeps subsequent human questions out of the model', async () => {
  let calls = 0;
  const slowChat = {
    ...chat,
    setup(ctx: Parameters<typeof setupConversations>[0]) {
      ctx.chat = {
        async *stream(_messages, signal) {
          calls++;
          yield { type: 'delta', data: { text: 'Already visible'.repeat(10) } };
          await new Promise<void>((resolve) => {
            if (signal.aborted) resolve();
            else
              signal.addEventListener('abort', () => resolve(), { once: true });
          });
          if (!signal.aborted)
            yield { type: 'delta', data: { text: 'Too late' } };
        },
      };
    },
  };
  const app = await createServer({ env, config, plugins: [slowChat, teams] });
  try {
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${c.id}/messages`,
      payload: { id: randomUUID(), content: 'Help' },
    });
    await eventually(async () =>
      (await app.inject(`/api/v1/conversations/${c.id}`))
        .json()
        .messages.some(
          (m: { content: string }) =>
            m.content === 'Already visible'.repeat(10),
        ),
    );
    await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${c.id}/demo`,
      payload: { action: 'take' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${c.id}/messages`,
      payload: { id: randomUUID(), content: 'For Lena' },
    });
    const restored = (await app.inject(`/api/v1/conversations/${c.id}`)).json();
    expect(restored.status).toBe('support');
    expect(
      restored.messages.find((m: { kind: string }) => m.kind === 'bot').content,
    ).toBe('Already visible'.repeat(10) + '\n(Antwort unterbrochen)');
    expect(calls).toBe(1);
  } finally {
    await app.close();
  }
});
it('rejects malformed message input as 400', async () => {
  const app = await createServer({ env, config, plugins: [chat, teams] });
  try {
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    expect(
      (
        await app.inject({
          method: 'POST',
          url: `/api/v1/conversations/${c.id}/messages`,
          payload: { id: 'fake', content: 'invalid' },
        })
      ).statusCode,
    ).toBe(400);
  } finally {
    await app.close();
  }
});
it('streams support status and replies over a resumable authenticated SSE connection', async () => {
  const app = await createServer({ env, config, plugins: [chat, teams] });
  await app.listen({ host: '127.0.0.1', port: 0 });
  const address = app.server.address();
  if (!address || typeof address === 'string')
    throw new Error('Missing address');
  const base = `http://127.0.0.1:${address.port}`,
    controller = new AbortController();
  try {
    const c = (
      await app.inject({ method: 'POST', url: '/api/v1/conversations' })
    ).json();
    const response = await fetch(
      `${base}/api/v1/conversations/${c.id}/events?after=0`,
      { signal: controller.signal },
    );
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    const reader = response.body!.getReader();
    await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${c.id}/demo`,
      payload: { action: 'take' },
    });
    await app.inject({
      method: 'POST',
      url: `/api/v1/conversations/${c.id}/demo`,
      payload: { action: 'reply' },
    });
    let text = '';
    for (let i = 0; i < 10 && !text.includes('Hallo, ich bin Lena'); i++) {
      text += new TextDecoder().decode((await reader.read()).value);
    }
    expect(text).toContain('event: status');
    expect(text).toContain('Lena Demo');
    expect(text).toContain('Hallo, ich bin Lena');
    controller.abort();
    await reader.cancel().catch(() => {});
  } finally {
    controller.abort();
    await app.close();
  }
});
it('authenticates the actual Teams SDK HTTP endpoint before accepting activities', async () => {
  const { createTeamsBridge } =
    await import('../packages/plugin-teams/src/teams.js');
  const store = new MemoryStore();
  const cfg = configSchema.parse({
    CSP_TEAMS_ENABLED: 'true',
    CSP_CHAT_DATABASE_URL: 'postgresql://localhost/example',
    CSP_ENTRA_TENANT_ID: randomUUID(),
    CSP_ENTRA_API_AUDIENCE: randomUUID(),
    CSP_ENTRA_PORTAL_CLIENT_ID: randomUUID(),
    CSP_TEAMS_APP_ID: randomUUID(),
    CSP_TEAMS_APP_SECRET: 'test-only',
    CSP_TEAMS_TEAM_ID: 'team',
    CSP_TEAMS_CHANNEL_ID: 'channel',
    CSP_TEAMS_SUPPORT_GROUP_ID: randomUUID(),
  });
  const plugin = {
    ...teams,
    requires: [],
    configSchema: chat.configSchema,
    async setup(ctx: Parameters<typeof setupConversations>[0]) {
      const bridge = await createTeamsBridge(ctx.app, store, cfg, fetch);
      ctx.app.addHook('onClose', async () => bridge.close());
    },
  };
  const app = await createServer({
    env: { CSP_DEMO: 'true' },
    config: publicConfig({ CSP_DEMO: 'true' }),
    plugins: [plugin],
  });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/messages',
      payload: {
        type: 'message',
        channelId: 'msteams',
        serviceUrl: 'https://smba.trafficmanager.net/teams/',
        conversation: { id: 'channel' },
        from: { id: 'attacker' },
        text: 'take',
      },
    });
    expect(response.statusCode).toBe(401);
  } finally {
    await app.close();
  }
});
