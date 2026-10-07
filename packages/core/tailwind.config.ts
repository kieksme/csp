import type { Config } from 'tailwindcss';
import { fileURLToPath } from 'node:url';
const colors = Object.fromEntries(
  [
    'accent',
    'accent-ink',
    'accent-secondary',
    'hero',
    'hero-ink',
    'paper',
    'card',
    'ink',
    'muted',
    'line',
    'soft',
    'success',
    'danger',
    'warning',
    'warning-surface',
    'warning-ink',
    'neutral',
    'hero-line',
  ].map((name) => [name, `var(--${name})`]),
);
export default {
  content: [fileURLToPath(new URL('../*/src/**/*.{ts,tsx}', import.meta.url))],
  // Keep the portal's existing element defaults; Tailwind provides utilities.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      colors,
      spacing: Object.fromEntries(
        Array.from({ length: 101 }, (_, n) => [
          String(n),
          `calc(var(--spacing) * ${n})`,
        ]),
      ),
      borderRadius: { card: 'var(--radius)' },
      fontFamily: { sans: ['var(--font-family)'], mono: ['var(--font-mono)'] },
      maxWidth: { content: 'var(--content-width)', hero: 'var(--hero-width)' },
    },
  },
} satisfies Config;
