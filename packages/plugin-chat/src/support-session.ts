import type { BrowserContext } from '@kieksme/csp-sdk';

interface Session {
  token(): Promise<string>;
  login(): Promise<void>;
  name: string;
}
export async function supportSession(ctx: BrowserContext): Promise<Session> {
  const c = ctx.config.chatSupport!;
  if (c.mode === 'demo')
    return {
      token: async () => '',
      login: async () => {},
      name: 'Portal-Nutzer Demo',
    };
  if (c.auth === 'anonymous') return anonymousSession(ctx);
  if (c.auth === 'session') return cookieSession(ctx);
  const { PublicClientApplication } = await import('@azure/msal-browser');
  const client = new PublicClientApplication({
    auth: {
      clientId: c.clientId!,
      authority: `https://login.microsoftonline.com/${c.tenantId}`,
      redirectUri: window.location.origin + ctx.config.basePath,
    },
    cache: { cacheLocation: 'sessionStorage' },
  });
  await client.initialize();
  const redirected = await client.handleRedirectPromise();
  const account =
    redirected?.account ??
    client.getAllAccounts().find((a) => a.tenantId === c.tenantId);
  return {
    name: account?.name ?? 'Microsoft-Konto',
    async token() {
      if (!account) throw new Error('Bitte mit Microsoft anmelden.');
      return (await client.acquireTokenSilent({ account, scopes: [c.scope!] }))
        .accessToken;
    },
    async login() {
      await client.acquireTokenRedirect({ scopes: [c.scope!], account });
    },
  };
}

function cookieSession(ctx: BrowserContext): Session {
  // Tokens stay in the trusted gateway; identity is validated by the API.
  let loaded = false;
  const current: Session = {
    name: 'Portal-Nutzer',
    async token() {
      if (!loaded) {
        const response = await (ctx.request ?? fetch)(
          ctx.config.apiUrl + '/api/v1/conversations/identity',
          { credentials: 'same-origin', cache: 'no-store' },
        );
        if (!response.ok)
          throw new Error(
            response.status === 401
              ? 'Bitte erneuern Sie Ihre Portal-Anmeldung.'
              : 'Portal-Anmeldung derzeit nicht verfügbar.',
          );
        const identity = await response.json();
        if (
          typeof identity.name !== 'string' ||
          !identity.name.trim() ||
          identity.name.length > 200
        )
          throw new Error('Portal-Anmeldung derzeit nicht verfügbar.');
        current.name = identity.name;
        loaded = true;
      }
      return '';
    },
    async login() {
      window.location.reload();
    },
  };
  return current;
}

function anonymousSession(ctx: BrowserContext): Session {
  const key = `csp-support:${ctx.config.apiUrl}`;
  let saved: { token: string; expiresAt: number; name: string } | undefined;
  try {
    const value = JSON.parse(window.sessionStorage.getItem(key) ?? 'null');
    if (
      typeof value?.token === 'string' &&
      typeof value?.expiresAt === 'number' &&
      value.expiresAt > Date.now() &&
      typeof value?.name === 'string'
    )
      saved = value;
  } catch {
    /* Storage may be unavailable; use this page's memory. */
  }
  let pending: Promise<string> | undefined;
  const current: Session = {
    name: saved?.name ?? 'Besucher',
    async token() {
      if (saved) {
        if (saved.expiresAt <= Date.now())
          throw new Error(
            'Chat-Sitzung abgelaufen. Bitte verbinden Sie den Chat neu.',
          );
        return saved.token;
      }
      if (pending) return pending;
      pending = (async () => {
        const response = await (ctx.request ?? fetch)(
          ctx.config.apiUrl + '/api/v1/conversations/session',
          {
            method: 'POST',
            credentials: 'omit',
            cache: 'no-store',
          },
        );
        if (!response.ok)
          throw new Error(
            'Chat derzeit nicht verfügbar. Bitte versuchen Sie es später erneut.',
          );
        const value = await response.json();
        if (
          typeof value.token !== 'string' ||
          typeof value.expiresAt !== 'number' ||
          value.expiresAt <= Date.now() ||
          typeof value.name !== 'string'
        )
          throw new Error('Chat derzeit nicht verfügbar.');
        saved = value;
        current.name = value.name;
        try {
          window.sessionStorage.setItem(key, JSON.stringify(value));
        } catch {}
        return value.token;
      })();
      try {
        return await pending;
      } finally {
        pending = undefined;
      }
    },
    async login() {
      try {
        window.sessionStorage.removeItem(key);
      } catch {}
      window.location.reload();
    },
  };
  return current;
}
