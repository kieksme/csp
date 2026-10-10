import {
  App,
  toThreadedConversationId,
  type IHttpServerAdapter,
} from '@microsoft/teams.apps';
import type { ServerContext } from '@kieksme/csp-sdk';
import { z } from 'zod';
import {
  ChatError,
  action,
  supportReply,
  type Conversation,
  type Delivery,
} from './conversations.js';
import { supportAuthorizer } from './auth.js';
import type { TeamsConfig } from './config.js';
import type { Store } from './store.js';
export function card(c: Conversation) {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    body: [
      {
        type: 'TextBlock',
        text: `Portal-Support · ${c.owner.name}`,
        weight: 'Bolder',
        wrap: true,
      },
      {
        type: 'TextBlock',
        text: `${c.owner.email ?? ''}\nGespräch: ${c.id}`,
        wrap: true,
      },
      {
        type: 'TextBlock',
        text:
          c.status === 'support'
            ? `${c.support?.name} betreut dieses Gespräch. Deine Antworten gehen jetzt direkt an den Nutzer. Nachrichten anderer Personen bleiben intern.`
            : c.status === 'closed'
              ? 'Gespräch abgeschlossen.'
              : 'Digitaler Assistent aktiv. Erst übernehmen, dann Kundenantworten schreiben.',
        wrap: true,
      },
    ],
    actions:
      c.status === 'closed'
        ? []
        : (c.status === 'bot'
            ? [['take', 'Übernehmen']]
            : [
                ['release', 'Bot freigeben'],
                ['close', 'Abschließen'],
              ]
          ).map(([action, title]) => ({
            type: 'Action.Submit',
            title,
            data: { action, conversationId: c.id },
          })),
  };
}
const actionSchema = z.object({
  action: z.enum(['take', 'release', 'close']),
  conversationId: z.string().uuid(),
});
export async function createTeamsBridge(
  app: ServerContext['app'],
  store: Store,
  config: TeamsConfig,
  fetcher: typeof fetch,
  onTake: (id: string) => void = () => {},
) {
  const adapter: IHttpServerAdapter = {
    async stop() {},
    registerRoute(method, path, handler) {
      // SDK authenticates the service JWT before dispatching. Never supply a request.token override.
      app.route({
        method,
        url: path,
        handler: async (req, reply) => {
          const headers = Object.fromEntries(
            Object.entries(req.headers).filter(
              (entry): entry is [string, string | string[]] =>
                entry[1] !== undefined,
            ),
          );
          const response = await handler({ body: req.body, headers });
          return reply.code(response.status).send(response.body);
        },
      });
    },
  };
  const teams = new App({
    clientId: config.CSP_TEAMS_APP_ID,
    clientSecret: config.CSP_TEAMS_APP_SECRET,
    tenantId: config.CSP_ENTRA_TENANT_ID,
    serviceUrl: config.CSP_TEAMS_SERVICE_URL,
    httpServerAdapter: adapter,
    telemetry: { agent365: false },
  });
  const authorize = supportAuthorizer(
    config.CSP_ENTRA_TENANT_ID!,
    config.CSP_TEAMS_APP_ID!,
    config.CSP_TEAMS_APP_SECRET!,
    config.CSP_TEAMS_SUPPORT_GROUP_ID!,
    fetcher,
    config.CSP_TEAMS_SUPPORT_AUTH === 'team'
      ? config.CSP_TEAMS_TEAM_ID
      : undefined,
  );
  teams.on('message', async ({ activity, reply }) => {
    const data = activity.channelData;
    if (
      data?.tenant?.id !== config.CSP_ENTRA_TENANT_ID ||
      data?.team?.id !== config.CSP_TEAMS_TEAM_ID ||
      data?.channel?.id !== config.CSP_TEAMS_CHANNEL_ID ||
      !activity.from.aadObjectId ||
      activity.from.id === `28:${config.CSP_TEAMS_APP_ID}`
    )
      return;
    const base = activity.conversation.id.split(';messageid=')[0];
    const root =
      activity.replyToId ?? activity.conversation.id.split(';messageid=')[1];
    const parsed = actionSchema.safeParse(activity.value);
    const c = parsed.success
      ? await store.get(parsed.data.conversationId)
      : root
        ? await store.findThread(base, root)
        : undefined;
    // A card payload is not authority: it must originate in the mapped conversation.
    if (
      !c?.thread ||
      c.thread.conversationId !== base ||
      !root ||
      c.thread.rootId !== root
    )
      return;
    if (
      !parsed.success &&
      (c.status !== 'support' || c.support?.id !== activity.from.aadObjectId)
    )
      return;
    if (!(await authorize(activity.from.aadObjectId))) {
      if (parsed.success) await reply('Keine bestätigte Supportberechtigung.');
      return;
    }
    const person = {
      id: activity.from.aadObjectId,
      name: activity.from.name ?? 'Support',
    };
    try {
      const taken = await store.change(c.id, (current, queue) => {
        const eventId = activity.id;
        if (current.seen.includes(eventId)) return false;
        if (parsed.success) {
          action(current, parsed.data.action, person, queue);
          current.seen.push(eventId);
          return parsed.data.action === 'take';
        } else {
          // Ignore attachments and edits (message.update has a separate SDK route).
          if (activity.attachments?.length) return;
          const text = (activity.text ?? '')
            .replace(/<at>[^<]*<\/at>/g, '')
            .replace(/<br\s*\/?\s*>/gi, '\n')
            .replace(/<[^>]+>/g, '')
            .replace(/&lt;/g, '<')
            .replace(/&gt;/g, '>')
            .replace(/&amp;/g, '&');
          supportReply(current, person, eventId, text, queue);
        }
      });
      if (taken) onTake(c.id);
    } catch (e) {
      if (e instanceof ChatError) await reply(e.message);
      else throw e;
    }
  });
  await teams.initialize();
  return {
    async send(job: Delivery, c: Conversation) {
      if (job.kind === 'create') {
        if (c.thread) return;
        const result = await teams.api.conversations.create({
          tenantId: config.CSP_ENTRA_TENANT_ID,
          channelData: {
            channel: { id: config.CSP_TEAMS_CHANNEL_ID },
            team: { id: config.CSP_TEAMS_TEAM_ID },
            tenant: { id: config.CSP_ENTRA_TENANT_ID },
          },
          activity: {
            type: 'message',
            attachments: [
              {
                contentType: 'application/vnd.microsoft.card.adaptive',
                content: card(c),
              },
            ],
          },
        });
        if (!result.id || !result.activityId)
          throw new Error('Teams did not return thread identifiers');
        await store.change(c.id, (current) => {
          current.thread = {
            conversationId: result.id.split(';messageid=')[0],
            rootId: result.activityId!,
            serviceUrl: result.serviceUrl || config.CSP_TEAMS_SERVICE_URL,
          };
        });
      } else {
        if (!c.thread) throw new Error('Thread not created yet');
        const url = new URL(
          c.thread.serviceUrl ?? config.CSP_TEAMS_SERVICE_URL,
        );
        if (
          url.protocol !== 'https:' ||
          url.hostname !== new URL(config.CSP_TEAMS_SERVICE_URL).hostname ||
          url.username ||
          url.password ||
          url.port
        )
          throw new Error('Unexpected Teams service URL');
        const api = teams.api.fromServiceUrl({ serviceUrl: url.href });
        if (job.kind === 'card') {
          await api.conversations
            .activities(c.thread.conversationId)
            .update(c.thread.rootId, {
              type: 'message',
              attachments: [
                {
                  contentType: 'application/vnd.microsoft.card.adaptive',
                  content: card(c),
                },
              ],
            });
        } else if (job.message) {
          const label =
            job.message.kind === 'user'
              ? c.owner.name
              : job.message.kind === 'bot'
                ? `${job.message.responder?.name ?? 'Service-Team'} · Digitaler Assistent`
                : 'Portal';
          await api.conversations
            .activities(
              toThreadedConversationId(
                c.thread.conversationId,
                c.thread.rootId,
              ),
            )
            .create({
              type: 'message',
              textFormat: 'plain',
              text: `${label}:\n${job.message.content}`,
            });
        }
      }
    },
    async close() {
      await teams.stop();
    },
  };
}
