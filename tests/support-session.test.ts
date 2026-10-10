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
