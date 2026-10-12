import OpenAI, { toFile } from 'openai';
import type { ServerContext } from '@kieksme/csp-sdk';
const limit = 10 * 1024 * 1024;
const formats: Record<string, string> = {
  'audio/webm': 'webm',
  'audio/mp4': 'mp4',
  'video/mp4': 'mp4',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/mpeg': 'mp3',
};
export function validAudio(bytes: Buffer, format: string) {
  if (format === 'webm')
    return bytes.subarray(0, 4).equals(Buffer.from([0x1a, 0x45, 0xdf, 0xa3]));
  if (format === 'mp4') return bytes.subarray(4, 8).toString() === 'ftyp';
  if (format === 'ogg') return bytes.subarray(0, 4).toString() === 'OggS';
  if (format === 'wav')
    return (
      bytes.subarray(0, 4).toString() === 'RIFF' &&
      bytes.subarray(8, 12).toString() === 'WAVE'
    );
  return (
    bytes.subarray(0, 3).toString() === 'ID3' ||
    (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  );
}
export function setupTranscription(
  ctx: ServerContext,
  config: {
    CSP_CHAT_TRANSCRIPTION_ENABLED: string;
    CSP_CHAT_TRANSCRIPTION_MODEL: string;
    CSP_CHAT_PROVIDER: string;
    CSP_CHAT_OPENAI_API_KEY?: string;
    CSP_CHAT_OPENAI_URL?: string;
    CSP_CHAT_RATE_LIMIT: number;
    CSP_CHAT_CONCURRENCY: number;
    CSP_CHAT_TIMEOUT_MS: number;
  },
  demo: boolean,
) {
  const enabled =
    !demo &&
    config.CSP_CHAT_TRANSCRIPTION_ENABLED === 'true' &&
    config.CSP_CHAT_PROVIDER === 'openai' &&
    Boolean(config.CSP_CHAT_OPENAI_API_KEY);
  ctx.app.get('/api/v1/chat/capabilities', async () => ({
    transcription: enabled,
    maxRecordingSeconds: 60,
    maxAudioBytes: limit,
  }));
  const client = enabled
    ? new OpenAI({
        apiKey: config.CSP_CHAT_OPENAI_API_KEY,
        baseURL: config.CSP_CHAT_OPENAI_URL,
        fetch: ctx.fetch,
        maxRetries: 0,
      })
    : undefined;
  const windows = new Map<string, { count: number; until: number }>();
  let active = 0;
  const reservations = new WeakSet<object>();
  const release = (req: object) => {
    if (reservations.delete(req)) active--;
  };
  const controllers = new Set<AbortController>();
  ctx.app.addHook('preClose', async () => {
    for (const controller of controllers) controller.abort();
  });
  ctx.app.register(async (scope) => {
    scope.addHook('onResponse', async (req) => release(req));
    scope.addHook('onRequestAbort', async (req) => release(req));
    scope.addContentTypeParser(
      Object.keys(formats),
      { parseAs: 'buffer', bodyLimit: limit },
      (_req, body, done) => done(null, body),
    );
    scope.post(
      '/api/v1/chat/transcriptions',
      {
        bodyLimit: limit,
        onRequest: async (req, reply) => {
          if (!enabled)
            return reply
              .code(404)
              .send({ error: 'Spracheingabe ist nicht verfügbar.' });
          const identity = ctx.config.chatSupport
            ? await ctx.authenticateChat?.(req.headers.authorization)
            : undefined;
          if (ctx.config.chatSupport && !identity)
            return reply
              .code(401)
              .send({ error: 'Chat-Anmeldung erforderlich.' });
          const now = Date.now();
          for (const [key, value] of windows)
            if (value.until <= now) windows.delete(key);
          const keys = [
            'ip:' + req.ip,
            ...(identity
              ? ['user:' + identity.tenantId + ':' + identity.userId]
              : []),
          ];
          if (
            active >= config.CSP_CHAT_CONCURRENCY ||
            windows.size >= 10000 ||
            keys.some(
              (key) =>
                (windows.get(key)?.count ?? 0) >= config.CSP_CHAT_RATE_LIMIT,
            )
          )
            return reply
              .code(429)
              .header('Retry-After', '60')
              .send({ error: 'Bitte warten Sie eine Minute.' });
          active++;
          reservations.add(req);
          for (const key of keys) {
            const value = windows.get(key) ?? { count: 0, until: now + 60000 };
            value.count++;
            windows.set(key, value);
          }
        },
      },
      async (req, reply) => {
        const mime = req.headers['content-type']?.split(';')[0].trim() ?? '',
          format = formats[mime],
          bytes = req.body;
        if (
          !format ||
          !Buffer.isBuffer(bytes) ||
          !bytes.length ||
          !validAudio(bytes, format)
        )
          return reply.code(400).send({ error: 'Ungültige Audioaufnahme.' });
        const controller = new AbortController();
        controllers.add(controller);
        const timeout = setTimeout(
            () => controller.abort(),
            config.CSP_CHAT_TIMEOUT_MS,
          ),
          cancel = () => controller.abort();
        reply.raw.on('close', cancel);
        try {
          const result = await client!.audio.transcriptions.create(
            {
              file: await toFile(bytes, 'recording.' + format, { type: mime }),
              model: config.CSP_CHAT_TRANSCRIPTION_MODEL,
              response_format: 'json',
            },
            { signal: controller.signal },
          );
          if (typeof result.text !== 'string' || !result.text.trim())
            return reply.code(422).send({
              error: 'Keine Sprache erkannt. Bitte versuchen Sie es erneut.',
            });
          if (result.text.length > 4000)
            return reply.code(422).send({
              error:
                'Die Aufnahme enthält zu viel Text. Bitte kürzer diktieren.',
            });
          return { text: result.text.trim() };
        } catch {
          return reply.code(controller.signal.aborted ? 504 : 503).send({
            error:
              'Spracheingabe derzeit nicht verfügbar. Ihr Entwurf bleibt erhalten.',
          });
        } finally {
          clearTimeout(timeout);
          reply.raw.off('close', cancel);
          controllers.delete(controller);
        }
      },
    );
  });
}
