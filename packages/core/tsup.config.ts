import { defineConfig } from 'tsup';
export default defineConfig({
  entry: ['src/browser.tsx', 'src/server.ts', 'src/build.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    '@kieksme/csp-sdk',
    'react',
    'react-dom',
    'sharp',
    '@fontsource/manrope',
    '@fontsource/ibm-plex-mono',
  ],
});
