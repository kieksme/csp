import Fastify from 'fastify';
import cors from '@fastify/cors';
import {
  LiveCache,
  validatePlugins,
  type Env,
  type PublicConfig,
  type ServerPlugin,
  type Source,
  type ServerContext,
} from '@kieksme/csp-sdk';
export async function createServer(options: {
  plugins: ServerPlugin[];
  config: PublicConfig;
  env?: Env;
  fetch?: typeof fetch;
}) {
  const env = options.env ?? process.env;
  const app = Fastify({
    logger: false,
    bodyLimit: 65536,
    trustProxy: env.CSP_TRUST_PROXY === 'true',
  });
  const allowed = (env.CSP_ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  await app.register(cors, {
    origin: allowed,
    methods: ['GET', 'POST'],
    credentials: false,
  });
  app.addHook('onSend', async (_req, reply) => {
    reply.header('X-Content-Type-Options', 'nosniff');
    reply.header(
      'Cache-Control',
      _req.routeOptions.url?.startsWith('/api/v1/conversations')
        ? 'no-store, private'
        : 'no-store',
    );
  });
  app.setErrorHandler((err, _req, reply) => {
    const status = (err as { statusCode?: number }).statusCode;
    reply.code(status && status >= 400 && status < 500 ? status : 500).send({
      error:
        status && status < 500
          ? 'Ungültige Anfrage'
          : 'Service derzeit nicht verfügbar',
    });
  });
  validatePlugins(options.plugins);
  // Validate all plugins before registering any route.
  for (const plugin of options.plugins) plugin.configSchema.parse(env);
  const knowledge = new Map<string, () => Promise<Source[]>>();
  const cache = new LiveCache(30000);
  const ctx: ServerContext = {
    app,
    env,
    config: options.config,
    fetch: options.fetch ?? fetch,
    demo: env.CSP_DEMO === 'true',
    cache,
    knowledge,
  };
  const pending = [...options.plugins];
  const installed = new Set<string>();
  while (pending.length) {
    const index = pending.findIndex((p) =>
      (p.requires ?? []).every((id) => installed.has(id)),
    );
    if (index < 0) throw new Error('Circular plugin dependencies');
    const [plugin] = pending.splice(index, 1);
    await plugin.setup(ctx);
    installed.add(plugin.id);
  }
  app.get('/health', async () => ({
    status: 'ok',
    plugins: options.plugins.map((p) => p.id),
  }));
  return app;
}
