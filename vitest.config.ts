import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'], testTimeout: 15000 },
  resolve: {
    alias: {
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
