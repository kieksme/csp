import { parse } from 'dotenv';
import { readFileSync } from 'node:fs';
import { resolve, dirname, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { safeUrl, type Env } from '@kieksme/csp-sdk';
import { publicConfig } from './config.js';
const color = z.string().regex(/^#[a-f0-9]{6}$/i);
const length = z.string().regex(/^(?:0|(?:\d+(?:\.\d+)?|\.\d+)(?:px|rem|em))$/);
const positiveLength = length.refine((value) => parseFloat(value) > 0);
export const themeTokensSchema = z
  .object({
    accent: color.optional(),
    accentSecondary: color.optional(),
    hero: color.optional(),
    paper: color.optional(),
    card: color.optional(),
    ink: color.optional(),
    muted: color.optional(),
    line: color.optional(),
    soft: color.optional(),
    success: color.optional(),
    danger: color.optional(),
    warning: color.optional(),
    warningSurface: color.optional(),
    warningInk: color.optional(),
    neutral: color.optional(),
    heroLine: color.optional(),
    radius: length.optional(),
    spacing: positiveLength.optional(),
    contentWidth: positiveLength.optional(),
    heroWidth: positiveLength.optional(),
    fontSize: positiveLength.optional(),
    fontMono: z.string().min(1).optional(),
    fontFamily: z.string().min(1).optional(),
  })
  .strict();
export const profileSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
    branding: z
      .object({
        name: z.string().min(1),
        tagline: z.string().optional(),
        description: z.string().optional(),
        logoFile: z.string().min(1).optional(),
        iconFile: z.string().min(1).optional(),
      })
      .strict(),
    theme: z
      .object({
        mode: z.enum(['light', 'dark', 'system']).default('system'),
        tokens: themeTokensSchema.optional(),
        darkTokens: themeTokensSchema.optional(),
      })
      .strict()
      .optional(),
    contact: z
      .object({ phone: z.string().min(1), label: z.string().optional() })
      .strict(),
    public: z
      .object({
        basePath: z.string().optional(),
        apiUrl: z.string().optional(),
        domain: z.string().optional(),
        pollMs: z.number().int().min(1000).optional(),
        demo: z.boolean().optional(),
        staticDemo: z.boolean().optional(),
        webmcp: z.boolean().optional(),
      })
      .strict()
      .optional(),
    contentFile: z.string().min(1),
    avatarsFile: z.string().min(1).optional(),
    plugins: z
      .array(
        z.string().regex(/^(?:@[a-z0-9][a-z0-9._-]*\/)?[a-z0-9][a-z0-9._-]*$/),
      )
      .refine((x) => new Set(x).size === x.length, 'Duplicate plugin'),
  })
  .strict();
export type PortalProfile = z.infer<typeof profileSchema>;
export function readProfile(file: string): PortalProfile {
  try {
    return profileSchema.parse(JSON.parse(readFileSync(file, 'utf8')));
  } catch (error) {
    throw new Error(
      `Invalid portal profile ${file}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
const overrides: Record<string, string> = {
  CSP_NAME: 'branding.name',
  CSP_TAGLINE: 'branding.tagline',
  CSP_DESCRIPTION: 'branding.description',
  CSP_COLOR: 'theme.tokens.accent',
  CSP_BACKGROUND: 'theme.tokens.hero',
  CSP_CONTACT_PHONE: 'contact.phone',
  CSP_CONTACT_LABEL: 'contact.label',
  CSP_BASE_PATH: 'public.basePath',
  CSP_API_URL: 'public.apiUrl',
  CSP_DOMAIN: 'public.domain',
  CSP_POLL_MS: 'public.pollMs',
  CSP_DEMO: 'public.demo',
  CSP_WEBMCP: 'public.webmcp',
  CSP_CONTENT_PATH: 'contentFile',
  CSP_AVATARS_PATH: 'avatarsFile',
  CSP_LOGO_URL: 'branding.logoFile',
  CSP_ICON_PATH: 'branding.iconFile',
};
export function loadProfile(file: string, env: Env = {}, production = false) {
  file = resolve(file);
  const directory = dirname(file),
    profile = readProfile(file);
  const values: Env = {};
  const origins: Record<string, string> = {};
  const assign = (key: string, value: unknown) => {
    if (value !== undefined) {
      values[key] = String(value);
      origins[key] = 'profile';
    }
  };
  const p = profile;
  assign('CSP_NAME', p.branding.name);
  assign('CSP_TAGLINE', p.branding.tagline);
  assign('CSP_DESCRIPTION', p.branding.description);
  assign('CSP_COLOR', p.theme?.tokens?.accent);
  assign('CSP_BACKGROUND', p.theme?.tokens?.hero);
  assign('CSP_CONTACT_PHONE', p.contact.phone);
  assign('CSP_CONTACT_LABEL', p.contact.label);
  assign('CSP_BASE_PATH', p.public?.basePath);
  assign('CSP_API_URL', p.public?.apiUrl);
  assign('CSP_DOMAIN', p.public?.domain);
  assign('CSP_POLL_MS', p.public?.pollMs);
  assign('CSP_DEMO', p.public?.demo);
  assign('CSP_WEBMCP', p.public?.webmcp);
  assign('CSP_CONTENT_PATH', p.contentFile);
  assign('CSP_AVATARS_PATH', p.avatarsFile);
  assign('CSP_ICON_PATH', p.branding.iconFile);
  for (const key of Object.keys(overrides))
    if (env[key] !== undefined) {
      if (!env[key]?.trim()) throw new Error(`Empty public override: ${key}`);
      values[key] = env[key];
      origins[key] = 'environment';
    }
  if (
    values.CSP_DEMO !== undefined &&
    !['true', 'false'].includes(values.CSP_DEMO)
  )
    throw new Error('CSP_DEMO must be true or false');
  if (
    values.CSP_WEBMCP !== undefined &&
    !['true', 'false'].includes(values.CSP_WEBMCP)
  )
    throw new Error('CSP_WEBMCP must be true or false');
  if (values.CSP_POLL_MS !== undefined && !/^\d+$/.test(values.CSP_POLL_MS))
    throw new Error('CSP_POLL_MS must be an integer');
  for (const key of ['CSP_CONTENT_PATH', 'CSP_AVATARS_PATH', 'CSP_ICON_PATH'])
    if (values[key]) values[key] = resolve(directory, values[key]);
  if (values.CSP_DOMAIN) safeUrl(values.CSP_DOMAIN);
  const config = publicConfig(
    {
      ...values,
      CSP_AVATARS_PATH: env.CSP_AVATARS_PATH
        ? values.CSP_AVATARS_PATH
        : undefined,
    },
    directory,
  );
  const assets: { source: string; fileName: string }[] = [];
  const asset = (path: string) => {
    const source = resolve(directory, path),
      data = readFileSync(source);
    if (!/\.(svg|png|jpe?g|webp|gif|avif|woff2?)$/i.test(source))
      throw new Error(`Unsupported web asset: ${path}`);
    const fileName =
      'assets/' +
      createHash('sha256').update(data).digest('hex').slice(0, 12) +
      '-' +
      basename(source);
    assets.push({ source, fileName });
    return config.basePath + fileName;
  };
  if (p.branding.logoFile && !env.CSP_LOGO_URL)
    config.logo = asset(p.branding.logoFile);
  config.theme = p.theme;
  config.staticDemo = p.public?.staticDemo;
  if (config.staticDemo && !config.demo)
    throw new Error('staticDemo requires demo=true');
  if (p.avatarsFile && !env.CSP_AVATARS_PATH) {
    const avatars = z
      .object({
        ids: z.record(z.string()).default({}),
        names: z.record(z.string()).default({}),
      })
      .strict()
      .parse(
        JSON.parse(readFileSync(resolve(directory, p.avatarsFile), 'utf8')),
      );
    const image = (value: string) =>
      /^(https?:\/\/|\/)/.test(value) ? safeUrl(value) : asset(value);
    config.avatarOverrides = Object.fromEntries(
      Object.entries(avatars.ids).map(([k, v]) => [k, image(v)]),
    );
    config.avatarNames = Object.fromEntries(
      Object.entries(avatars.names).map(([k, v]) => [
        k.normalize('NFKC').trim().toLocaleLowerCase('de'),
        image(v),
      ]),
    );
  }
  if (production && !config.demo) {
    if (config.phone.replace(/\D/g, '') === '49000000000')
      throw new Error('Replace the example hotline before production');
    for (const url of [config.apiUrl, config.domain])
      if (
        url &&
        /(^|\.)example\.invalid$/.test(
          new URL(url, 'http://localhost').hostname,
        )
      )
        throw new Error('Replace example.invalid URLs before production');
  }
  return {
    profile,
    config,
    assets,
    env: { ...env, ...values },
    origins: Object.fromEntries(
      Object.keys(overrides).map((k) => [k, origins[k] ?? 'default']),
    ),
  };
}

export function loadRuntimeEnv(
  directory: string,
  processEnv: Env = process.env,
): Env {
  const env: Env = {};
  for (const name of ['.env.branding', '.env', '.env.local']) {
    try {
      Object.assign(env, parse(readFileSync(resolve(directory, name))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return { ...env, ...processEnv };
}
