import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import type { ServerContext } from '@kieksme/csp-sdk';
import { ChatError, type Identity } from './conversations.js';

const issuer = 'csp:anonymous-support';
const lifetime = 24 * 60 * 60;

// An anonymous session is a conversation capability, never a verified person.
export function setupAnonymousSessions(ctx: ServerContext, secret: string) {
  if (!/^[a-f0-9]{64}$/i.test(secret))
    throw new Error(
      'Anonymous support requires a random 32-byte session secret',
    );
  const key = Buffer.from(secret, 'hex');
  const issued = new Map<string, { count: number; until: number }>();
  const requests = new Map<string, { count: number; until: number }>();
  function limit(
    windows: typeof issued,
    ip: string,
    max: number,
    duration: number,
  ) {
    const now = Date.now();
    for (const [id, w] of windows) if (w.until <= now) windows.delete(id);
    const w = windows.get(ip) ?? { count: 0, until: now + duration };
    if (w.count >= max || (windows.size >= 10000 && !windows.has(ip)))
      throw new ChatError(429, 'Bitte versuchen Sie es später erneut.');
    w.count++;
    windows.set(ip, w);
  }
  ctx.app.addHook('preHandler', async (req) => {
    if (
      req.method === 'POST' &&
      req.routeOptions.url?.startsWith('/api/v1/conversations')
    )
      limit(requests, req.ip, 30, 60000);
  });
  ctx.app.post('/api/v1/conversations/session', async (req, reply) => {
    limit(issued, req.ip, 5, 3600000);
    const id = randomUUID();
    const expires = Math.floor(Date.now() / 1000) + lifetime;
    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
      .setIssuer(issuer)
      .setAudience(issuer)
      .setSubject(id)
      .setIssuedAt()
      .setExpirationTime(expires)
      .sign(key);
    return reply.header('Cache-Control', 'no-store, private').send({
      token,
      expiresAt: expires * 1000,
      name: `Besucher ${id.slice(0, 8)}`,
    });
  });
  return async (authorization?: string): Promise<Identity> => {
    try {
      if (!authorization?.startsWith('Bearer '))
        throw new Error('Missing session');
      const { payload } = await jwtVerify(authorization.slice(7), key, {
        algorithms: ['HS256'],
        issuer,
        audience: issuer,
        requiredClaims: ['exp', 'iat', 'sub'],
      });
      if (
        typeof payload.sub !== 'string' ||
        !/^[a-f0-9-]{36}$/i.test(payload.sub)
      )
        throw new Error('Invalid session');
      return {
        tenantId: 'anonymous',
        userId: payload.sub,
        name: `Besucher ${payload.sub.slice(0, 8)}`,
      };
    } catch {
      throw new ChatError(
        401,
        'Chat-Sitzung abgelaufen. Bitte verbinden Sie den Chat neu.',
      );
    }
  };
}
