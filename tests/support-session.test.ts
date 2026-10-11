import { expect, it, vi } from 'vitest';
import type { BrowserContext } from '../packages/sdk/src/index.js';
import { supportSession } from '../packages/plugin-chat/src/support-session.js';
import { publicConfig } from '../packages/core/src/config.js';
function context(request: typeof fetch): BrowserContext {
  return {
    config: {
      ...publicConfig({}),
      apiUrl: 'https://portal.example.org',
      chatSupport: {
        mode: 'teams',
        auth: 'session',
        tenantId: 'tenant',
        clientId: 'client',
        scope: 'api://api/Chat.Access',
      },
    },
    request,
  } as BrowserContext;
}
it('uses the existing portal session and exposes only the API-confirmed display name', async () => {
  const request = vi.fn<typeof fetch>(async () =>
    Response.json({ name: 'Ada Lovelace' }),
  );
  const session = await supportSession(context(request));
  expect(await session.token()).toBe('');
  expect(session.name).toBe('Ada Lovelace');
  expect(request).toHaveBeenCalledWith(
    'https://portal.example.org/api/v1/conversations/identity',
    {
      credentials: 'same-origin',
      cache: 'no-store',
    },
  );
  expect(await session.token()).toBe('');
  expect(request).toHaveBeenCalledTimes(1);
  const reload = vi.fn();
  vi.stubGlobal('window', { location: { reload } });
  try {
    await session.login();
    expect(reload).toHaveBeenCalledOnce();
  } finally {
    vi.unstubAllGlobals();
  }
});
it('does not mark expired or malformed portal identity as authenticated and retries after recovery', async () => {
  const request = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(new Response(null, { status: 401 }))
    .mockResolvedValueOnce(Response.json({ name: '' }))
    .mockResolvedValueOnce(Response.json({ name: 'Ada' }));
  const session = await supportSession(context(request));
  await expect(session.token()).rejects.toThrow('erneuern');
  await expect(session.token()).rejects.toThrow('nicht verfügbar');
  expect(session.name).toBe('Portal-Nutzer');
  expect(await session.token()).toBe('');
  expect(session.name).toBe('Ada');
});
it('creates an anonymous session without MSAL and reuses it after a reload', async () => {
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    sessionStorage: {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => storage.set(k, v),
      removeItem: (k: string) => storage.delete(k),
    },
    location: { reload: vi.fn() },
  });
  try {
    const request = vi.fn<typeof fetch>(async () =>
      Response.json({
        token: 'server-signed-test-token',
        name: 'Besucher abc',
        expiresAt: Date.now() + 60000,
      }),
    );
    const ctx = context(request);
    ctx.config.chatSupport = { mode: 'slack', auth: 'anonymous' };
    const first = await supportSession(ctx);
    expect(await first.token()).toBe('server-signed-test-token');
    const second = await supportSession(ctx);
    expect(await second.token()).toBe('server-signed-test-token');
    expect(second.name).toBe('Besucher abc');
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith(
      'https://portal.example.org/api/v1/conversations/session',
      { method: 'POST', credentials: 'omit', cache: 'no-store' },
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
