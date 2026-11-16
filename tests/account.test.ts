import { afterEach, expect, it, vi } from 'vitest';
import { getAccount, publishAccount } from '../packages/sdk/src/account.js';
import { initials } from '../packages/core/src/account-menu.js';
import type { BrowserContext } from '../packages/sdk/src/index.js';
import { supportSession } from '../packages/plugin-chat/src/support-session.js';
import { publicConfig } from '../packages/core/src/config.js';
afterEach(() => {
  publishAccount(null);
  vi.unstubAllGlobals();
});
it('publishes and clears the account', () => {
  expect(getAccount()).toBeNull();
  publishAccount({ name: 'Ada Lovelace' });
  expect(getAccount()?.name).toBe('Ada Lovelace');
  publishAccount(null);
  expect(getAccount()).toBeNull();
});
it('derives initials from first and last name', () => {
  expect(initials('Ada Lovelace')).toBe('AL');
  expect(initials('  ada   king  lovelace ')).toBe('AL');
  expect(initials('Ada')).toBe('A');
  expect(initials('')).toBe('?');
  expect(initials('Émile Zola')).toBe('ÉZ');
});
function sessionContext(logoutUrl?: string): BrowserContext {
  return {
    config: {
      ...publicConfig({}),
      apiUrl: 'https://portal.example.org',
      chatSupport: {
        mode: 'teams',
        auth: 'session',
        tenantId: 't',
        clientId: 'c',
        scope: 's',
        logoutUrl,
      },
    },
    request: async () => Response.json({ name: 'Ada Lovelace' }),
  } as unknown as BrowserContext;
}
it('publishes the API-confirmed identity with a logout for session auth', async () => {
  const assign = vi.fn();
  vi.stubGlobal('window', { location: { assign } });
  const session = await supportSession(sessionContext('/oauth2/sign_out'));
  expect(getAccount()).toBeNull();
  await session.token();
  const account = getAccount();
  expect(account?.name).toBe('Ada Lovelace');
  await account?.logout?.();
  expect(assign).toHaveBeenCalledWith('/oauth2/sign_out');
  expect(getAccount()).toBeNull();
});
it('offers no logout without a configured logoutUrl', async () => {
  const session = await supportSession(sessionContext());
  await session.token();
  expect(getAccount()?.logout).toBeUndefined();
});
