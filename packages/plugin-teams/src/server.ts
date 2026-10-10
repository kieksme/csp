import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { ServerContext, ServerPlugin, ChatEvent } from '@kieksme/csp-sdk';
import { cspPlugin } from '../package.json';
import { configSchema } from './config.js';
import { MemoryStore, PostgresStore, type Store } from './store.js';
import { portalAuthenticator } from './auth.js';
import { createTeamsBridge } from './teams.js';
import {
  action,
  append,
  conversation,
  delivery,
  emit,
  interrupt,
  owned,
  supportReply,
  ChatError,
  type Identity,
  type Conversation,
  type Message,
} from './conversations.js';
export { configSchema } from './config.js';
const messageSchema = z
  .object({
    id: z.string().uuid(),
    content: z.string().trim().min(1).max(4000),
  })
  .strict();
const idSchema = z.object({ id: z.string().uuid() });
function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const parsed = schema.safeParse(input);
  if (!parsed.success) throw new ChatError(400, 'Ungültige Anfrage');
  return parsed.data;
}
function view(c: Conversation) {
  return {
    id: c.id,
    status: c.status,
    support: c.support,
    messages: c.messages,
    seq: c.events.at(-1)?.seq ?? 0,
    updatedAt: c.updatedAt,
  };
}
export async function setupConversations(
  ctx: ServerContext,
  store: Store,
  authenticate: (authorization?: string) => Promise<Identity>,
  demo: boolean,
) {
  if (!ctx.chat) throw new Error('Teams requires the chat engine');
  await store.init();
  const config = configSchema.parse(ctx.env);
  await store.purge(config.CSP_CHAT_RETENTION_DAYS);
  // Single runtime recovers unfinished model output after a crash. Never silently resume a bot in support mode.
  for (const c of await store.list())
    if (c.generation)
      await store.change(c.id, (current, queue) => interrupt(current, queue));
  const controllers = new Map<string, AbortController>();
  const connections = new Map<string, number>();
  const streams = new Set<() => void>();
  let closing = false;
  let activeGenerations = 0;
  async function generate(id: string, messageId: string) {
    const controller = new AbortController();
    controllers.set(id, controller);
    const timer = setTimeout(
      () => controller.abort(),
      Number(ctx.env.CSP_CHAT_TIMEOUT_MS ?? 60000),
    );
    try {
      const c = await store.get(id);
      if (!c || c.generation !== messageId || c.status !== 'bot') return;
      let history = c.messages
        .filter((m) => m.kind !== 'system' && m.id !== messageId && m.complete)
        .slice(-19)
        .map((m) => ({
          role: m.kind === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        }));
      while (
        history.reduce((n, m) => n + m.content.length, 0) > 16000 &&
        history.length > 1
      )
        history = history.slice(1);
      const persist = (event: ChatEvent) =>
        store.change(id, (current, queue) => {
          if (current.status !== 'bot' || current.generation !== messageId)
            return false;
          const message = current.messages.find((m) => m.id === messageId)!;
          if (event.type === 'delta') {
            const text = (event.data as { text: string }).text;
            if (message.content.length + text.length > 32000)
              throw new Error('Answer too long');
            message.content += text;
          } else if (event.type === 'responder')
            message.responder = event.data as Message['responder'];
          else if (event.type === 'sources')
            message.sources = event.data as Message['sources'];
          else {
            message.complete = true;
            delete current.generation;
            queue.push(delivery(current, 'message', message));
          }
          emit(current, 'message', message);
          return true;
        });
      let buffered = '',
        lastFlush = Date.now();
      for await (const event of ctx.chat!.stream(history, controller.signal)) {
        if (event.type === 'delta') {
          buffered += (event.data as { text: string }).text;
          if (buffered.length < 128 && Date.now() - lastFlush < 250) continue;
        }
        if (buffered) {
          const accepted = await persist({
            type: 'delta',
            data: { text: buffered },
          });
          buffered = '';
          lastFlush = Date.now();
          if (!accepted) {
            controller.abort();
            break;
          }
        }
        if (event.type !== 'delta' && !(await persist(event))) {
          controller.abort();
          break;
        }
      }
    } catch {
      await store
        .change(id, (c, queue) => {
          if (c.generation === messageId) interrupt(c, queue);
        })
        .catch(() => {});
    } finally {
      clearTimeout(timer);
      controllers.delete(id);
      activeGenerations--;
    }
  }
  const auth = (headers: { authorization?: string }) =>
    authenticate(headers.authorization);
  ctx.app.get('/api/v1/conversations', async (req) => {
    const owner = await auth(req.headers);
    return (await store.list(owner))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map(view);
  });
  ctx.app.post('/api/v1/conversations', async (req, reply) => {
    const owner = await auth(req.headers);
    if (
      (await store.list(owner)).filter((c) => c.status !== 'closed').length >=
      10
    )
      throw new ChatError(
        429,
        'Bitte schließen Sie zuerst ein laufendes Gespräch ab.',
      );
    const c = conversation(owner);
    await store.create(c);
    return reply.code(201).send(view(c));
  });
  ctx.app.get('/api/v1/conversations/:id', async (req) => {
    const { id } = validate(idSchema, req.params);
    return view(owned(await store.get(id), await auth(req.headers)));
  });
  const windows = new Map<string, { count: number; until: number }>();
  ctx.app.post('/api/v1/conversations/:id/messages', async (req, reply) => {
    const { id } = validate(idSchema, req.params),
      body = validate(messageSchema, req.body),
      owner = await auth(req.headers);
    const key = `${owner.tenantId}:${owner.userId}`,
      now = Date.now();
    for (const [k, w] of windows) if (w.until <= now) windows.delete(k);
    const window = windows.get(key) ?? { count: 0, until: now + 60000 };
    if (
      window.count >= Number(ctx.env.CSP_CHAT_RATE_LIMIT ?? 10) ||
      (windows.size >= 10000 && !windows.has(key))
    )
      throw new ChatError(429, 'Bitte warten Sie eine Minute.');
    let reserved = false;
    const generation = await store
      .change(id, (c, queue) => {
        owned(c, owner);
        if (c.messages.some((m) => m.id === body.id)) return undefined;
        if (c.status === 'closed')
          throw new ChatError(
            409,
            'Gespräch abgeschlossen. Bitte starten Sie einen neuen Chat.',
          );
        if (c.generation)
          throw new ChatError(
            409,
            'Bitte warten Sie auf die aktuelle Antwort.',
          );
        if (
          c.messages.length >= 500 ||
          c.messages.reduce((n, m) => n + m.content.length, 0) > 200000
        )
          throw new ChatError(409, 'Bitte starten Sie ein neues Gespräch.');
        if (
          c.status === 'bot' &&
          activeGenerations >= Number(ctx.env.CSP_CHAT_CONCURRENCY ?? 2)
        )
          throw new ChatError(429, 'Bitte versuchen Sie es gleich erneut.');
        const message: Message = {
          id: body.id,
          kind: 'user',
          content: body.content,
          complete: true,
        };
        append(c, message);
        queue.push(delivery(c, 'message', message));
        if (c.status !== 'bot') return undefined;
        const bot: Message = {
          id: randomUUID(),
          kind: 'bot',
          content: '',
          complete: false,
        };
        activeGenerations++;
        reserved = true;
        c.generation = bot.id;
        append(c, bot);
        return bot.id;
      })
      .catch((error) => {
        if (reserved) activeGenerations--;
        throw error;
      });
    window.count++;
    windows.set(key, window);
    if (generation) {
      if (!closing) void generate(id, generation);
      else activeGenerations--;
    }
    return reply.code(202).send({ accepted: true });
  });
  ctx.app.get('/api/v1/conversations/:id/events', async (req, reply) => {
    const { id } = validate(idSchema, req.params);
    const owner = await auth(req.headers);
    const query = validate(
      z.object({ after: z.coerce.number().int().min(0).default(0) }),
      req.query,
    );
    owned(await store.get(id), owner);
    const key = `${owner.tenantId}:${owner.userId}`;
    if ((connections.get(key) ?? 0) >= 3 || connections.size >= 1000)
      throw new ChatError(429, 'Zu viele offene Chat-Verbindungen.');
    connections.set(key, (connections.get(key) ?? 0) + 1);
    let after = query.after ?? 0;
    reply.hijack();
    reply.raw.writeHead(200, {
      ...(reply.getHeaders() as Record<string, string>),
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Accel-Buffering': 'no',
    });
    let ended = false,
      busy = false;
    const end = () => {
      if (ended) return;
      const count = (connections.get(key) ?? 1) - 1;
      if (count) connections.set(key, count);
      else connections.delete(key);
      ended = true;
      streams.delete(end);
      clearInterval(interval);
      clearTimeout(timeout);
      reply.raw.end();
    };
    const tick = async () => {
      if (ended || busy) return;
      busy = true;
      try {
        const c = owned(await store.get(id), owner);
        if (
          after < (c.events[0]?.seq ?? 1) - 1 ||
          after > (c.events.at(-1)?.seq ?? 0)
        ) {
          after = c.events.at(-1)?.seq ?? 0;
          reply.raw.write(
            `id: ${after}\nevent: snapshot\ndata: ${JSON.stringify(view(c))}\n\n`,
          );
        }
        for (const event of c.events)
          if (event.seq > after) {
            reply.raw.write(
              `id: ${event.seq}\nevent: ${event.type}\ndata: ${JSON.stringify(event.data)}\n\n`,
            );
            after = event.seq;
          }
        reply.raw.write(': heartbeat\n\n');
      } catch {
        end();
      } finally {
        busy = false;
      }
    };
    const interval = setInterval(() => void tick(), 1000),
      timeout = setTimeout(end, 240000);
    streams.add(end);
    reply.raw.on('close', end);
    void tick();
  });
  if (demo) {
    ctx.app.post('/api/v1/conversations/:id/demo', async (req) => {
      const { id } = validate(idSchema, req.params),
        owner = await auth(req.headers);
      const body = z
        .object({
          action: z.enum(['take', 'release', 'close', 'reply']),
          content: z.string().max(4000).optional(),
        })
        .parse(req.body);
      await store.change(id, (c, queue) => {
        owned(c, owner);
        const person = { id: 'demo-lena', name: 'Lena Demo' };
        if (body.action === 'reply')
          supportReply(
            c,
            person,
            randomUUID(),
            body.content ??
              'Hallo, ich bin Lena vom Support. Wie kann ich Ihnen helfen?',
            queue,
          );
        else action(c, body.action, person, queue);
      });
      if (body.action === 'take') controllers.get(id)?.abort();
      return { ok: true };
    });
  }
  const bridge = demo
    ? undefined
    : await createTeamsBridge(ctx.app, store, config, ctx.fetch, (id) =>
        controllers.get(id)?.abort(),
      );
  let working = false;
  const worker = async () => {
    if (working || closing) return;
    working = true;
    try {
      await store.drain(
        bridge?.send ??
          (async (job, c) => {
            if (job.kind === 'create')
              await store.change(c.id, (current) => {
                current.thread = { conversationId: 'demo', rootId: c.id };
              });
          }),
      );
    } catch {
      /* Retried next tick. No message contents or credentials in logs. */
    } finally {
      working = false;
    }
  };
  const interval = setInterval(() => void worker(), 2000),
    retention = setInterval(
      () => void store.purge(config.CSP_CHAT_RETENTION_DAYS).catch(() => {}),
      3600000,
    );
  void worker();
  ctx.app.addHook('preClose', async () => {
    closing = true;
    for (const end of streams) end();
    for (const controller of controllers.values()) controller.abort();
  });
  ctx.app.addHook('onClose', async () => {
    closing = true;
    clearInterval(interval);
    clearInterval(retention);
    for (const controller of controllers.values()) controller.abort();
    while (controllers.size || working)
      await new Promise((resolve) => setTimeout(resolve, 20));
    await bridge?.close();
    await store.close();
  });
}
export default {
  id: 'teams',
  sdkVersion: cspPlugin.sdkVersion,
  requires: ['chat'],
  configSchema,
  async setup(ctx) {
    const c = configSchema.parse(ctx.env),
      demo = c.CSP_TEAMS_DEMO === 'true';
    if (c.CSP_TEAMS_ENABLED !== 'true' && !demo) {
      if (ctx.config.chatSupport)
        throw new Error(
          'Profile requires support, but runtime support is disabled',
        );
      return;
    }
    if (ctx.config.chatSupport?.mode !== (demo ? 'demo' : 'teams'))
      throw new Error('Frontend and runtime support modes differ');
    if (
      !demo &&
      (ctx.config.chatSupport.tenantId !== c.CSP_ENTRA_TENANT_ID ||
        ctx.config.chatSupport.clientId !== c.CSP_ENTRA_PORTAL_CLIENT_ID ||
        ctx.config.chatSupport.scope !==
          `api://${c.CSP_ENTRA_API_AUDIENCE}/${c.CSP_ENTRA_API_SCOPE}`)
    )
      throw new Error('Entra frontend and API configuration differ');
    const store = demo
      ? new MemoryStore()
      : new PostgresStore(c.CSP_CHAT_DATABASE_URL!);
    const authenticate = demo
      ? async () => ({
          tenantId: 'demo',
          userId: 'demo-user',
          name: 'Portal-Nutzer Demo',
        })
      : portalAuthenticator(
          c.CSP_ENTRA_TENANT_ID!,
          c.CSP_ENTRA_API_AUDIENCE!,
          c.CSP_ENTRA_API_SCOPE,
        );
    try {
      await setupConversations(ctx, store, authenticate, demo);
    } catch (e) {
      await store.close();
      throw e;
    }
  },
} satisfies ServerPlugin;
