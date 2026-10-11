import type { ServerContext, ServerPlugin } from '@kieksme/csp-sdk';
import {
  setupConversations as setupSupport,
  MemoryStore,
  PostgresStore,
  portalAuthenticator,
  type Store,
  type Identity,
} from '@kieksme/csp-core/support';
import { cspPlugin } from '../package.json';
import { configSchema } from './config.js';
import { createTeamsBridge } from './teams.js';
export { configSchema } from './config.js';
export async function setupConversations(
  ctx: ServerContext,
  store: Store,
  authenticate: (authorization?: string) => Promise<Identity>,
  demo: boolean,
) {
  return setupSupport(ctx, store, authenticate, demo, (onTake) =>
    createTeamsBridge(
      ctx.app,
      store,
      configSchema.parse(ctx.env),
      ctx.fetch,
      onTake,
    ),
  );
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
