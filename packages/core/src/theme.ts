import type { PublicConfig, ThemeTokens } from '@kieksme/csp-sdk';

export const themeTokenKeys = [
  'accent',
  'accentSecondary',
  'hero',
  'paper',
  'card',
  'ink',
  'muted',
  'line',
  'soft',
  'success',
  'danger',
  'warning',
  'warningSurface',
  'warningInk',
  'neutral',
  'heroLine',
  'fontFamily',
  'fontMono',
  'fontSize',
  'radius',
  'spacing',
  'contentWidth',
  'heroWidth',
] as const satisfies readonly (keyof ThemeTokens)[];

export function tokenVariable(key: string) {
  return key.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
}

export function resolveThemeTokens(config: PublicConfig, dark: boolean) {
  return {
    accent: config.color,
    hero: config.background,
    ...config.theme?.tokens,
    ...(dark ? config.theme?.darkTokens : {}),
  };
}
