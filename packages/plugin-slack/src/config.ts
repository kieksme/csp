import { z } from 'zod';
const slackId = (prefix: string) =>
  z.string().regex(new RegExp(`^[${prefix}][A-Z0-9]{2,}$`));
export const configSchema = z
  .object({
    CSP_SLACK_ENABLED: z.enum(['true', 'false']).default('false'),
    CSP_SLACK_DEMO: z.enum(['true', 'false']).default('false'),
    CSP_DEMO: z.string().optional(),
    CSP_SLACK_AUTH: z.enum(['entra', 'anonymous']).default('entra'),
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
    CSP_SLACK_BOT_TOKEN: z
      .string()
      .regex(/^xoxb-\S+$/)
      .optional(),
    CSP_SLACK_SIGNING_SECRET: z.string().min(16).optional(),
    CSP_SLACK_TEAM_ID: slackId('T').optional(),
    CSP_SLACK_CHANNEL_ID: slackId('CG').optional(),
    CSP_SLACK_APP_ID: slackId('A').optional(),
    CSP_SLACK_SUPPORT_USER_IDS: z
      .string()
      .transform((v) =>
        v
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      )
      .pipe(z.array(slackId('UW')).min(1).max(100))
      .optional(),
  })
  .superRefine((c, ctx) => {
    if (c.CSP_SLACK_DEMO === 'true') {
      if (c.CSP_SLACK_ENABLED === 'true' || c.CSP_DEMO !== 'true')
        ctx.addIssue({
          code: 'custom',
          message:
            'Support demo requires CSP_DEMO=true and CSP_SLACK_ENABLED=false',
        });
      return;
    }
    if (c.CSP_SLACK_ENABLED !== 'true') return;
    for (const key of [
      'CSP_CHAT_DATABASE_URL',
      'CSP_SLACK_BOT_TOKEN',
      'CSP_SLACK_SIGNING_SECRET',
      'CSP_SLACK_TEAM_ID',
      'CSP_SLACK_CHANNEL_ID',
      'CSP_SLACK_APP_ID',
      'CSP_SLACK_SUPPORT_USER_IDS',
    ] as const) {
      if (!c[key])
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required for Slack support',
        });
    }
    for (const key of c.CSP_SLACK_AUTH === 'anonymous'
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
          message: 'Required for Slack authentication',
        });
    if (!/^postgres(?:ql)?:\/\//.test(c.CSP_CHAT_DATABASE_URL ?? ''))
      ctx.addIssue({
        code: 'custom',
        path: ['CSP_CHAT_DATABASE_URL'],
        message: 'Use a PostgreSQL connection URL',
      });
  });
export type SlackConfig = z.infer<typeof configSchema>;
