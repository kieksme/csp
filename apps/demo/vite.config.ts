import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { publicConfig, portalBuild } from '@kieksme/csp-core/build';
export default defineConfig(({ mode }) => {
  const env = {
    CSP_CONTENT_PATH: 'content.json',
    CSP_AVATARS_PATH: 'avatars.json',
    ...loadEnv(mode, process.cwd(), ''),
    ...process.env,
  };
  return {
    define: {
      __CSP_DATADOG_DEMO__: JSON.stringify(
        process.env.CSP_DATADOG_DEMO === 'true',
      ),
    },
    plugins: [react(), portalBuild(publicConfig(env))],
    server: { port: 5173, strictPort: true },
  };
});
