import { z } from 'zod';
const userId = z
  .string()
  .regex(/^[1-9][0-9]{0,15}$/)
  .refine((v) => Number.isSafeInteger(Number(v)));
export const configSchema = z
  .object({
    CSP_TELEGRAM_ENABLED: z.enum(['true', 'false']).default('false'),
    CSP_TELEGRAM_DEMO: z.enum(['true', 'false']).default('false'),
    CSP_DEMO: z.string().optional(),
    CSP_TELEGRAM_AUTH: z.enum(['entra', 'anonymous']).default('entra'),
    CSP_CHAT_SESSION_SECRET: z
      .string()
      .regex(/^[a-f0-9]{64}$/i)
      .optional(),
    CSP_CHAT_DATABASE_URL: z.string().url().optional(),
    CSP_CHAT_RETENTION_DAYS: z.coerce
      .number()
      .int()
      .min(1)
      .max(365)
      .default(30),
    CSP_ENTRA_TENANT_ID: z.string().uuid().optional(),
    CSP_ENTRA_API_AUDIENCE: z.string().uuid().optional(),
    CSP_ENTRA_API_SCOPE: z.string().min(1).default('Chat.Access'),
    CSP_ENTRA_PORTAL_CLIENT_ID: z.string().uuid().optional(),
    CSP_TELEGRAM_BOT_TOKEN: z
      .string()
      .regex(/^[1-9][0-9]{4,15}:[A-Za-z0-9_-]{20,}$/)
      .optional(),
    CSP_TELEGRAM_WEBHOOK_SECRET: z
      .string()
      .regex(/^[A-Za-z0-9_-]{32,256}$/)
      .optional(),
    CSP_TELEGRAM_CHAT_ID: z
      .string()
      .regex(/^-100[0-9]{5,13}$/)
      .refine((v) => Number.isSafeInteger(Number(v)))
      .optional(),
    CSP_TELEGRAM_SUPPORT_USER_IDS: z
      .string()
      .transform((v) =>
        v
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
      .pipe(z.array(userId).min(1).max(100))
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.CSP_TELEGRAM_DEMO === 'true') {
      if (c.CSP_TELEGRAM_ENABLED === 'true' || c.CSP_DEMO !== 'true')
        ctx.addIssue({
          code: 'custom',
          message:
            'Support demo requires CSP_DEMO=true and CSP_TELEGRAM_ENABLED=false',
        });
      return;
    }
    if (c.CSP_TELEGRAM_ENABLED !== 'true') return;
    for (const key of [
      'CSP_CHAT_DATABASE_URL',
      'CSP_TELEGRAM_BOT_TOKEN',
      'CSP_TELEGRAM_WEBHOOK_SECRET',
      'CSP_TELEGRAM_CHAT_ID',
      'CSP_TELEGRAM_SUPPORT_USER_IDS',
    ] as const) {
      if (!c[key])
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required for Telegram support',
        });
    }
    for (const key of c.CSP_TELEGRAM_AUTH === 'anonymous'
      ? (['CSP_CHAT_SESSION_SECRET'] as const)
      : ([
          'CSP_ENTRA_TENANT_ID',
          'CSP_ENTRA_API_AUDIENCE',
          'CSP_ENTRA_PORTAL_CLIENT_ID',
        ] as const))
      if (!c[key])
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required for Telegram authentication',
        });
    if (!/^postgres(?:ql)?:\/\//.test(c.CSP_CHAT_DATABASE_URL ?? ''))
      ctx.addIssue({
        code: 'custom',
        path: ['CSP_CHAT_DATABASE_URL'],
        message: 'Use a PostgreSQL connection URL',
      });
  });
export type TelegramConfig = z.infer<typeof configSchema>;
