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
