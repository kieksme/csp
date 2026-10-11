import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    fileParallelism: !process.env.CSP_TEST_DATABASE_URL,
    include: ['tests/**/*.test.ts'],
    testTimeout: 15000,
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
