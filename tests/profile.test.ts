import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { loadProfile } from '../packages/core/src/profile.js';
const paths: string[] = [];
afterEach(() =>
  paths.splice(0).forEach((p) => rmSync(p, { recursive: true, force: true })),
);
function fixture(overrides: Record<string, unknown> = {}) {
  const directory = mkdtempSync(join(tmpdir(), 'csp-profile-'));
  paths.push(directory);
  writeFileSync(
    join(directory, 'content.json'),
    JSON.stringify({
      faq: [
        {
          id: 'test',
          category: 'Help',
          question: 'Question',
          answer: 'Answer',
        },
      ],
    }),
  );
  const file = join(directory, 'portal.config.json');
  writeFileSync(
    file,
    JSON.stringify({
      schemaVersion: 1,
      id: 'test',
      branding: { name: 'Customer' },
      contact: { phone: '+4930123456' },
      public: { apiUrl: 'https://api.example.org', basePath: '/portal/' },
      contentFile: 'content.json',
      plugins: [],
      ...overrides,
    }),
  );
  return { file, directory };
}
it('loads profile-relative content and explicit overrides without exposing secrets', () => {
  const { file } = fixture();
  const result = loadProfile(file, {
    CSP_NAME: 'Environment',
    CSP_SIGNL4_API_KEY: 'sentinel',
    UNLISTED: 'sentinel',
  });
  expect(result.config.name).toBe('Environment');
  expect(result.config.content.faq[0].answer).toBe('Answer');
  expect(JSON.stringify(result.config)).not.toContain('sentinel');
  expect(result.env.CSP_SIGNL4_API_KEY).toBe('sentinel');
  expect(result.origins.CSP_NAME).toBe('environment');
});
it('rejects unknown keys, malformed booleans and empty overrides', () => {
  expect(() => loadProfile(fixture({ apiKey: 'secret' }).file)).toThrow(
    'Unrecognized',
  );
  const { file } = fixture();
  expect(() => loadProfile(file, { CSP_DEMO: '1' })).toThrow('true or false');
  expect(() => loadProfile(file, { CSP_NAME: '' })).toThrow('Empty');
  expect(() => loadProfile(file, { CSP_POLL_MS: '1e4' })).toThrow('integer');
});
it('copies only referenced assets, supports name and ID avatars with a subpath', () => {
  const { directory, file } = fixture({
    branding: { name: 'Customer', logoFile: 'public/logo.svg' },
    avatarsFile: 'avatars.json',
  });
  mkdirSync(join(directory, 'public'));
  writeFileSync(
    join(directory, 'public/logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg"/>',
  );
  writeFileSync(join(directory, 'public/unused.eps'), 'not for browsers');
  writeFileSync(
    join(directory, 'avatars.json'),
    JSON.stringify({
      ids: { 'user-1': 'public/logo.svg' },
      names: { ' Lena Demo ': 'public/logo.svg' },
    }),
  );
  const result = loadProfile(file);
  expect(result.config.logo).toMatch(/^\/portal\/assets\//);
  expect(result.config.avatarNames?.['lena demo']).toBe(
    result.config.avatarOverrides['user-1'],
  );
  expect(result.assets.every((a) => a.source.endsWith('logo.svg'))).toBe(true);
});
it('rejects production example values and missing content', () => {
  const { file } = fixture();
  expect(() =>
    loadProfile(file, { CSP_API_URL: 'https://api.example.invalid' }, true),
  ).toThrow('example.invalid');
  expect(() =>
    loadProfile(file, { CSP_CONTACT_PHONE: '+49 000 000000' }, true),
  ).toThrow('hotline');
  expect(() => loadProfile(file, { CSP_CONTENT_PATH: 'missing.json' })).toThrow(
    'ENOENT',
  );
});
it('loads API env files in documented order without build-mode files', async () => {
  const { directory } = fixture();
  writeFileSync(
    join(directory, '.env.branding'),
    'CSP_NAME=Brand\nCSP_API_URL=https://api.example.org',
  );
  writeFileSync(join(directory, '.env'), 'CSP_NAME=Env');
  writeFileSync(join(directory, '.env.local'), 'CSP_NAME=Local');
  writeFileSync(join(directory, '.env.production'), 'CSP_NAME=Build only');
  const { loadRuntimeEnv } = await import('../packages/core/src/profile.js');
  expect(loadRuntimeEnv(directory, {}).CSP_NAME).toBe('Local');
  expect(loadRuntimeEnv(directory, { CSP_NAME: 'Process' }).CSP_NAME).toBe(
    'Process',
  );
});
it('accepts the existing-session chat authentication mode and rejects unsupported modes', () => {
  const chatSupport = {
    mode: 'teams',
    auth: 'session',
    tenantId: '12e29f7c-8633-4490-ab9d-95ba84981681',
    clientId: '88a2d0d0-971b-4963-b59f-805b08738f36',
    scope: 'api://88a2d0d0-971b-4963-b59f-805b08738f36/Chat.Access',
  };
  const plugins = ['@kieksme/csp-plugin-chat', '@kieksme/csp-plugin-teams'];
  expect(
    loadProfile(fixture({ chatSupport, plugins }).file).config.chatSupport
      ?.auth,
  ).toBe('session');
  expect(() =>
    loadProfile(
      fixture({
        chatSupport: { ...chatSupport, auth: 'trusted-name-header' },
        plugins,
      }).file,
    ),
  ).toThrow();
});
