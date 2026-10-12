import { afterEach, expect, it, vi } from 'vitest';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import { setupAnonymousSessions } from '../packages/core/src/support.js';
import chat from '../packages/plugin-chat/src/server.js';
const apps: Awaited<ReturnType<typeof createServer>>[] = [];
afterEach(async () => {
  for (const app of apps.splice(0)) await app.close();
});
async function fixture(
  support = false,
  overrides: Record<string, string> = {},
) {
  const fetcher = vi.fn(async (_input: unknown, init?: RequestInit) => {
    expect(init?.body).toBeInstanceOf(FormData);
    return new Response(
      JSON.stringify({ text: 'Meine E-Mail funktioniert nicht.' }),
      { headers: { 'Content-Type': 'application/json' } },
    );
  }) as typeof fetch;
  Object.assign(fetcher, { Response });
  const app = await createServer({
    config: {
      ...publicConfig({}),
      ...(support
        ? {
            chatSupport: { mode: 'slack' as const, auth: 'anonymous' as const },
          }
        : {}),
    },
    env: {
      CSP_CHAT_PROVIDER: 'openai',
      CSP_CHAT_MODEL: 'test-only',
      CSP_CHAT_OPENAI_API_KEY: 'test-only-key',
      ...overrides,
    },
    fetch: fetcher,
    plugins: [
      chat,
      ...(support
        ? [
            {
              id: 'test-auth',
              sdkVersion: chat.sdkVersion,
              requires: ['chat'],
              configSchema: chat.configSchema,
              setup(ctx: Parameters<typeof chat.setup>[0]) {
                ctx.authenticateChat = setupAnonymousSessions(
                  ctx,
                  '1'.repeat(64),
                );
              },
            },
          ]
        : []),
    ],
  });
  apps.push(app);
  return { app, fetcher };
}
const audio = Buffer.from([0x1a, 0x45, 0xdf, 0xa3, 0, 0, 0, 0]);
const url = '/api/v1/chat/transcriptions';
it('transcribes only through the server, using the configured model and bounded audio without a conversation message', async () => {
  const { app, fetcher } = await fixture();
  expect((await app.inject('/api/v1/chat/capabilities')).json()).toMatchObject({
    transcription: true,
    maxRecordingSeconds: 60,
    maxAudioBytes: 10485760,
  });
  const response = await app.inject({
    method: 'POST',
    url,
    payload: audio,
    headers: { 'content-type': 'audio/webm;codecs=opus' },
  });
  expect(response.statusCode).toBe(200);
  expect(response.json()).toEqual({ text: 'Meine E-Mail funktioniert nicht.' });
  const form = vi.mocked(fetcher).mock.calls[0][1]!.body as FormData;
  expect(form.get('model')).toBe('gpt-4o-mini-transcribe');
  expect(form.get('file')).toBeInstanceOf(Blob);
  expect(String(vi.mocked(fetcher).mock.calls[0][0])).toContain(
    '/audio/transcriptions',
  );
});
it('requires the active support session, rejects forged tokens and preserves public capabilities without secrets', async () => {
  const { app, fetcher } = await fixture(true);
  for (const headers of [{}, { authorization: 'Bearer forged' }])
    expect(
      (
        await app.inject({
          method: 'POST',
          url,
          payload: audio,
          headers: { ...headers, 'content-type': 'audio/webm' },
        })
      ).statusCode,
    ).toBe(401);
  const session = (
    await app.inject({ method: 'POST', url: '/api/v1/conversations/session' })
  ).json();
  expect(
    (
      await app.inject({
        method: 'POST',
        url,
        payload: audio,
        headers: {
          authorization: `Bearer ${session.token}`,
          'content-type': 'audio/webm',
        },
      })
    ).statusCode,
  ).toBe(200);
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect((await app.inject('/api/v1/chat/capabilities')).body).not.toContain(
    'key',
  );
});
it('limits audio size, rejects spoofed formats and enforces per-IP quotas', async () => {
  const { app, fetcher } = await fixture(false, { CSP_CHAT_RATE_LIMIT: '3' });
  expect(
    (
      await app.inject({
        method: 'POST',
        url,
        payload: Buffer.from('not audio'),
        headers: { 'content-type': 'audio/webm' },
      })
    ).statusCode,
  ).toBe(400);
  expect(
    (
      await app.inject({
        method: 'POST',
        url,
        payload: Buffer.alloc(10485761),
        headers: { 'content-type': 'audio/webm' },
      })
    ).statusCode,
  ).toBe(413);
  expect(
    (
      await app.inject({
        method: 'POST',
        url,
        payload: audio,
        headers: { 'content-type': 'audio/webm' },
      })
    ).statusCode,
  ).toBe(200);
  expect(
    (
      await app.inject({
        method: 'POST',
        url,
        payload: audio,
        headers: { 'content-type': 'audio/webm' },
      })
    ).statusCode,
  ).toBe(429);
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('disables transcription for demo/non-OpenAI providers and returns safe errors on provider failure', async () => {
  const off = await fixture(false, { CSP_CHAT_TRANSCRIPTION_ENABLED: 'false' });
  expect(
    (await off.app.inject('/api/v1/chat/capabilities')).json().transcription,
  ).toBe(false);
  expect(
    (
      await off.app.inject({
        method: 'POST',
        url,
        payload: audio,
        headers: { 'content-type': 'audio/webm' },
      })
    ).statusCode,
  ).toBe(404);
  const demo = await fixture(false, { CSP_DEMO: 'true' });
  expect(
    (await demo.app.inject('/api/v1/chat/capabilities')).json().transcription,
  ).toBe(false);
  const live = await fixture();
  vi.mocked(live.fetcher).mockResolvedValueOnce(
    new Response('secret provider error', { status: 500 }),
  );
  const failure = await live.app.inject({
    method: 'POST',
    url,
    payload: audio,
    headers: { 'content-type': 'audio/webm' },
  });
  expect(failure.statusCode).toBe(503);
  expect(failure.body).not.toContain('secret');
});
