import { config } from 'dotenv';
import { createServer } from '@kieksme/csp-core/server';
import { publicConfig } from '@kieksme/csp-core/build';
import plugins from './portal.server.js';
config({ path: ['.env.local', '.env'], quiet: true });
const env: Record<string, string | undefined> = {
  CSP_CONTENT_PATH: 'content.json',
  ...process.env,
};
const app = await createServer({ plugins, config: publicConfig(env), env });
await app.listen({
  port: Number(env.CSP_PORT ?? 3001),
  host: env.CSP_HOST ?? '0.0.0.0',
});
for (const signal of ['SIGTERM', 'SIGINT'])
  process.once(signal, () => {
    void app.close().then(() => process.exit(0));
  });
