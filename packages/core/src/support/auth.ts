import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { ChatError, type Identity } from './conversations.js';
export function portalAuthenticator(
  tenantId: string,
  audience: string,
  scope: string,
  key?: JWTVerifyGetKey,
) {
  const issuer = `https://login.microsoftonline.com/${tenantId}/v2.0`;
  const keys =
    key ??
    createRemoteJWKSet(
      new URL(
        `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`,
      ),
    );
  return async (authorization?: string): Promise<Identity> => {
    try {
      if (!authorization?.startsWith('Bearer '))
        throw new Error('Missing token');
      const { payload: p } = await jwtVerify(authorization.slice(7), keys, {
        issuer,
        audience,
        algorithms: ['RS256'],
        requiredClaims: ['exp', 'iat', 'tid', 'oid', 'scp'],
      });
      if (
        p.tid !== tenantId ||
        typeof p.oid !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(p.oid) ||
        typeof p.scp !== 'string' ||
        !p.scp.split(' ').includes(scope)
      )
        throw new Error('Invalid identity');
      return {
        tenantId,
        userId: p.oid,
        name:
          typeof p.name === 'string' ? p.name.slice(0, 200) : 'Portal-Nutzer',
        email:
          typeof p.preferred_username === 'string'
            ? p.preferred_username.slice(0, 200)
            : undefined,
      };
    } catch {
      throw new ChatError(
        401,
        'Bitte melden Sie sich erneut mit Ihrem Microsoft-Konto an.',
      );
    }
  };
}
