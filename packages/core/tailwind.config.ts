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
  darkMode: ['selector', 'html[data-theme="dark"]'],
  corePlugins: { preflight: false },
  theme: {
    screens: {
      contained: { max: '1250px' },
      compact: { max: '800px' },
      narrow: { max: '450px' },
      wide: { min: '900px' },
    },
    extend: {
      colors,
      spacing: Object.fromEntries(
        Array.from({ length: 401 }, (_, n) => [
          String(n / 4),
          `calc(var(--spacing) * ${n / 4})`,
        ]),
      ),
      borderRadius: { card: 'var(--radius)' },
      fontFamily: { sans: ['var(--font-family)'], mono: ['var(--font-mono)'] },
      maxWidth: { content: 'var(--content-width)', hero: 'var(--hero-width)' },
    },
  },
} satisfies Config;
