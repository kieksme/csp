import { mkdtemp, writeFile, rm, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';
import { expect, it } from 'vitest';
import { portalBuild, publicConfig } from '../packages/core/src/build.js';
import { createServer } from '../packages/core/src/server.js';

it.each(['/', '/pilot/'])(
  'emits crawler policy in initial HTML and static artifacts at %s',
  async (basePath) => {
    const root = await realpath(await mkdtemp(join(tmpdir(), 'csp-search-')));
    try {
      await writeFile(
        join(root, 'index.html'),
        '<html><head><meta name="robots" content="index, follow"></head><body>Portal</body></html>',
      );
      const result = await build({
        configFile: false,
        root,
        logLevel: 'silent',
        plugins: [portalBuild(publicConfig({ CSP_BASE_PATH: basePath }))],
        build: { write: false },
      });
      if (Array.isArray(result) || !('output' in result))
        throw new Error('Expected build output');
      const asset = (name: string) => {
        const item = result.output.find((entry) => entry.fileName === name);
        if (!item || item.type !== 'asset') throw new Error(`Missing ${name}`);
        return String(item.source);
      };
      expect(asset('index.html')).toContain(
        '<meta name="robots" content="noindex, nofollow">',
      );
      expect(asset('index.html').match(/name="robots"/g)).toHaveLength(1);
      expect(asset('robots.txt')).toBe('User-agent: *\nDisallow: /\n');
      expect(asset('sw.js')).not.toContain('_headers');
      expect(asset('sw.js')).not.toContain('robots.txt');
      expect(asset('_headers')).toBe('/*\n  X-Robots-Tag: noindex, nofollow\n');
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  },
);

it('sets API crawler headers on success and errors and serves root robots as text', async () => {
  const app = await createServer({ plugins: [], config: publicConfig({}) });
  try {
    for (const url of ['/health', '/missing', '/robots.txt']) {
      const response = await app.inject({ url });
      expect(response.headers['x-robots-tag']).toBe('noindex, nofollow');
    }
    const response = await app.inject({ url: '/robots.txt' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.body).toBe('User-agent: *\nDisallow: /\n');
  } finally {
    await app.close();
  }
});
