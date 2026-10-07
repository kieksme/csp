import { readFileSync } from 'node:fs';
import postcss from '../packages/core/node_modules/postcss';
import { createRequire } from 'node:module';
import { expect, it } from 'vitest';
const require = createRequire(import.meta.url);
const postcssConfig = require('../packages/core/postcss.config.cjs');
import { publicConfig } from '../packages/core/src/config.js';
import { themeTokensSchema } from '../packages/core/src/profile.js';
import {
  resolveThemeTokens,
  themeTokenKeys,
  tokenVariable,
} from '../packages/core/src/theme.js';

it('inherits base tokens in dark mode and returns to base tokens in light mode', () => {
  const config = publicConfig({});
  config.theme = {
    mode: 'system',
    tokens: { accent: '#123456', spacing: '5px', radius: '8px' },
    darkTokens: { accent: '#abcdef', paper: '#112233', radius: '12px' },
  };
  expect(resolveThemeTokens(config, true)).toMatchObject({
    accent: '#abcdef',
    spacing: '5px',
    radius: '12px',
    paper: '#112233',
  });
  expect(resolveThemeTokens(config, false)).toMatchObject({
    accent: '#123456',
    spacing: '5px',
    radius: '8px',
    hero: config.background,
  });
  expect(resolveThemeTokens(config, false)).not.toHaveProperty('paper');
  expect(themeTokenKeys.map(tokenVariable)).toContain('warning-surface');
});

it('validates token units, sizes and color values', () => {
  expect(
    themeTokensSchema.parse({
      radius: '0',
      spacing: '0.25rem',
      fontSize: '18px',
    }),
  ).toBeTruthy();
  for (const tokens of [
    { spacing: '0' },
    { fontSize: '-1px' },
    { contentWidth: '100%' },
    { radius: 'url(https://example.org)' },
    { warning: 'orange' },
    { unknown: '4px' },
  ])
    expect(themeTokensSchema.safeParse(tokens).success).toBe(false);
});

it('compiles JSX utilities for core and plugins with configurable design tokens', async () => {
  const css = readFileSync(
    new URL('../packages/core/src/style.css', import.meta.url),
    'utf8',
  );
  const result = await postcss(postcssConfig.plugins).process(css, {
    from: new URL('../packages/core/src/style.css', import.meta.url).pathname,
  });
  expect(result.css).not.toMatch(/@(?:apply|tailwind)\b/);
  expect(result.css).toContain('.bg-card');
  expect(result.css).toContain('.rounded-card');
  expect(result.css).toContain('grid-template-columns: 1.2fr 1fr');
  expect(result.css).toContain('@media (max-width: 800px)');
  expect(result.css).toContain('calc(var(--spacing) * 5.75)');
  expect(result.css).toContain('border-radius: var(--radius)');
  expect(result.css).toContain('background-color: var(--card)');
  expect(result.css).toContain('calc(var(--spacing) * 6)');
});

it('keeps the editor schema and runtime token keys aligned', () => {
  const schema = JSON.parse(
    readFileSync(
      new URL('../packages/cli/runtime/portal.schema.json', import.meta.url),
      'utf8',
    ),
  );
  const keys = Object.keys(themeTokensSchema.shape).sort();
  expect([...themeTokenKeys].sort()).toEqual(keys);
  for (const mode of ['tokens', 'darkTokens'])
    expect(
      Object.keys(schema.properties.theme.properties[mode].properties).sort(),
    ).toEqual(keys);
});
