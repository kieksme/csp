import { cspPlugin } from '../package.json';
import { z } from 'zod';
import {
  jsonRequest,
  type Monitor,
  type Status,
  type ServerPlugin,
} from '@kieksme/csp-sdk';
export const configSchema = z
  .object({
    CSP_DEMO: z.string().optional(),
    CSP_KUMA_URL: z.string().url().optional(),
    CSP_KUMA_SLUG: z
      .string()
      .regex(/^[\w-]+$/)
      .optional(),
  })
  .superRefine((e, ctx) => {
    if (e.CSP_DEMO !== 'true')
      for (const key of ['CSP_KUMA_URL', 'CSP_KUMA_SLUG'] as const)
        if (!e[key])
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'Required outside demo mode',
          });
  });
export function normalizeStatus(
  page: unknown,
  beats: unknown,
  url: string,
): Status {
  const p = z
    .object({
      publicGroupList: z.array(
        z.object({
          monitorList: z.array(z.object({ id: z.number(), name: z.string() })),
        }),
      ),
      incident: z.object({ title: z.string() }).nullable().optional(),
    })
    .parse(page);
  const b = z
    .object({
      heartbeatList: z.record(
        z.array(z.object({ status: z.number(), time: z.string() })),
      ),
      uptimeList: z.record(z.number()).optional(),
    })
    .parse(beats);
  return {
    url,
    incident: p.incident?.title,
    monitors: p.publicGroupList.flatMap((g) =>
      g.monitorList.map((m) => {
        const latest = [...(b.heartbeatList[m.id] ?? [])]
          .sort((a, b) => a.time.localeCompare(b.time))
          .at(-1);
        return {
          id: String(m.id),
          name: m.name,
          status:
            (
              { 0: 'down', 1: 'up', 3: 'maintenance' } as Record<
                number,
                Monitor['status']
              >
            )[latest?.status ?? 2] ?? 'unknown',
          uptime: b.uptimeList?.[m.id + '_24'],
        };
      }),
    ),
  };
}
export default {
  id: 'kuma',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema,
  setup(ctx) {
    const c = configSchema.parse(ctx.env);
    const base = c.CSP_KUMA_URL?.replace(/\/$/, '');
    const url = ctx.demo
      ? 'https://status.example.invalid'
      : base + '/status/' + c.CSP_KUMA_SLUG;
    const load = () =>
      ctx.cache.get<Status>('kuma', async () => {
        if (ctx.demo)
          return {
            url,
            monitors: [
              { id: '1', name: 'Kundenportal', status: 'up', uptime: 0.9998 },
              { id: '2', name: 'Cloud-Infrastruktur', status: 'up', uptime: 1 },
              { id: '3', name: 'Support & Tickets', status: 'up', uptime: 1 },
            ],
          };
        const [page, beats] = await Promise.all([
          jsonRequest(ctx.fetch, base + '/api/status-page/' + c.CSP_KUMA_SLUG),
          jsonRequest(
            ctx.fetch,
            base + '/api/status-page/heartbeat/' + c.CSP_KUMA_SLUG,
          ),
        ]);
        return normalizeStatus(page, beats, url);
      });
    ctx.app.get('/api/v1/status', load);
    ctx.knowledge.set('kuma', async () => {
      const live = await load();
      return [
        {
          id: 'status',
          title: 'Systemstatus',
          text: JSON.stringify(live.data),
          href: url,
          updatedAt: live.updatedAt ?? undefined,
          stale: live.stale,
        },
      ];
    });
  },
} satisfies ServerPlugin;
