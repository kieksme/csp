import { cspPlugin } from '../package.json';
import { z } from 'zod';
import {
  jsonRequest,
  safeTimezone,
  vCard,
  type Person,
  type Shift,
  type Alert,
  type ServerPlugin,
  type ServerContext,
} from '@kieksme/csp-sdk';
const userSchema = z.object({
  id: z.string(),
  name: z.string().nullable().optional(),
  mail: z.string().nullable().optional(),
  isDeactivated: z.boolean().optional(),
  isEnabled: z.boolean().optional(),
  contactAddresses: z
    .array(
      z.object({
        address: z.string().nullable().optional(),
        countryCode: z.string().nullable().optional(),
        channel: z.number().optional(),
      }),
    )
    .nullable()
    .optional(),
});
const shiftSchema = z.object({
  userId: z.string(),
  start: z.string().datetime({ offset: true }),
  end: z.string().datetime({ offset: true }),
});
const alertSchema = z.object({
  id: z.string(),
  title: z.string().nullable(),
  text: z.string().nullable(),
  lastModified: z.string(),
  severity: z.number(),
  status: z.object({ statusCode: z.number() }),
  history: z.object({ created: z.string().optional() }).optional(),
});
export const configSchema = z
  .object({
    CSP_DEMO: z.string().optional(),
    CSP_SIGNL4_API_KEY: z.string().optional(),
    CSP_SIGNL4_TEAM_ID: z.string().optional(),
    CSP_SIGNL4_BASE_URL: z.string().url().optional(),
    CSP_SIGNL4_TIMEZONE: z.string().default('Europe/Berlin'),
    CSP_SIGNL4_HORIZON_DAYS: z.coerce.number().int().min(1).max(90).default(7),
  })
  .superRefine((e, ctx) => {
    if (e.CSP_DEMO !== 'true')
      for (const key of ['CSP_SIGNL4_API_KEY', 'CSP_SIGNL4_TEAM_ID'] as const)
        if (!e[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required outside demo mode',
          });
  });
export function normalizeTeam(raw: unknown): Person[] {
  const data = z
    .object({
      data: z.array(userSchema),
      errors: z.array(z.unknown()).optional(),
    })
    .parse(raw);
  if (data.errors?.length) throw new Error('SIGNL4 partial team response');
  return data.data
    .filter((u) => !u.isDeactivated && u.isEnabled !== false)
    .map((u) => ({
      id: u.id,
      name: u.name ?? 'Teammitglied',
      email: u.mail ?? undefined,
      phones: [
        ...new Set(
          (u.contactAddresses ?? [])
            .filter((a) => a.address && /^\+?[\d ()-]+$/.test(a.address))
            .map((a) =>
              a.address!.startsWith('+')
                ? a.address!
                : (a.countryCode ?? '') + a.address!,
            ),
        ),
      ],
      avatar: '/team/' + encodeURIComponent(u.id) + '/avatar',
      role: 'Operations',
    }));
}
export function normalizeShifts(
  raw: unknown,
  team: Person[],
  now = Date.now(),
): Shift[] {
  const names = new Map(team.map((p) => [p.id, p.name]));
  const sorted = z
    .array(shiftSchema)
    .parse(raw)
    .filter(
      (s) =>
        names.has(s.userId) &&
        Date.parse(s.end) > now &&
        Date.parse(s.end) > Date.parse(s.start),
    )
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
  const merged: Shift[] = [];
  for (const s of sorted) {
    const prev = merged.findLast((p) => p.userId === s.userId);
    if (prev && Date.parse(s.start) <= Date.parse(prev.end)) {
      if (Date.parse(s.end) > Date.parse(prev.end)) prev.end = s.end;
    } else merged.push({ ...s, name: names.get(s.userId)! });
  }
  return merged.sort((a, b) => Date.parse(a.start) - Date.parse(b.start));
}
export function normalizeAlerts(raw: unknown): Alert[] {
  return z
    .array(alertSchema)
    .parse(raw)
    .map((a) => ({
      id: a.id,
      title: a.title ?? 'Alert',
      description: a.text ?? '',
      status:
        (
          { 1: 'Offen', 2: 'Bestätigt', 4: 'Geschlossen' } as Record<
            number,
            string
          >
        )[a.status.statusCode] ?? 'Unbekannt',
      createdAt: a.history?.created ?? a.lastModified,
      severity: a.severity,
    }));
}
function demoTeam(): Person[] {
  return [
    {
      id: 'demo-lena',
      name: 'Lena Beispiel',
      email: 'lena@example.invalid',
      phones: ['+49 000 000001'],
      role: 'Cloud Operations',
    },
    {
      id: 'demo-noah',
      name: 'Noah Muster',
      email: 'noah@example.invalid',
      phones: ['+49 000 000002'],
      role: 'Platform Engineering',
    },
    {
      id: 'demo-mila',
      name: 'Mila Demo',
      email: 'mila@example.invalid',
      phones: ['+49 000 000003'],
      role: 'Service Management',
    },
  ];
}
export default {
  id: 'signl4',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema,
  setup(ctx: ServerContext) {
    const c = configSchema.parse(ctx.env);
    const base = (
      c.CSP_SIGNL4_BASE_URL ?? 'https://connect.signl4.com/api/v3'
    ).replace(/\/$/, '');
    const request = (route: string, body?: unknown) =>
      jsonRequest<unknown>(ctx.fetch, base + route, {
        method: body ? 'POST' : 'GET',
        headers: {
          'X-S4-Api-Key': c.CSP_SIGNL4_API_KEY ?? '',
          ...(body ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
    const team = () =>
      ctx.cache.get<Person[]>('signl4-team', async () =>
        ctx.demo
          ? demoTeam()
          : normalizeTeam(
              await request(
                '/teams/users?teamId=' +
                  encodeURIComponent(c.CSP_SIGNL4_TEAM_ID!),
              ),
            ),
      );
    const schedule = () =>
      ctx.cache.get('signl4-schedule', async () => {
        const members = await team();
        if (!members.data || members.stale)
          throw new Error('No current team available');
        const now = Date.now();
        const shifts = ctx.demo
          ? [
              {
                userId: members.data[0].id,
                name: members.data[0].name,
                start: new Date(now - 3600000).toISOString(),
                end: new Date(now + 7200000).toISOString(),
              },
              ...members.data.slice(1).map((p, i) => ({
                userId: p.id,
                name: p.name,
                start: new Date(now + (2 + i * 8) * 3600000).toISOString(),
                end: new Date(now + (10 + i * 8) * 3600000).toISOString(),
              })),
            ]
          : normalizeShifts(
              await request('/schedules', {
                teamIds: [c.CSP_SIGNL4_TEAM_ID],
                minDate: new Date(now - 86400000).toISOString(),
                maxDate: new Date(
                  now + c.CSP_SIGNL4_HORIZON_DAYS * 86400000,
                ).toISOString(),
              }),
              members.data,
              now,
            );
        return { timezone: safeTimezone(c.CSP_SIGNL4_TIMEZONE), shifts };
      });
    const alerts = () =>
      ctx.cache.get<Alert[]>('signl4-alerts', async () => {
        if (ctx.demo)
          return [
            {
              id: 'demo-alert',
              title: 'Erhöhte Antwortzeiten im Kundenportal',
              description:
                'Das Team untersucht eine erhöhte Latenz. Die Kernfunktionen sind verfügbar. Nächstes Update folgt nach der Analyse.',
              status: 'Bestätigt',
              createdAt: new Date(Date.now() - 1200000).toISOString(),
              severity: 2,
            },
          ];
        const items: unknown[] = [];
        let continuationToken: string | undefined;
        for (let page = 0; page < 100; page++) {
          const result = z
            .object({
              results: z.array(z.unknown()),
              continuationToken: z.string().nullable().optional(),
              hasMore: z.boolean().optional(),
            })
            .parse(
              await request('/signls/paged?maxResults=100', {
                teamIds: [c.CSP_SIGNL4_TEAM_ID],
                signlStatusCodes: 3,
                ...(continuationToken ? { continuationToken } : {}),
              }),
            );
          items.push(...result.results);
          if (!result.hasMore && !result.continuationToken)
            return normalizeAlerts(items);
          if (
            !result.continuationToken ||
            result.continuationToken === continuationToken
          )
            throw new Error('Invalid SIGNL4 pagination');
          continuationToken = result.continuationToken;
        }
        throw new Error('SIGNL4 pagination limit exceeded');
      });
    ctx.app.get('/api/v1/team', team);
    ctx.app.get('/api/v1/schedule', schedule);
    ctx.app.get('/api/v1/alerts', alerts);
    ctx.app.get<{ Params: { id: string } }>(
      '/api/v1/team/:id/vcard',
      async (req, reply) => {
        const members = await team();
        const person = members.data?.find((p) => p.id === req.params.id);
        if (!person)
          return reply
            .code(members.stale ? 503 : 404)
            .send({ error: 'Kontakt nicht verfügbar' });
        return reply
          .type('text/vcard; charset=utf-8')
          .header('Content-Disposition', 'attachment; filename="contact.vcf"')
          .send(vCard(person, ctx.config.name));
      },
    );
    ctx.app.get<{ Params: { id: string } }>(
      '/api/v1/team/:id/avatar',
      async (req, reply) => {
        const members = await team();
        if (!members.data?.some((p) => p.id === req.params.id))
          return reply.code(404).send({ error: 'Profil nicht verfügbar' });
        if (ctx.demo)
          return reply.code(404).send({ error: 'Demo verwendet Initialen' });
        const image = await ctx.cache.get<{ type: string; bytes: Buffer }>(
          'avatar:' + req.params.id,
          async () => {
            const r = await ctx.fetch(
              base +
                '/users/' +
                encodeURIComponent(req.params.id) +
                '/image?width=160&height=160',
              {
                headers: { 'X-S4-Api-Key': c.CSP_SIGNL4_API_KEY! },
                signal: AbortSignal.timeout(15000),
              },
            );
            const type = r.headers.get('content-type')?.split(';')[0];
            if (
              !r.ok ||
              !type ||
              !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(
                type,
              )
            )
              throw new Error('Invalid avatar');
            const bytes = Buffer.from(await r.arrayBuffer());
            if (bytes.length > 2 * 1024 * 1024)
              throw new Error('Avatar too large');
            return { type, bytes };
          },
        );
        if (!image.data)
          return reply
            .code(502)
            .send({ error: 'Bild derzeit nicht verfügbar' });
        return reply.type(image.data.type).send(image.data.bytes);
      },
    );
    ctx.knowledge.set('signl4', async () => {
      const [people, plan, list] = await Promise.all([
        team(),
        schedule(),
        alerts(),
      ]);
      return [
        {
          id: 'team',
          title: 'Operations-Team',
          text: JSON.stringify(people.data),
          href: '#team',
          updatedAt: people.updatedAt ?? undefined,
          stale: people.stale,
        },
        {
          id: 'schedule',
          title: 'Schichtplan',
          text: JSON.stringify(plan.data),
          href: '#schedule',
          updatedAt: plan.updatedAt ?? undefined,
          stale: plan.stale,
        },
        ...(list.data ?? []).map((a) => ({
          id: 'alert:' + a.id,
          title: a.title,
          text: a.description + '\nStatus: ' + a.status,
          href: '#alerts',
          updatedAt: list.updatedAt ?? undefined,
          stale: list.stale,
        })),
      ];
    });
  },
} satisfies ServerPlugin;
