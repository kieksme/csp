import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import {
  action,
  supportReply,
  ChatError,
  type Conversation,
  type Delivery,
  type Store,
  type SupportPerson,
} from '@kieksme/csp-core/support';
import type { SlackConfig } from './config.js';
import { inboxFor, type Inbox, type Incoming } from './inbox.js';

export function verifySlackRequest(
  secret: string,
  raw: Buffer,
  timestamp: unknown,
  signature: unknown,
  now = Date.now(),
) {
  if (
    typeof timestamp !== 'string' ||
    !/^\d+$/.test(timestamp) ||
    typeof signature !== 'string' ||
    !/^v0=[a-f0-9]{64}$/.test(signature)
  )
    return false;
  if (Math.abs(now / 1000 - Number(timestamp)) > 300) return false;
  const digest =
    'v0=' +
    createHmac('sha256', secret)
      .update(`v0:${timestamp}:`)
      .update(raw)
      .digest('hex');
  return timingSafeEqual(Buffer.from(digest), Buffer.from(signature));
}
const timestamp = z.string().regex(/^\d{1,12}\.\d{6}$/);
const userId = z.string().regex(/^[UW][A-Z0-9]{2,}$/);
const eventSchema = z.object({
  type: z.literal('event_callback'),
  team_id: z.string(),
  api_app_id: z.string(),
  event_id: z.string().min(1).max(100),
  is_ext_shared_channel: z.boolean().optional(),
  event: z.object({
    type: z.string(),
    channel: z.string().optional(),
    user: userId.optional(),
    ts: timestamp.optional(),
    thread_ts: timestamp.optional(),
    text: z.string().max(4000).optional(),
    subtype: z.string().optional(),
    bot_id: z.string().optional(),
    hidden: z.boolean().optional(),
  }),
});
const actionSchema = z.object({
  type: z.literal('block_actions'),
  team: z.object({ id: z.string() }),
  api_app_id: z.string(),
  user: z.object({ id: userId }),
  channel: z.object({ id: z.string() }),
  container: z.object({
    type: z.literal('message'),
    message_ts: timestamp,
    channel_id: z.string(),
  }),
  actions: z.tuple([
    z.object({
      type: z.literal('button'),
      action_id: z.enum(['take', 'release', 'close', 'resolve']),
      value: z.string().uuid(),
      action_ts: timestamp,
    }),
  ]),
});
const plain = (text: string) => ({ type: 'plain_text', text, emoji: false });
export function card(c: Conversation) {
  const status =
    c.status === 'bot'
      ? 'Digitaler Assistent'
      : c.status === 'closed'
        ? c.resolution
          ? 'Problem gelöst'
          : 'Abgeschlossen'
        : `Support: ${c.support?.name}`;
  return [
    { type: 'header', text: plain('Portal-Support') },
    {
      type: 'section',
      text: plain(
        `Portal-Nutzer: ${c.owner.name}\n${c.owner.email ?? ''}\nGespräch: ${c.id}\nStatus: ${status}`,
      ),
    },
    ...(c.status === 'closed'
      ? []
      : [
          {
            type: 'actions',
            elements: (c.status === 'bot'
              ? [
                  ['take', 'Übernehmen'],
                  ['resolve', 'Problem gelöst'],
                ]
              : [
                  ['release', 'An Bot zurückgeben'],
                  ['close', 'Abschließen'],
                  ['resolve', 'Problem gelöst'],
                ]
            ).map(([id, label]) => ({
              type: 'button',
              text: plain(label),
              action_id: id,
              value: c.id,
            })),
          },
        ]),
  ];
}
// Untrusted portal text never becomes Slack formatting, a mention, or a link preview.
function messageBlocks(text: string) {
  const chunks: string[] = [];
  // Preserve Unicode code points when chunking Slack's 3000-character section limit.
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i += 2800)
    chunks.push(chars.slice(i, i + 2800).join(''));
  return chunks.map((chunk) => ({ type: 'section', text: plain(chunk) }));
}
const escape = (text: string) =>
  text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const apiResult = z.object({
  ok: z.literal(true),
  team_id: z.string().optional(),
  channel: z
    .union([
      z.string(),
      z.object({
        id: z.string(),
        is_member: z.boolean().optional(),
        is_archived: z.boolean().optional(),
        is_ext_shared: z.boolean().optional(),
      }),
    ])
    .optional(),
  ts: z.string().optional(),
  user: z
    .union([
      z.string(),
      z.object({
        id: z.string(),
        team_id: z.string(),
        deleted: z.boolean(),
        is_bot: z.boolean(),
        is_app_user: z.boolean(),
        real_name: z.string().nullish(),
        profile: z.object({ real_name: z.string().nullish() }).optional(),
      }),
    ])
    .optional(),
  members: z.array(z.string()).optional(),
  response_metadata: z
    .object({ next_cursor: z.string().optional() })
    .optional(),
});
export function slackApi(config: SlackConfig, fetcher: typeof fetch = fetch) {
  let blockedUntil = 0;
  return async (method: string, body: Record<string, unknown> = {}) => {
    if (Date.now() < blockedUntil) throw new Error('Slack rate limit active');
    const read = [
      'auth.test',
      'users.info',
      'conversations.info',
      'conversations.members',
    ].includes(method);
    const url = new URL(`https://slack.com/api/${method}`);
    if (read)
      for (const [key, value] of Object.entries(body))
        url.searchParams.set(key, String(value));
    const response = await fetcher(url, {
      method: read ? 'GET' : 'POST',
      headers: {
        Authorization: `Bearer ${config.CSP_SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: read ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 429) {
      const seconds = Number(response.headers.get('Retry-After'));
      blockedUntil =
        Date.now() +
        Math.min(86400, Math.max(1, Number.isFinite(seconds) ? seconds : 60)) *
          1000;
    }
    if (!response.ok) throw new Error('Slack API temporarily unavailable');
    const result = apiResult.safeParse(await response.json());
    if (!result.success) throw new Error('Slack API request failed');
    return result.data;
  };
}
export function supportAuthorizer(
  config: SlackConfig,
  api: ReturnType<typeof slackApi>,
) {
  return async (id: string): Promise<SupportPerson | undefined> => {
    if (!config.CSP_SLACK_SUPPORT_USER_IDS?.includes(id)) return;
    const { user } = await api('users.info', { user: id });
    if (
      !user ||
      typeof user === 'string' ||
      user.id !== id ||
      user.team_id !== config.CSP_SLACK_TEAM_ID ||
      user.deleted ||
      user.is_bot ||
      user.is_app_user
    )
      return;
    let cursor = '',
      member = false;
    // Fresh membership for every action and reply; never authorize from a payload name.
    for (let page = 0; page < 100; page++) {
      const result = await api('conversations.members', {
        channel: config.CSP_SLACK_CHANNEL_ID,
        limit: 200,
        ...(cursor ? { cursor } : {}),
      });
      if (!Array.isArray(result.members))
        throw new Error('Invalid Slack membership response');
      if (result.members.includes(id)) {
        member = true;
        break;
      }
      cursor = result.response_metadata?.next_cursor ?? '';
      if (!cursor) break;
    }
    if (!member) return;
    const name = user.profile?.real_name || user.real_name;
    if (typeof name !== 'string' || !name.trim()) return;
    return {
      id: `slack:${config.CSP_SLACK_TEAM_ID}:${id}`,
      name: name.trim().slice(0, 200),
    };
  };
}
export async function createSlackBridge(
  app: FastifyInstance,
  store: Store,
  config: SlackConfig,
  fetcher: typeof fetch = fetch,
  onTake: (id: string) => void = () => {},
  inbox: Inbox = inboxFor(store),
) {
  const api = slackApi(config, fetcher),
    authorize = supportAuthorizer(config, api);
  const identity = await api('auth.test');
  if (identity.team_id !== config.CSP_SLACK_TEAM_ID)
    throw new Error('Slack bot belongs to another workspace');
  const info = await api('conversations.info', {
    channel: config.CSP_SLACK_CHANNEL_ID,
  });
  if (
    !info.channel ||
    typeof info.channel === 'string' ||
    info.channel.id !== config.CSP_SLACK_CHANNEL_ID ||
    !info.channel.is_member ||
    info.channel.is_archived ||
    info.channel.is_ext_shared
  )
    throw new Error(
      'Slack channel must be active, internal and contain the bot',
    );
  await inbox.init();
  let working = false,
    closing = false;
  const process = async (job: Incoming) => {
    const person = await authorize(job.user);
    if (!person) {
      await api('chat.postEphemeral', {
        channel: config.CSP_SLACK_CHANNEL_ID,
        user: job.user,
        text: 'Keine Supportberechtigung. Freigabe und Channel-Mitgliedschaft sind erforderlich.',
      }).catch(() => {});
      return;
    }
    try {
      const taken = await store.change(job.conversationId, (c, queue) => {
        if (
          c.thread?.conversationId !== config.CSP_SLACK_CHANNEL_ID ||
          c.thread?.rootId !== job.rootId ||
          c.seen.includes(job.id)
        )
          return false;
        if (job.action) {
          if (job.timestamp <= (c.supportActionAt ?? 0)) return false;
          if (
            !['close', 'resolve'].includes(job.action) &&
            c.messages.length >= 500
          )
            throw new ChatError(
              409,
              'Gesprächslimit erreicht. Bitte abschließen und einen neuen Chat starten.',
            );
          const transition =
            (job.action === 'take' && c.status === 'bot') ||
            (job.action === 'resolve' && c.status !== 'closed');
          action(c, job.action, person, queue);
          c.supportActionAt = job.timestamp;
          if (job.action === 'take' && transition)
            c.supportSince = job.timestamp;
          c.seen.push(job.id);
          return transition;
        }
        if (job.timestamp > (c.supportSince ?? Infinity))
          supportReply(c, person, job.id, job.text ?? '', queue);
        return false;
      });
      if (taken) onTake(job.conversationId);
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      await api('chat.postEphemeral', {
        channel: config.CSP_SLACK_CHANNEL_ID,
        user: job.user,
        text: error.message,
      }).catch(() => {});
    }
  };
  const worker = async () => {
    if (working || closing) return;
    working = true;
    try {
      await inbox.drain(process);
    } catch {
      /* Durable retries; no content or credentials logged. */
    } finally {
      working = false;
    }
  };
  const interval = setInterval(() => void worker(), 1000);
  // Raw parsers are encapsulated, leaving the portal JSON parser unchanged.
  app.register(async (scope) => {
    scope.removeContentTypeParser('application/json');
    scope.addContentTypeParser(
      ['application/json', 'application/x-www-form-urlencoded'],
      { parseAs: 'buffer', bodyLimit: 131072 },
      (_req, body, done) => done(null, body),
    );
    const receive = async (raw: Buffer, actions: boolean) => {
      let body: unknown;
      try {
        body = JSON.parse(
          actions
            ? (new URLSearchParams(raw.toString('utf8')).get('payload') ?? '')
            : raw.toString('utf8'),
        );
      } catch {
        throw new ChatError(400, 'Ungültige Slack-Anfrage');
      }
      if (!actions) {
        const challenge = z
          .object({
            type: z.literal('url_verification'),
            challenge: z.string().min(1).max(500),
          })
          .safeParse(body);
        if (challenge.success) return { challenge: challenge.data.challenge };
      }
      let job: Incoming, channel: string;
      if (actions) {
        const parsed = actionSchema.safeParse(body);
        if (!parsed.success) throw new ChatError(400, 'Ungültige Slack-Aktion');
        const p = parsed.data,
          a = p.actions[0];
        if (
          p.team.id !== config.CSP_SLACK_TEAM_ID ||
          p.api_app_id !== config.CSP_SLACK_APP_ID ||
          p.channel.id !== config.CSP_SLACK_CHANNEL_ID ||
          p.container.channel_id !== p.channel.id
        )
          throw new ChatError(403, 'Falscher Slack-Kontext');
        channel = p.channel.id;
        job = {
          id: `action:${p.user.id}:${a.value}:${a.action_ts}:${a.action_id}`,
          conversationId: a.value,
          rootId: p.container.message_ts,
          user: p.user.id,
          timestamp: Number(a.action_ts) * 1000,
          action: a.action_id,
        };
      } else {
        const parsed = eventSchema.safeParse(body);
        if (!parsed.success) return {};
        const p = parsed.data,
          e = p.event;
        if (
          p.team_id !== config.CSP_SLACK_TEAM_ID ||
          p.api_app_id !== config.CSP_SLACK_APP_ID ||
          p.is_ext_shared_channel
        )
          throw new ChatError(403, 'Falscher Slack-Kontext');
        if (
          e.type !== 'message' ||
          e.subtype ||
          e.bot_id ||
          e.hidden ||
          !e.user ||
          !e.ts ||
          !e.thread_ts ||
          !e.text?.trim() ||
          e.channel !== config.CSP_SLACK_CHANNEL_ID ||
          e.ts === e.thread_ts
        )
          return {};
        channel = e.channel!;
        job = {
          id: `event:${p.event_id}`,
          conversationId: '',
          rootId: e.thread_ts,
          user: e.user,
          timestamp: Number(e.ts) * 1000,
          text: e.text,
        };
      }
      const c = await store.findThread(channel, job.rootId);
      if (!c || (actions && job.conversationId !== c.id)) {
        if (actions) throw new ChatError(404, 'Gespräch nicht gefunden');
        return {};
      }
      job.conversationId = c.id;
      await inbox.put(job);
      return {};
    };
    for (const [path, actions] of [
      ['/api/slack/events', false],
      ['/api/slack/actions', true],
    ] as const)
      scope.post(path, async (req, reply) => {
        if (
          !Buffer.isBuffer(req.body) ||
          !verifySlackRequest(
            config.CSP_SLACK_SIGNING_SECRET!,
            req.body,
            req.headers['x-slack-request-timestamp'],
            req.headers['x-slack-signature'],
          )
        )
          throw new ChatError(401, 'Ungültige Slack-Signatur');
        let timer: ReturnType<typeof setTimeout> | undefined;
        try {
          // Persist first. If storage exceeds Slack's deadline, return 503 so Slack retries.
          return await Promise.race([
            receive(req.body, actions),
            new Promise<never>((_resolve, reject) => {
              timer = setTimeout(
                () =>
                  reject(new ChatError(503, 'Slack-Anfrage bitte wiederholen')),
                2200,
              );
            }),
          ]);
        } catch (error) {
          if (error instanceof ChatError && error.statusCode === 503)
            return reply
              .code(503)
              .header('Retry-After', '1')
              .send({ error: 'Slack-Anfrage bitte wiederholen' });
          throw error;
        } finally {
          clearTimeout(timer);
          reply.header('Cache-Control', 'no-store');
        }
      });
  });
  app.addHook('preClose', async () => {
    closing = true;
    clearInterval(interval);
  });
  void worker();
  return {
    async send(job: Delivery, c: Conversation) {
      if (job.kind === 'create') {
        if (c.thread) return;
        const result = await api('chat.postMessage', {
          channel: config.CSP_SLACK_CHANNEL_ID,
          text: escape(`Portal-Support: ${c.owner.name}`),
          blocks: card(c),
          client_msg_id: job.id,
          mrkdwn: false,
          parse: 'none',
          unfurl_links: false,
          unfurl_media: false,
        });
        if (
          result.channel !== config.CSP_SLACK_CHANNEL_ID ||
          !timestamp.safeParse(result.ts).success
        )
          throw new Error('Invalid Slack thread response');
        await store.change(c.id, (current) => {
          current.thread = {
            conversationId: config.CSP_SLACK_CHANNEL_ID!,
            rootId: result.ts!,
          };
        });
        return;
      }
      if (!c.thread || c.thread.conversationId !== config.CSP_SLACK_CHANNEL_ID)
        throw new Error('Slack thread missing');
      if (job.kind === 'card') {
        await api('chat.update', {
          channel: c.thread.conversationId,
          ts: c.thread.rootId,
          text: escape(`Portal-Support: ${c.owner.name}`),
          blocks: card(c),
        });
      } else if (job.message) {
        const m = job.message,
          text = `${m.kind === 'user' ? c.owner.name : m.kind === 'bot' ? 'Digitaler Assistent' : (m.name ?? 'Support')}\n${m.content}`;
        await api('chat.postMessage', {
          channel: c.thread.conversationId,
          thread_ts: c.thread.rootId,
          text: escape(text).slice(0, 39000),
          blocks: messageBlocks(text),
          client_msg_id: job.id,
          mrkdwn: false,
          parse: 'none',
          unfurl_links: false,
          unfurl_media: false,
        });
      }
    },
    async close() {
      closing = true;
      clearInterval(interval);
      while (working) await new Promise((resolve) => setTimeout(resolve, 20));
    },
    // Allows deterministic lifecycle tests without waiting for a polling timer.
    drain: worker,
  };
}
