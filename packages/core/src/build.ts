import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import sharp from 'sharp';
import type { PublicConfig } from '@kieksme/csp-sdk';
export { publicConfig } from './config.js';
import type { Plugin } from 'vite';
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
