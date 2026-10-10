import { z } from 'zod';
export const configSchema = z
  .object({
    CSP_TEAMS_ENABLED: z.enum(['true', 'false']).default('false'),
    CSP_TEAMS_DEMO: z.enum(['true', 'false']).default('false'),
    CSP_DEMO: z.string().optional(),
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
    CSP_TEAMS_APP_ID: z.string().uuid().optional(),
    CSP_TEAMS_APP_SECRET: z.string().min(1).optional(),
    CSP_TEAMS_TEAM_ID: z.string().min(1).optional(),
    CSP_TEAMS_CHANNEL_ID: z.string().min(1).optional(),
    CSP_TEAMS_SERVICE_URL: z
      .string()
      .url()
      .default('https://smba.trafficmanager.net/teams/'),
    CSP_TEAMS_SUPPORT_GROUP_ID: z.string().uuid().optional(),
  })
  .superRefine((c, ctx) => {
    if (c.CSP_TEAMS_DEMO === 'true') {
      if (c.CSP_TEAMS_ENABLED === 'true' || c.CSP_DEMO !== 'true')
        ctx.addIssue({
          code: 'custom',
          message:
            'Support demo requires CSP_DEMO=true and CSP_TEAMS_ENABLED=false',
        });
      return;
    }
    if (c.CSP_TEAMS_ENABLED !== 'true') return;
    for (const key of [
      'CSP_CHAT_DATABASE_URL',
      'CSP_ENTRA_TENANT_ID',
      'CSP_ENTRA_API_AUDIENCE',
      'CSP_ENTRA_PORTAL_CLIENT_ID',
      'CSP_TEAMS_APP_ID',
      'CSP_TEAMS_APP_SECRET',
      'CSP_TEAMS_TEAM_ID',
      'CSP_TEAMS_CHANNEL_ID',
      'CSP_TEAMS_SUPPORT_GROUP_ID',
    ] as const)
      if (!c[key])
        ctx.addIssue({
          code: 'custom',
          path: [key],
          message: 'Required for Teams support',
        });
    if (!/^postgres(?:ql)?:\/\//.test(c.CSP_CHAT_DATABASE_URL ?? ''))
      ctx.addIssue({
        code: 'custom',
        path: ['CSP_CHAT_DATABASE_URL'],
        message: 'Use a PostgreSQL connection URL',
      });
    if (
      new URL(c.CSP_TEAMS_SERVICE_URL).protocol !== 'https:' ||
      new URL(c.CSP_TEAMS_SERVICE_URL).username ||
      new URL(c.CSP_TEAMS_SERVICE_URL).password ||
      new URL(c.CSP_TEAMS_SERVICE_URL).port ||
      ![
        'smba.trafficmanager.net',
        'smba.infra.gcc.teams.microsoft.com',
        'smba.infra.gov.teams.microsoft.us',
        'smba.infra.dod.teams.microsoft.us',
      ].includes(new URL(c.CSP_TEAMS_SERVICE_URL).hostname)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['CSP_TEAMS_SERVICE_URL'],
        message: 'Expected a Microsoft Teams service URL',
      });
  });
export type TeamsConfig = z.infer<typeof configSchema>;
