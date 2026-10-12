import { timingSafeEqual } from 'node:crypto';
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
import type { TelegramConfig } from './config.js';
import { inboxFor, type Inbox, type Incoming } from './inbox.js';

const integer = z.number().int().safe();
const userSchema = z.object({
  id: integer.positive(),
  is_bot: z.boolean(),
  first_name: z.string().min(1),
  last_name: z.string().optional(),
});
const chatSchema = z.object({
  id: integer,
  type: z.string(),
  is_forum: z.boolean().optional(),
  username: z.string().optional(),
});
const messageSchema = z.object({
  message_id: integer.positive(),
  date: integer.nonnegative(),
  chat: chatSchema,
  message_thread_id: integer.positive().optional(),
  from: userSchema.optional(),
  text: z.string().max(4096).optional(),
  sender_chat: z.unknown().optional(),
  forward_origin: z.unknown().optional(),
  via_bot: z.unknown().optional(),
});
const updateSchema = z.object({
  update_id: integer.nonnegative(),
  message: messageSchema.optional(),
  callback_query: z
    .object({
      id: z.string().min(1).max(200),
      from: userSchema,
      data: z.string().max(64).optional(),
      message: messageSchema.optional(),
    })
    .optional(),
});
export function verifyTelegramSecret(expected: string, supplied: unknown) {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(expected),
    b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}
export function telegramApi(
  config: TelegramConfig,
  fetcher: typeof fetch = fetch,
) {
  let blockedUntil = 0;
  return async (
    method: string,
    body: Record<string, unknown> = {},
  ): Promise<unknown> => {
    if (Date.now() < blockedUntil)
      throw new Error('Telegram rate limit active');
    // Never log fetch exceptions: Telegram embeds the bot credential in the URL.
    let response: Response;
    try {
      response = await fetcher(
        `https://api.telegram.org/bot${config.CSP_TELEGRAM_BOT_TOKEN}/${method}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          signal: AbortSignal.timeout(10000),
        },
      );
    } catch {
      throw new Error('Telegram API temporarily unavailable');
    }
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new Error('Invalid Telegram response');
    }
    const result = z
      .object({
        ok: z.boolean(),
        result: z.unknown().optional(),
        error_code: integer.optional(),
        description: z.string().optional(),
        parameters: z
          .object({ retry_after: integer.positive().optional() })
          .optional(),
      })
      .safeParse(data);
    if (
      response.status === 429 ||
      (result.success && result.data.error_code === 429)
    )
      blockedUntil =
        Date.now() +
        Math.min(
          86400,
          result.success ? (result.data.parameters?.retry_after ?? 60) : 60,
        ) *
          1000;
    if (
      method === 'editMessageText' &&
      result.success &&
      result.data.error_code === 400 &&
      result.data.description === 'Bad Request: message is not modified'
    )
      return true;
    if (!response.ok || !result.success || !result.data.ok)
      throw new Error('Telegram API request failed');
    return result.data.result;
  };
}
function chunks(text: string, limit: number) {
  const result: string[] = [];
  let part = '';
  for (const char of text) {
    // Stay below the limit even for UTF-16 counting, without splitting surrogate pairs.
    if (part.length + char.length > limit) {
      result.push(part);
      part = '';
    }
    part += char;
  }
  if (part) result.push(part);
  return result;
}
export function card(c: Conversation) {
  const status =
    c.status === 'bot' || c.status === 'waiting'
      ? c.status === 'waiting'
        ? 'Persönlicher Support angefragt · KI pausiert'
        : 'Digitaler Assistent'
      : c.status === 'closed'
        ? c.resolution
          ? 'Problem gelöst'
          : 'Abgeschlossen'
        : `Support: ${c.support?.name}`;
  return {
    text: `Portal-Support\nPortal-Nutzer: ${c.owner.name}\nGespräch: ${c.id}\nStatus: ${status}`,
    reply_markup: {
      inline_keyboard:
        c.status === 'closed'
          ? []
          : [
              (c.status === 'bot' || c.status === 'waiting'
                ? [
                    ['take', 'Übernehmen'],
                    ['resolve', 'Problem gelöst'],
                  ]
                : [
                    ['release', 'An Bot zurückgeben'],
                    ['close', 'Abschließen'],
                    ['resolve', 'Problem gelöst'],
                  ]
              ).map(([id, text]) => ({ text, callback_data: `${id}:${c.id}` })),
            ],
    },
  };
}
export function supportAuthorizer(
  config: TelegramConfig,
  api: ReturnType<typeof telegramApi>,
) {
  return async (id: string): Promise<SupportPerson | undefined> => {
    if (!config.CSP_TELEGRAM_SUPPORT_USER_IDS?.includes(id)) return;
    const member = z
      .object({
        status: z.string(),
        is_member: z.boolean().optional(),
        user: userSchema,
      })
      .parse(
        await api('getChatMember', {
          chat_id: config.CSP_TELEGRAM_CHAT_ID,
          user_id: Number(id),
        }),
      );
    if (
      String(member.user.id) !== id ||
      member.user.is_bot ||
      !(
        ['creator', 'administrator', 'member'].includes(member.status) ||
        (member.status === 'restricted' && member.is_member === true)
      )
    )
      return;
    // Resolve the current Telegram profile; names supplied in webhook payloads are not trusted.
    return {
      id: `telegram:${config.CSP_TELEGRAM_CHAT_ID}:${id}`,
      name: [member.user.first_name, member.user.last_name]
        .filter(Boolean)
        .join(' ')
        .slice(0, 200),
    };
  };
}
export async function createTelegramBridge(
  app: FastifyInstance,
  store: Store,
  config: TelegramConfig,
  fetcher: typeof fetch = fetch,
  onTake: (id: string) => void = () => {},
  inbox: Inbox = inboxFor(store),
) {
  const api = telegramApi(config, fetcher),
    authorize = supportAuthorizer(config, api),
    channel = `telegram:${config.CSP_TELEGRAM_CHAT_ID}`;
  const bot = userSchema.parse(await api('getMe'));
  if (!bot.is_bot) throw new Error('Telegram identity must be a bot');
  const chat = chatSchema.parse(
    await api('getChat', { chat_id: config.CSP_TELEGRAM_CHAT_ID }),
  );
  if (
    String(chat.id) !== config.CSP_TELEGRAM_CHAT_ID ||
    chat.type !== 'supergroup' ||
    chat.username ||
    !chat.is_forum
  )
    throw new Error('Telegram support requires a forum supergroup');
  const rights = z
    .object({
      status: z.literal('administrator'),
      can_manage_topics: z.literal(true),
      user: userSchema,
    })
    .safeParse(
      await api('getChatMember', {
        chat_id: config.CSP_TELEGRAM_CHAT_ID,
        user_id: bot.id,
      }),
    );
  if (!rights.success || rights.data.user.id !== bot.id)
    throw new Error('Telegram bot requires administrator topic permissions');
  await inbox.init();
  let working = false,
    closing = false;
  const answer = async (job: Incoming, text: string) => {
    if (job.callbackId)
      await api('answerCallbackQuery', {
        callback_query_id: job.callbackId,
        text,
        show_alert: true,
      }).catch(() => {});
  };
  const process = async (job: Incoming) => {
    const person = await authorize(job.user);
    if (!person) {
      await answer(
        job,
        'Keine Supportberechtigung. Freigabe und Gruppenmitgliedschaft sind erforderlich.',
      );
      return;
    }
    try {
      const taken = await store.change(job.conversationId, (c, queue) => {
        if (
          c.thread?.conversationId !== channel ||
          c.thread.rootId !== job.rootId ||
          c.seen.includes(job.id)
        )
          return false;
        // Telegram chooses a new random update_id after a week without updates.
        // Reset sequence comparisons only across such an idle period; durable receipts still deduplicate.
        const receivedAt = job.receivedAt ?? Date.now();
        if (
          c.thread.lastUpdateAt &&
          receivedAt - c.thread.lastUpdateAt > 7 * 86400000
        ) {
          c.supportActionAt = -1;
          if (c.status === 'support') c.supportSince = -1;
        }
        c.thread.lastUpdateAt = Math.max(
          c.thread.lastUpdateAt ?? 0,
          receivedAt,
        );
        if (job.action) {
          // Telegram callbacks have no click time. update_id orders updates (not the old card date).
          if (job.timestamp <= (c.supportActionAt ?? -1)) return false;
          if (
            !['close', 'resolve'].includes(job.action) &&
            c.messages.length >= 500
          )
            throw new ChatError(
              409,
              'Gesprächslimit erreicht. Bitte abschließen.',
            );
          const transition =
            (job.action === 'take' &&
              (c.status === 'bot' || c.status === 'waiting')) ||
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
      await answer(job, 'Support-Aktion verarbeitet.');
    } catch (error) {
      if (!(error instanceof ChatError)) throw error;
      await answer(job, error.message);
      if (!job.callbackId && job.text)
        await api('sendMessage', {
          chat_id: config.CSP_TELEGRAM_CHAT_ID,
          message_thread_id: Number(job.rootId),
          text: `Support-Antwort nicht weitergeleitet: ${error.message}`,
          link_preview_options: { is_disabled: true },
        }).catch(() => {});
    }
  };
  const worker = async () => {
    if (working || closing) return;
    working = true;
    try {
      await inbox.drain(process);
    } catch {
      /* Durable retries, never log credentials or content. */
    } finally {
      working = false;
    }
  };
  const interval = setInterval(() => void worker(), 1000);
  app.post(
    '/api/telegram/webhook',
    {
      bodyLimit: 131072,
      onRequest: async (req) => {
        if (
          !verifyTelegramSecret(
            config.CSP_TELEGRAM_WEBHOOK_SECRET!,
            req.headers['x-telegram-bot-api-secret-token'],
          )
        )
          throw new ChatError(401, 'Ungültiges Telegram-Webhook-Secret');
      },
    },
    async (req, reply) => {
      reply.header('Cache-Control', 'no-store');
      const parsed = updateSchema.safeParse(req.body);
      if (!parsed.success)
        throw new ChatError(400, 'Ungültiges Telegram-Update');
      const p = parsed.data,
        callback = p.callback_query,
        m = callback?.message ?? p.message,
        user = callback?.from ?? m?.from;
      if (
        !m ||
        !user ||
        user.is_bot ||
        m.sender_chat !== undefined ||
        m.forward_origin !== undefined ||
        m.via_bot !== undefined ||
        !m.message_thread_id ||
        m.chat.type !== 'supergroup' ||
        String(m.chat.id) !== config.CSP_TELEGRAM_CHAT_ID
      )
        return { ok: true };
      const c = await store.findThread(channel, String(m.message_thread_id));
      if (!c) return { ok: true };
      let command: 'take' | 'release' | 'close' | 'resolve' | undefined;
      if (callback) {
        const match = /^(take|release|close|resolve):([a-f0-9-]{36})$/.exec(
          callback.data ?? '',
        );
        if (
          !match ||
          match[2] !== c.id ||
          (String(m.message_id) !== c.thread?.serviceUrl &&
            String(m.message_id) !== c.supportRequest?.messageId) ||
          m.from?.id !== bot.id
        )
          return { ok: true };
        command = match[1] as typeof command;
      } else if (!m.text?.trim()) return { ok: true };
      await inbox.put({
        id: `update:${p.update_id}`,
        conversationId: c.id,
        rootId: String(m.message_thread_id),
        user: String(user.id),
        timestamp: p.update_id,
        receivedAt: Date.now(),
        action: command,
        text: callback ? undefined : m.text,
        callbackId: callback?.id,
      });
      // Acknowledge only after durable receipt. Telegram retries HTTP failures.
      void worker();
      return { ok: true };
    },
  );
  app.addHook('preClose', async () => {
    closing = true;
    clearInterval(interval);
  });
  return {
    async send(job: Delivery, c: Conversation) {
      if (job.kind === 'create' && !c.thread) {
        const topic = z.object({ message_thread_id: integer.positive() }).parse(
          await api('createForumTopic', {
            chat_id: config.CSP_TELEGRAM_CHAT_ID,
            name: chunks(`Support ${c.owner.name}`, 128)[0],
          }),
        );
        // Persist topic before sending the card, so a card retry cannot create another topic.
        await store.change(c.id, (current) => {
          current.thread = {
            conversationId: channel,
            rootId: String(topic.message_thread_id),
          };
        });
        c = (await store.get(c.id))!;
      }
      if (!c.thread || c.thread.conversationId !== channel)
        throw new Error('Telegram topic missing');
      const base = {
        chat_id: config.CSP_TELEGRAM_CHAT_ID,
        message_thread_id: Number(c.thread.rootId),
      };
      if (job.kind === 'request') {
        if (
          c.status !== 'waiting' ||
          c.supportRequest?.id !== job.id ||
          c.supportRequest.messageId
        )
          return;
        const targets: { id: string; name: string }[] = [];
        for (const id of job.targets ?? []) {
          const person = await authorize(id);
          if (person) targets.push({ id, name: person.name });
        }
        const names = targets.map((p) => p.name).join(', ');
        const text =
          names +
          (names ? ': ' : '') +
          'Persönlicher Support angefragt. Bitte übernehmen.';
        let offset = 0;
        const entities = targets.map((p) => {
          const entity = {
            type: 'text_mention',
            offset,
            length: p.name.length,
            user: { id: Number(p.id) },
          };
          offset += p.name.length + 2;
          return entity;
        });
        const result = z.object({ message_id: integer.positive() }).parse(
          await api('sendMessage', {
            ...base,
            text,
            entities,
            reply_markup: card(c).reply_markup,
            link_preview_options: { is_disabled: true },
          }),
        );
        await store.change(c.id, (current) => {
          if (current.supportRequest?.id === job.id)
            current.supportRequest.messageId = String(result.message_id);
        });
      } else if (job.kind === 'create' || job.kind === 'card') {
        if (c.thread.serviceUrl) {
          await api('editMessageText', {
            chat_id: base.chat_id,
            message_id: Number(c.thread.serviceUrl),
            ...card(c),
          });
        } else {
          const result = z
            .object({ message_id: integer.positive() })
            .parse(await api('sendMessage', { ...base, ...card(c) }));
          await store.change(c.id, (current) => {
            current.thread!.serviceUrl = String(result.message_id);
          });
        }
      } else if (job.message) {
        const m = job.message,
          text = `${m.kind === 'user' ? c.owner.name : m.kind === 'bot' ? 'Digitaler Assistent' : (m.name ?? 'Support')}\n${m.content}`;
        // Plain text only; do not enable Markdown/HTML or link previews for visitor input.
        for (const part of chunks(text, 3500))
          await api('sendMessage', {
            ...base,
            text: part,
            link_preview_options: { is_disabled: true },
          });
      }
    },
    async close() {
      closing = true;
      clearInterval(interval);
      while (working) await new Promise((resolve) => setTimeout(resolve, 20));
    },
    drain: worker,
  };
}
