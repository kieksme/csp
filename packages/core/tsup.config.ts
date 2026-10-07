import { defineConfig } from 'tsup';
export default defineConfig({
  entry: [
    'src/browser.tsx',
    'src/server.ts',
    'src/build.ts',
    'src/config.ts',
    'src/profile.ts',
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
    '@fontsource/manrope',
    '@fontsource/ibm-plex-mono',
  ],
});
