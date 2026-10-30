import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/browser.tsx',
    'src/server.ts',
    'src/build.ts',
    'src/config.ts',
    'src/profile.ts',
    'src/support.ts',
    'src/tracing.ts',
    'src/tracing-node.ts',
  ],
  format: ['esm'],
  dts: true,
  clean: true,
  external: [
    '@kieksme/csp-sdk',
    'react',
    'react-dom',
    'sharp',
    'dotenv',
    'dd-trace',
    '@fontsource/manrope',
    '@fontsource/ibm-plex-mono',
  ],
});
