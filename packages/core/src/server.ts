import Fastify from 'fastify';
import cors from '@fastify/cors';
import { trace } from '@opentelemetry/api';
import {
  LiveCache,
  validatePlugins,
  type Env,
  type PublicConfig,
  type ServerPlugin,
  type Source,
  type ServerContext,
} from '@kieksme/csp-sdk';

/** Active span IDs for log–trace correlation (OpenTelemetry / OTLP). */
function traceLogFields(): { trace_id?: string; span_id?: string } {
  const span = trace.getActiveSpan();
  if (!span) return {};
  const { traceId, spanId } = span.spanContext();
  if (!traceId || traceId === '00000000000000000000000000000000') return {};
  return { trace_id: traceId, span_id: spanId };
}

export async function createServer(options: {
  plugins: ServerPlugin[];
  config: PublicConfig;
  env?: Env;
  fetch?: typeof fetch;
}) {
  const env = options.env ?? process.env;
  const app = Fastify({
    // Structured logs include trace_id/span_id when a span is active.
    // Default warn keeps happy-path output quiet (previous logger: false).
    logger: {
      level: 'warn',
      mixin: traceLogFields,
    },
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
    reply.header('X-Robots-Tag', 'noindex, nofollow');
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
  app.get('/robots.txt', async (_req, reply) =>
    reply
      .type('text/plain; charset=utf-8')
      .send('User-agent: *\nDisallow: /\n'),
  );
  app.get('/health', async () => ({
    status: 'ok',
    plugins: options.plugins.map((p) => p.id),
  }));
  return app;
}
