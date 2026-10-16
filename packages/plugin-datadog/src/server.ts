import { z } from 'zod';
import { cspPlugin } from '../package.json';
import type { ServerPlugin, Source } from '@kieksme/csp-sdk';
import { demoData } from './demo.js';
import {
  loadSchedule,
  normalizeCases,
  normalizeMonitor,
  normalizeSlo,
} from './provider.js';
import type { CaseStatus, DatadogSchedule } from './model.js';
const sites = [
  'datadoghq.eu',
  'datadoghq.com',
  'us3.datadoghq.com',
  'us5.datadoghq.com',
  'ap1.datadoghq.com',
  'ap2.datadoghq.com',
  'uk1.datadoghq.com',
] as const;
const identifiers = (pattern: RegExp, limit: number) =>
  z
    .string()
    .transform((s) =>
      s
        .split(',')
        .map((v) => v.trim())
        .filter(Boolean),
    )
    .pipe(z.array(z.string().regex(pattern)).min(1).max(limit));
const optionalEnv = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess(
    (value) =>
      typeof value === 'string' && value.trim() === '' ? undefined : value,
    schema.optional(),
  );
export const configSchema = z
  .object({
    CSP_DEMO: z.string().optional(),
    CSP_DATADOG_SITE: z.enum(sites).default('datadoghq.eu'),
    CSP_DATADOG_API_KEY: optionalEnv(z.string().min(1)),
    CSP_DATADOG_APP_KEY: optionalEnv(z.string().min(1)),
    CSP_DATADOG_CASE_PROJECT_ID: optionalEnv(z.string().uuid()),
    CSP_DATADOG_MONITOR_IDS: optionalEnv(identifiers(/^\d+$/, 50)),
    CSP_DATADOG_SLO_IDS: optionalEnv(identifiers(/^[a-zA-Z0-9-]+$/, 50)),
    CSP_DATADOG_SCHEDULE_IDS: optionalEnv(identifiers(/^[a-zA-Z0-9-]+$/, 10)),
  })
  .superRefine((c, ctx) => {
    if (c.CSP_DEMO !== 'true')
      for (const key of [
        'CSP_DATADOG_API_KEY',
        'CSP_DATADOG_APP_KEY',
        'CSP_DATADOG_CASE_PROJECT_ID',
        'CSP_DATADOG_MONITOR_IDS',
        'CSP_DATADOG_SLO_IDS',
        'CSP_DATADOG_SCHEDULE_IDS',
      ] as const)
        if (!c[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required outside demo mode',
          });
  });
export function datadogClient(
  c: z.infer<typeof configSchema>,
  fetcher: typeof fetch,
) {
  let retryAt = 0;
  const api = 'https://api.' + c.CSP_DATADOG_SITE;
  return async (
    path: string,
    signal = AbortSignal.timeout(15000),
  ): Promise<unknown> => {
    if (Date.now() < retryAt) throw new Error('Datadog rate limited');
    const response = await fetcher(api + path, {
      signal,
      redirect: 'error',
      headers: {
        'DD-API-KEY': c.CSP_DATADOG_API_KEY!,
        'DD-APPLICATION-KEY': c.CSP_DATADOG_APP_KEY!,
        Accept: 'application/json',
      },
    });
    if (response.status === 429) {
      const header = response.headers.get('retry-after');
      const seconds = Number(header);
      const until =
        header && !Number.isFinite(seconds)
          ? Date.parse(header)
          : Date.now() +
            Math.max(30, Number.isFinite(seconds) ? seconds : 30) * 1000;
      retryAt = Math.min(
        Date.now() + 3600000,
        Math.max(Date.now() + 30000, until || 0),
      );
    }
    if (!response.ok) throw new Error('Datadog HTTP ' + response.status);
    return response.json();
  };
}
export default {
  id: 'datadog',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema,
  setup(ctx) {
    const c = configSchema.parse(ctx.env);
    const app =
      'https://' +
      (['datadoghq.eu', 'datadoghq.com'].includes(c.CSP_DATADOG_SITE)
        ? 'app.'
        : '') +
      c.CSP_DATADOG_SITE;
    const get = datadogClient(c, ctx.fetch);
    const cases = (page = 0, status?: CaseStatus) =>
      ctx.cache.get(
        'datadog:cases:' + page + ':' + (status ?? ''),
        async () => {
          if (ctx.demo)
            return demoData(
              '/datadog/cases?page=' +
                page +
                (status ? '&status=' + status : ''),
            );
          const params = new URLSearchParams({
            'page[size]': '20',
            'page[number]': String(page + 1),
            'sort[field]': 'created_at',
            'sort[asc]': 'false',
            filter:
              'project_id:' +
              c.CSP_DATADOG_CASE_PROJECT_ID +
              (status ? ' status:' + status.toLowerCase() : ''),
          });
          return normalizeCases(
            await get('/api/v2/cases?' + params),
            c.CSP_DATADOG_CASE_PROJECT_ID!,
            app,
            page,
          );
        },
      );
    const monitors = () =>
      ctx.cache.get('datadog:monitors', async () =>
        ctx.demo
          ? demoData('/datadog/monitors')
          : Promise.all(
              c.CSP_DATADOG_MONITOR_IDS!.map(async (id) =>
                normalizeMonitor(
                  await get('/api/v1/monitor/' + id + '?with_downtimes=true'),
                  app,
                ),
              ),
            ),
      );
    const slos = () =>
      ctx.cache.get('datadog:slos', async () => {
        if (ctx.demo) return demoData('/datadog/slos');
        const to = Math.floor(Date.now() / 1000),
          from = to - 30 * 86400;
        return Promise.all(
          c.CSP_DATADOG_SLO_IDS!.map(async (id) => {
            const [details, history] = await Promise.all([
              get('/api/v1/slo/' + encodeURIComponent(id)),
              get(
                '/api/v1/slo/' +
                  encodeURIComponent(id) +
                  '/history?from_ts=' +
                  from +
                  '&to_ts=' +
                  to,
              ),
            ]);
            return normalizeSlo(details, history, app);
          }),
        );
      });
    const schedule = () =>
      ctx.cache.get<DatadogSchedule>('datadog:schedule', async () => {
        if (ctx.demo) return demoData('/datadog/schedule') as DatadogSchedule;
        const schedules = await Promise.all(
          c.CSP_DATADOG_SCHEDULE_IDS!.map((id) => loadSchedule(get, id, app)),
        );
        return {
          timezone: schedules[0].timezone,
          shifts: schedules
            .flatMap((s) => s.shifts)
            .sort((a, b) => a.start.localeCompare(b.start)),
        };
      });
    ctx.app.get('/api/v1/datadog/cases', async (request, reply) => {
      const query = z
        .object({
          page: z.coerce.number().int().min(0).max(1000).default(0),
          status: z.enum(['OPEN', 'IN_PROGRESS', 'CLOSED']).optional(),
        })
        .safeParse(request.query);
      if (!query.success)
        return reply.code(400).send({ error: 'Ungültiger Ticketfilter' });
      return cases(query.data.page, query.data.status);
    });
    ctx.app.get('/api/v1/datadog/monitors', monitors);
    ctx.app.get('/api/v1/datadog/slos', slos);
    ctx.app.get('/api/v1/datadog/schedule', schedule);
    ctx.app.get('/api/v1/datadog/team', async () => {
      const live = await schedule();
      return {
        ...live,
        data: live.data
          ? [
              ...new Map(
                live.data.shifts.map((s) => [
                  s.userId,
                  { id: s.userId, name: s.name, phones: [] },
                ]),
              ).values(),
            ]
          : null,
      };
    });
    for (const [id, title, load, href] of [
      ['datadog-cases', 'Datadog Cases', cases, '#datadog-cases'],
      ['datadog-health', 'Datadog Health', monitors, '#datadog-health'],
      ['datadog-slos', 'Datadog SLOs · 30 Tage', slos, '#datadog-health'],
      [
        'datadog-schedule',
        'Datadog Bereitschaft · 7 Tage',
        schedule,
        '#datadog-schedule',
      ],
    ] as const)
      ctx.knowledge.set(id, async (): Promise<Source[]> => {
        const live = await load();
        const data =
          id === 'datadog-health' ? { monitors: live.data } : live.data;
        const text = JSON.stringify(ctx.demo ? { demo: true, data } : data);
        const contextText =
          ctx.demo && (id === 'datadog-health' || id === 'datadog-schedule')
            ? JSON.stringify({ demo: true, ...(data as object) })
            : text;
        return [
          {
            id,
            title: title + (ctx.demo ? ' · Demo' : ''),
            kind:
              id === 'datadog-schedule'
                ? 'schedule'
                : id === 'datadog-health'
                  ? 'status'
                  : undefined,
            text: contextText,
            href,
            updatedAt: live.updatedAt ?? undefined,
            stale: live.stale,
          },
        ];
      });
  },
} satisfies ServerPlugin;
