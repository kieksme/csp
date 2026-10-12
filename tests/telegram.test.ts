import { afterEach, expect, it, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import {
  MemoryStore,
  PostgresStore,
  conversation,
  append,
  delivery,
  requestSupport,
  setupConversations,
} from '../packages/core/src/support.js';
import chat from '../packages/plugin-chat/src/server.js';
import telegram from '../packages/plugin-telegram/src/server.js';
import { configSchema } from '../packages/plugin-telegram/src/config.js';
import {
  createTelegramBridge,
  telegramApi,
  verifyTelegramSecret,
} from '../packages/plugin-telegram/src/telegram.js';
import {
  MemoryInbox,
  PostgresInbox,
} from '../packages/plugin-telegram/src/inbox.js';

const config = configSchema.parse({
  CSP_TELEGRAM_ENABLED: 'true',
  CSP_TELEGRAM_AUTH: 'anonymous',
  CSP_TELEGRAM_BOT_TOKEN: '123456:synthetic-token-not-a-real-secret',
  CSP_TELEGRAM_WEBHOOK_SECRET: 'a'.repeat(32),
  CSP_TELEGRAM_CHAT_ID: '-100123456789',
  CSP_TELEGRAM_SUPPORT_USER_IDS: '111,222',
  CSP_CHAT_SESSION_SECRET: 'b'.repeat(64),
  CSP_CHAT_DATABASE_URL: 'postgresql://localhost/test',
});
const owner = {
  tenantId: 'anonymous',
  userId: randomUUID(),
  name: 'Besucher Test',
};
const cleanups: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanups.splice(0).reverse()) await close();
});
async function fixture() {
  const store = new MemoryStore(),
    inbox = new MemoryInbox(),
    onTake = vi.fn();
  let membership = 'member',
    outage = false,
    nextMessage = 50,
    failCard = false;
  const calls: { method: string; body: Record<string, any> }[] = [];
  const fetcher = vi.fn(
    async (input: string | URL | Request, options?: RequestInit) => {
      const method = String(input).split('/').at(-1)!,
        body = JSON.parse(String(options?.body ?? '{}'));
      calls.push({ method, body });
      if (outage && method === 'getChatMember' && body.user_id !== 999)
        return new Response('{}', { status: 503 });
      if (failCard && method === 'sendMessage') {
        failCard = false;
        return new Response('{}', { status: 503 });
      }
      const user = {
        id: body.user_id ?? 999,
        is_bot: (body.user_id ?? 999) === 999,
        first_name: body.user_id === 222 ? 'Andere Person' : 'Lena Echt',
      };
      const result =
        method === 'getMe'
          ? user
          : method === 'getChat'
            ? { id: -100123456789, type: 'supergroup', is_forum: true }
            : method === 'getChatMember'
              ? {
                  user,
                  status: body.user_id === 999 ? 'administrator' : membership,
                  can_manage_topics: true,
                }
              : method === 'createForumTopic'
                ? { message_thread_id: 42 }
                : method === 'sendMessage'
                  ? { message_id: nextMessage++ }
                  : true;
      return new Response(JSON.stringify({ ok: true, result }));
    },
  ) as typeof fetch;
  const app = await createServer({
    plugins: [],
    config: publicConfig({ CSP_DEMO: 'true' }),
    env: { CSP_DEMO: 'true' },
  });
  const bridge = await createTelegramBridge(
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
  c.thread = {
    conversationId: 'telegram:-100123456789',
    rootId: '42',
    serviceUrl: '50',
  };
  await store.create(c);
  let update = 100;
  const user = (id = 111) => ({
    id,
    is_bot: false,
    first_name: 'Untrusted Name',
  });
  const m = () => ({
    message_id: 50,
    date: 100,
    chat: { id: -100123456789, type: 'supergroup' },
    message_thread_id: 42,
    from: { ...user(999), is_bot: true },
    text: 'Card',
  });
  const click = (action = 'take', id = 111) => ({
    update_id: update++,
    callback_query: {
      id: randomUUID(),
      from: user(id),
      data: `${action}:${c.id}`,
      message: m(),
    },
  });
  const message = (text = 'Hallo, ich bin Lena.', id = 111) => ({
    update_id: update++,
    message: { ...m(), message_id: update, from: user(id), text },
  });
  const send = async (
    payload: Record<string, unknown>,
    secret: unknown = config.CSP_TELEGRAM_WEBHOOK_SECRET,
  ) => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/telegram/webhook',
      headers: { 'x-telegram-bot-api-secret-token': secret as string },
      payload,
    });
    await bridge.drain();
    return response;
  };
  return {
    store,
    c,
    inbox,
    bridge,
    app,
    calls,
    onTake,
    click,
    message,
    send,
    setMembership: (v: string) => (membership = v),
    setOutage: (v: boolean) => (outage = v),
    failNextCard: () => (failCard = true),
  };
}
it('rejects missing/forged webhook secrets and validates runtime requirements', async () => {
  expect(verifyTelegramSecret('abc', 'abc')).toBe(true);
  for (const v of ['bad', undefined, [], 'abcd'])
    expect(verifyTelegramSecret('abc', v)).toBe(false);
  expect(configSchema.safeParse({ CSP_TELEGRAM_ENABLED: 'true' }).success).toBe(
    false,
  );
  for (const overrides of [
    { CSP_TELEGRAM_CHAT_ID: '123' },
    { CSP_TELEGRAM_SUPPORT_USER_IDS: 'abc' },
    { CSP_CHAT_SESSION_SECRET: '' },
    { CSP_TELEGRAM_DEMO: 'true' },
  ])
    expect(
      configSchema.safeParse({
        ...config,
        CSP_TELEGRAM_SUPPORT_USER_IDS: '111',
        ...overrides,
      }).success,
    ).toBe(false);
  const f = await fixture();
  expect((await f.send(f.click(), 'wrong')).statusCode).toBe(401);
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
});
it('interrupts bot output, authorizes assigned replies, deduplicates callbacks and returns/closes manually', async () => {
  const f = await fixture();
  await f.store.change(f.c.id, (c) => {
    c.generation = 'bot';
    append(c, { id: 'bot', kind: 'bot', content: 'Partial', complete: false });
  });
  const take = f.click();
  await f.send(take);
  await f.send(take);
  let c = (await f.store.get(f.c.id))!;
  expect(c.status).toBe('support');
  expect(c.support?.name).toBe('Lena Echt');
  expect(c.generation).toBeUndefined();
  expect(c.messages[0].content).toContain('unterbrochen');
  expect(f.onTake).toHaveBeenCalledTimes(1);
  await f.send(f.click('take', 222));
  await f.send(f.message('Interne Diskussion', 222));
  const reply = f.message();
  await f.send(reply);
  await f.send(reply);
  expect(
    (await f.store.get(c.id))?.messages.filter((m) => m.kind === 'support'),
  ).toHaveLength(1);
  await f.send(f.click('release', 222));
  expect((await f.store.get(c.id))?.status).toBe('support');
  await f.send(f.click('release'));
  expect((await f.store.get(c.id))?.status).toBe('bot');
  await f.send(f.message('Nach Rückgabe'));
  await f.send(f.click());
  await f.send(f.click('close'));
  c = (await f.store.get(c.id))!;
  expect(c.status).toBe('closed');
  expect(c.messages.filter((m) => m.kind === 'support')).toHaveLength(1);
});
it('checks fresh membership and ignores bots, forwards, foreign topics and forged card mappings', async () => {
  const f = await fixture();
  await f.send(f.click('take', 333));
  f.setMembership('left');
  await f.send(f.click());
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  f.setMembership('member');
  for (const mutate of [
    (p: ReturnType<typeof f.click>) =>
      (p.callback_query.message.chat.id = -100999999999),
    (p: ReturnType<typeof f.click>) =>
      (p.callback_query.message.message_thread_id = 77),
    (p: ReturnType<typeof f.click>) =>
      (p.callback_query.message.message_id = 444),
    (p: ReturnType<typeof f.click>) =>
      (p.callback_query.data = `take:${randomUUID()}`),
  ]) {
    const p = f.click();
    mutate(p);
    await f.send(p);
  }
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  await f.send(f.click());
  for (const extra of [
    { sender_chat: { id: 111 } },
    { forward_origin: {} },
    { via_bot: {} },
    { from: { id: 111, is_bot: true, first_name: 'Bot' } },
    { message_thread_id: 77 },
  ]) {
    const p = f.message();
    Object.assign(p.message, extra);
    await f.send(p);
  }
  f.setMembership('kicked');
  await f.send(f.message());
  expect(
    (await f.store.get(f.c.id))?.messages.some((m) => m.kind === 'support'),
  ).toBe(false);
});
it('persists before acknowledgement, retries outages and does not acknowledge failed storage', async () => {
  const f = await fixture();
  f.setOutage(true);
  expect((await f.send(f.click())).statusCode).toBe(200);
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
  expect([...f.inbox.jobs.values()].filter(Boolean)).toHaveLength(1);
  f.setOutage(false);
  await f.bridge.drain();
  expect((await f.store.get(f.c.id))?.status).toBe('support');
  vi.spyOn(f.inbox, 'put').mockRejectedValueOnce(new Error('DB unavailable'));
  expect((await f.send(f.message())).statusCode).toBe(500);
});
it('maps topics durably before card delivery and retries the card without creating another topic', async () => {
  const f = await fixture(),
    c = conversation(owner);
  await f.store.create(c);
  f.failNextCard();
  const job = delivery(c, 'create');
  await expect(f.bridge.send(job, c)).rejects.toThrow();
  const mapped = (await f.store.get(c.id))!;
  expect(mapped.thread?.rootId).toBe('42');
  await f.bridge.send(job, mapped);
  expect(f.calls.filter((c) => c.method === 'createForumTopic')).toHaveLength(
    1,
  );
  const current = (await f.store.get(c.id))!;
  expect(current.thread?.serviceUrl).toBeDefined();
  await f.bridge.send(
    delivery(current, 'message', {
      id: randomUUID(),
      kind: 'bot',
      content: '💚'.repeat(9000),
      complete: true,
    }),
    current,
  );
  const messages = f.calls.filter(
    (c) => c.method === 'sendMessage' && c.body.link_preview_options,
  );
  expect(messages.length).toBeGreaterThan(1);
  expect(messages.map((c) => c.body.text).join('')).toBe(
    'Digitaler Assistent\n' + '💚'.repeat(9000),
  );
  expect(
    messages.every(
      (c) =>
        c.body.text.length <= 3500 &&
        c.body.message_thread_id === 42 &&
        !c.body.parse_mode,
    ),
  ).toBe(true);
});
it('handles rate limits without leaking credential URLs and accepts unchanged card edits', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response(
        JSON.stringify({
          ok: false,
          error_code: 429,
          parameters: { retry_after: 60 },
        }),
        { status: 429 },
      ),
  ) as typeof fetch;
  const api = telegramApi(config, fetcher);
  await expect(api('sendMessage')).rejects.toThrow('request failed');
  await expect(api('getChatMember')).rejects.toThrow('rate limit');
  expect(fetcher).toHaveBeenCalledTimes(1);
  await expect(
    telegramApi(config, (async () => {
      throw new Error('token URL secret');
    }) as typeof fetch)('getMe'),
  ).rejects.toThrow('temporarily unavailable');
  expect(
    await telegramApi(
      config,
      (async () =>
        new Response(
          JSON.stringify({
            ok: false,
            error_code: 400,
            description: 'Bad Request: message is not modified',
          }),
          { status: 400 },
        )) as typeof fetch,
    )('editMessageText'),
  ).toBe(true);
});
it('runs a Telegram-only anonymous-free synthetic demo through the shared conversation lifecycle', async () => {
  const app = await createServer({
    plugins: [chat, telegram],
    config: {
      ...publicConfig({ CSP_DEMO: 'true' }),
      chatSupport: { mode: 'demo' },
    },
    env: { CSP_DEMO: 'true', CSP_TELEGRAM_DEMO: 'true' },
  });
  cleanups.push(() => app.close());
  const c = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations' })
  ).json();
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
  'retains Telegram receipts across restarts and deletes them with conversation retention',
  async () => {
    let store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
    await store.init();
    const c = conversation(owner);
    await store.create(c);
    const job = {
      id: randomUUID(),
      conversationId: c.id,
      rootId: '42',
      user: '111',
      timestamp: 1,
      action: 'take' as const,
    };
    try {
      const inbox = new PostgresInbox(store);
      await inbox.init();
      await inbox.put(job);
      await inbox.put(job);
      await store.close();
      store = new PostgresStore(process.env.CSP_TEST_DATABASE_URL!);
      await store.init();
      const restarted = new PostgresInbox(store),
        handler = vi.fn(async () => {});
      await restarted.drain(handler);
      await restarted.put(job);
      await restarted.drain(handler);
      expect(handler).toHaveBeenCalledTimes(1);
      await store.pool.query('DELETE FROM csp_conversations WHERE id=$1', [
        c.id,
      ]);
      expect(
        (
          await store.pool.query(
            'SELECT id FROM csp_telegram_inbox WHERE id=$1',
            [job.id],
          )
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

it('allows Telegram update sequence reset after a week without replaying old receipts', async () => {
  const f = await fixture();
  const first = f.click();
  await f.send(first);
  await f.store.change(f.c.id, (c) => {
    c.supportActionAt = 999999;
    c.supportSince = 999999;
    c.thread!.lastUpdateAt = Date.now() - 8 * 86400000;
  });
  const reply = f.message('Antwort nach einer Woche');
  await f.send(reply);
  expect((await f.store.get(f.c.id))?.messages.at(-1)?.content).toBe(
    'Antwort nach einer Woche',
  );
  await f.send(f.click('release'));
  await f.send(first);
  expect((await f.store.get(f.c.id))?.status).toBe('bot');
});

it('acknowledges Telegram text above the portal limit without blocking subsequent updates', async () => {
  const f = await fixture();
  await f.send(f.click());
  expect((await f.send(f.message('a'.repeat(4096)))).statusCode).toBe(200);
  expect(
    (await f.store.get(f.c.id))?.messages.some((m) => m.kind === 'support'),
  ).toBe(false);
  expect(
    f.calls.some(
      (c) =>
        c.method === 'sendMessage' &&
        String(c.body.text).includes('nicht weitergeleitet'),
    ),
  ).toBe(true);
  await f.send(f.message('Eine gültige Antwort'));
  expect((await f.store.get(f.c.id))?.messages.at(-1)?.content).toBe(
    'Eine gültige Antwort',
  );
});

it('notifies only authorized Telegram members and permits takeover from the recorded request card', async () => {
  const f = await fixture();
  await f.bridge.send(
    delivery(f.c, 'message', {
      id: randomUUID(),
      kind: 'user',
      content: 'Vorherige Nachricht',
      complete: true,
    }),
    f.c,
  );
  await f.store.change(f.c.id, (c, queue) =>
    requestSupport(c, ['111', '999999'], queue),
  );
  const job = f.store.jobs.find((job) => job.kind === 'request')!;
  await f.bridge.send(job, (await f.store.get(f.c.id))!);
  const posted = f.calls.findLast(
    (call) => call.method === 'sendMessage',
  )!.body;
  expect(posted.entities).toHaveLength(1);
  expect(posted.entities[0].user.id).toBe(111);
  const current = (await f.store.get(f.c.id))!;
  const click = f.click();
  click.callback_query.message.message_id = Number(
    current.supportRequest!.messageId,
  );
  await f.send(click);
  expect((await f.store.get(f.c.id))?.status).toBe('support');
  const assigned = (await f.store.get(f.c.id))!;
  await f.bridge.send(delivery(assigned, 'card'), assigned);
  const updated = f.calls.findLast(
    (call) =>
      call.method === 'editMessageText' &&
      String(call.body.message_id) === assigned.supportRequest!.messageId,
  )!.body;
  expect(updated.text).toContain('übernommen');
  expect(updated.reply_markup.inline_keyboard).toEqual([]);
});
