import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import { z } from 'zod';
import {
  contentSchema,
  safeUrl,
  type Env,
  type PublicConfig,
} from '@kieksme/csp-sdk';
import type { Plugin } from 'vite';
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
    pollMs: c.CSP_POLL_MS,
    content,
    avatarOverrides: avatars,
  };
}
export function portalBuild(config: PublicConfig, cwd = process.cwd()): Plugin {
  const { icon: _icon, ...browserConfig } = config;
  const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="100" fill="${config.background}"/><path d="M128 270h80l40-112 48 210 32-98h56" fill="none" stroke="${config.color}" stroke-width="32" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
  const icon = config.icon
    ? readFileSync(resolve(cwd, config.icon))
    : Buffer.from(iconSvg);
  const manifest = {
    id: config.basePath,
    name: config.name,
    short_name: config.name.slice(0, 24),
    description: config.description,
    lang: 'de',
    start_url: config.basePath,
    scope: config.basePath,
    display: 'standalone',
    theme_color: config.background,
    background_color: config.background,
    icons: [192, 512]
      .map((size) => ({
        src: `icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: 'image/png',
        purpose: 'any',
      }))
      .concat([
        {
          src: 'icon-maskable-512.png',
          sizes: '512x512',
          type: 'image/png',
          purpose: 'maskable',
        },
      ]),
  };
  return {
    name: 'csp-portal',
    config: () => ({
      base: config.basePath,
      define: { __CSP_CONFIG__: JSON.stringify(browserConfig) },
    }),
    transformIndexHtml: () => [
      { tag: 'title', children: config.name, injectTo: 'head' },
      {
        tag: 'meta',
        attrs: { name: 'description', content: config.description },
        injectTo: 'head',
      },
      {
        tag: 'meta',
        attrs: { name: 'theme-color', content: config.background },
        injectTo: 'head',
      },
      {
        tag: 'link',
        attrs: {
          rel: 'manifest',
          href: config.basePath + 'manifest.webmanifest',
        },
        injectTo: 'head',
      },
      {
        tag: 'link',
        attrs: { rel: 'icon', href: config.basePath + 'icon-192.png' },
        injectTo: 'head',
      },
      ...(config.domain
        ? [
            {
              tag: 'link',
              attrs: {
                rel: 'canonical',
                href: config.domain + config.basePath,
              },
              injectTo: 'head' as const,
            },
          ]
        : []),
    ],
    async generateBundle(_options, bundle) {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.webmanifest',
        source: JSON.stringify(manifest),
      });
      for (const size of [192, 512])
        this.emitFile({
          type: 'asset',
          fileName: `icon-${size}.png`,
          source: await sharp(icon)
            .resize(size, size, {
              fit: 'contain',
              background: config.background,
            })
            .png()
            .toBuffer(),
        });
      this.emitFile({
        type: 'asset',
        fileName: 'icon-maskable-512.png',
        source: await sharp(icon)
          .resize(308, 308, { fit: 'contain', background: config.background })
          .extend({
            top: 102,
            bottom: 102,
            left: 102,
            right: 102,
            background: config.background,
          })
          .png()
          .toBuffer(),
      });
      const assets = [
        ...new Set([
          'index.html',
          'manifest.webmanifest',
          'icon-192.png',
          'icon-512.png',
          'icon-maskable-512.png',
          ...Object.keys(bundle),
        ]),
      ];
      const prefix =
        'csp-' +
        createHash('sha256').update(config.basePath).digest('hex').slice(0, 8) +
        '-';
      const key = createHash('sha256')
        .update(
          JSON.stringify(config) +
            Object.values(bundle)
              .map((b) => (b.type === 'chunk' ? b.code : String(b.source)))
              .join(''),
        )
        .digest('hex')
        .slice(0, 16);
      this.emitFile({
        type: 'asset',
        fileName: 'sw.js',
        source: `const CACHE=${JSON.stringify(prefix + key)},BASE=${JSON.stringify(config.basePath)},ASSETS=${JSON.stringify(assets)};
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS.map(a=>BASE+a))).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(${JSON.stringify(prefix)})&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(e.request.method!=='GET'||u.origin!==location.origin||!u.pathname.startsWith(BASE)||u.pathname.includes('/api/')||!ASSETS.some(a=>u.pathname===BASE+a)&&e.request.mode!=='navigate')return;
e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request,{ignoreVary:true}).then(r=>r||(e.request.mode==='navigate'?caches.match(BASE+'index.html'):Response.error()))));});`,
      });
    },
  };
}
