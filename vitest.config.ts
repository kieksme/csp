import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    fileParallelism: !process.env.CSP_TEST_DATABASE_URL,
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
    env: {
      // Unit tests do not run a Datadog agent; keep APM off and harmless.
      DD_TRACE_ENABLED: 'false',
    },
  },
  resolve: {
    alias: {
      '@kieksme/csp-core/support': new URL(
        './packages/core/src/support.ts',
        import.meta.url,
      ).pathname,
      '@kieksme/csp-sdk/browser': new URL(
        './packages/sdk/src/browser.tsx',
        import.meta.url,
      ).pathname,
      '@kieksme/csp-sdk': new URL(
        './packages/sdk/src/index.ts',
        import.meta.url,
      ).pathname,
    },
  },
});
