import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './tests/browser',
  timeout: 30000,
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  projects: [
    {
      name: 'desktop',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1440, height: 1000 },
      },
    },
    {
      name: 'mobile',
      use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' },
    },
  ],
  webServer: [
    {
      command:
        'pnpm --filter csp-demo exec vite preview --host 127.0.0.1 --port 4173 --strictPort',
      url: 'http://127.0.0.1:4173',
      reuseExistingServer: false,
    },
    {
      command:
        'CSP_DEMO=true CSP_CONTACT_PHONE=+49000 CSP_ALLOWED_ORIGINS=http://127.0.0.1:4173 pnpm --filter csp-demo start:api',
      url: 'http://127.0.0.1:3001/health',
      reuseExistingServer: false,
    },
    {
      command:
        'pnpm --filter csp-northstar exec vite preview --host 127.0.0.1 --port 4174 --strictPort',
      url: 'http://127.0.0.1:4174',
      reuseExistingServer: false,
    },
    {
      command:
        'CSP_DEMO=true CSP_CONTACT_PHONE=+49000 CSP_PORT=3002 CSP_NAME=Northstar CSP_ALLOWED_ORIGINS=http://127.0.0.1:4174 pnpm --filter csp-northstar start:api',
      url: 'http://127.0.0.1:3002/health',
      reuseExistingServer: false,
    },
  ],
});
