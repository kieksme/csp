import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import {
  contentSchema,
  safeUrl,
  type Env,
  type PublicConfig,
} from '@kieksme/csp-sdk';
const schema = z.object({
  CSP_NAME: z.string().min(1).default('Service Desk'),
  CSP_TAGLINE: z.string().default('Wir sind für Sie da.'),
  CSP_DESCRIPTION: z
    .string()
    .default('Ihr direkter Kontakt zum Operations-Team.'),
  CSP_COLOR: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .default('#176b58'),
  CSP_BACKGROUND: z
    .string()
    .regex(/^#[a-f0-9]{6}$/i)
    .default('#102e29'),
  CSP_BASE_PATH: z
    .string()
    .regex(/^\/(?:[a-zA-Z0-9_-]+\/)*$/)
    .default('/'),
  CSP_API_URL: z.string().default('http://localhost:3001'),
  CSP_CONTACT_PHONE: z
    .string()
    .regex(/^\+?[0-9 ()-]{3,40}$/)
    .default('+49 000 000000'),
  CSP_CONTACT_LABEL: z.string().default('Operations-Hotline'),
  CSP_POLL_MS: z.coerce.number().int().min(1000).default(60000),
});
export function publicConfig(env: Env, cwd = process.cwd()): PublicConfig {
  const c = schema.parse(env);
  const content = env.CSP_CONTENT_PATH
    ? contentSchema.parse(
        JSON.parse(readFileSync(resolve(cwd, env.CSP_CONTENT_PATH), 'utf8')),
      )
    : contentSchema.parse({});
  for (const item of [...content.processes, ...content.tickets])
    if (item.href) safeUrl(item.href);
  const avatars = env.CSP_AVATARS_PATH
    ? z
        .record(z.string())
        .parse(
          JSON.parse(readFileSync(resolve(cwd, env.CSP_AVATARS_PATH), 'utf8')),
        )
    : {};
  for (const url of Object.values(avatars)) safeUrl(url);
  return {
    chatSupport: env.CSP_TEAMS_DEMO === 'true' ? { mode: 'demo' } : undefined,
    name: c.CSP_NAME,
    tagline: c.CSP_TAGLINE,
    description: c.CSP_DESCRIPTION,
    color: c.CSP_COLOR,
    background: c.CSP_BACKGROUND,
    basePath: c.CSP_BASE_PATH,
    apiUrl: safeUrl(c.CSP_API_URL).replace(/\/$/, ''),
    phone: c.CSP_CONTACT_PHONE,
    phoneLabel: c.CSP_CONTACT_LABEL,
    logo: env.CSP_LOGO_URL ? safeUrl(env.CSP_LOGO_URL) : undefined,
    icon: env.CSP_ICON_PATH,
    domain: env.CSP_DOMAIN ? new URL(env.CSP_DOMAIN).origin : undefined,
    demo: env.CSP_DEMO === 'true',
    webmcp: env.CSP_WEBMCP !== 'false',
    pollMs: c.CSP_POLL_MS,
    content,
    avatarOverrides: avatars,
  };
}
