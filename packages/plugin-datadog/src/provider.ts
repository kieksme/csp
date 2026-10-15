import { z } from 'zod';
import { safeTimezone } from '@kieksme/csp-sdk';
import type {
  CasePage,
  DatadogCase,
  DatadogMonitor,
  DatadogShift,
  DatadogSlo,
  DatadogSchedule,
} from './model.js';
const id = z.union([z.string(), z.number()]).transform(String);
const ref = z.object({
  data: z.object({ id: z.string() }).nullable().optional(),
});
export function normalizeCases(
  raw: unknown,
  projectId: string,
  app: string,
  page: number,
): CasePage {
  const parsed = z
    .object({
      data: z.array(
        z.object({
          id: z.string(),
          attributes: z.object({
            key: z.string(),
            title: z.string(),
            status: z.string().optional(),
            status_name: z.string().optional(),
            status_group: z.string().optional(),
            priority: z.string(),
          }),
          relationships: z.object({ project: ref, assignee: ref.optional() }),
        }),
      ),
      meta: z.object({
        page: z.object({ total: z.number().int().nonnegative() }),
      }),
    })
    .parse(raw);
  // Fail closed even if a provider ignores the search filter.
  const items: DatadogCase[] = parsed.data
    .filter((c) => c.relationships.project.data?.id === projectId)
    .map((c) => ({
      id: c.id,
      key: c.attributes.key,
      title: c.attributes.title,
      status: c.attributes.status_name ?? c.attributes.status ?? 'Unbekannt',
      statusGroup:
        c.attributes.status_group ?? 'SG_' + (c.attributes.status ?? 'UNKNOWN'),
      priority: c.attributes.priority,
      assignee: c.relationships.assignee?.data?.id
        ? 'ID: ' + c.relationships.assignee.data.id
        : undefined,
      href: app + '/cases/' + encodeURIComponent(c.id),
    }));
  return { items, page, hasMore: page + 1 < parsed.meta.page.total };
}
export function normalizeMonitor(raw: unknown, app: string): DatadogMonitor {
  const m = z
    .object({
      id,
      name: z.string(),
      overall_state: z.string().optional(),
      overall_state_modified: z.number().optional(),
      matching_downtimes: z.array(z.unknown()).optional(),
    })
    .parse(raw);
  const states: Record<string, DatadogMonitor['status']> = {
    OK: 'ok',
    Warn: 'warning',
    Alert: 'alert',
    'No Data': 'no-data',
    Unknown: 'unknown',
    Ignored: 'unknown',
    Skipped: 'unknown',
  };
  return {
    id: m.id,
    name: m.name,
    status: m.matching_downtimes?.length
      ? 'maintenance'
      : (states[m.overall_state ?? ''] ?? 'unknown'),
    href: app + '/monitors/' + encodeURIComponent(m.id),
  };
}
export function normalizeSlo(
  details: unknown,
  history: unknown,
  app: string,
): DatadogSlo {
  const d = z
    .object({
      data: z.object({
        id: z.string(),
        name: z.string(),
        thresholds: z.array(
          z.object({
            timeframe: z.string(),
            target: z.number().min(0).max(100),
          }),
        ),
      }),
    })
    .parse(details).data;
  const h = z
    .object({
      data: z.object({
        overall: z
          .object({
            sli_value: z.number().finite().optional(),
            error_budget_remaining: z.record(z.number().finite()).optional(),
            errors: z.array(z.unknown()).optional(),
          })
          .optional(),
        errors: z.array(z.unknown()).optional(),
      }),
    })
    .parse(history).data;
  const target = d.thresholds.find((t) => t.timeframe === '30d')?.target;
  const unavailable = !!(
    h.errors?.length ||
    h.overall?.errors?.length ||
    h.overall?.sli_value === undefined ||
    target === undefined
  );
  const sli = unavailable ? undefined : h.overall?.sli_value;
  return {
    id: d.id,
    name: d.name,
    target,
    sli,
    errorBudget: unavailable
      ? undefined
      : h.overall?.error_budget_remaining?.['30d'],
    unavailable,
    href: app + '/slo/manage?slo_id=' + encodeURIComponent(d.id),
  };
}
const resource = z.object({
  id: z.string(),
  type: z.string(),
  attributes: z.record(z.unknown()).optional(),
  relationships: z.record(z.unknown()).optional(),
});
export function normalizeResponders(
  raw: unknown,
  scheduleId: string,
  app: string,
): DatadogSchedule {
  const r = z
    .object({
      data: z.object({
        relationships: z.object({
          responders: z.object({ data: z.array(z.object({ id: z.string() })) }),
        }),
      }),
      included: z.array(resource).default([]),
    })
    .parse(raw);
  const included = r.included;
  const schedule = included.find(
    (v) => v.type === 'schedules' && v.id === scheduleId,
  );
  if (!schedule || typeof schedule.attributes?.time_zone !== 'string')
    throw new Error('Missing schedule');
  const timezone = safeTimezone(schedule.attributes.time_zone);
  const groups = r.data.relationships.responders.data.map((v) =>
    included.find(
      (x) => x.type === 'schedule_oncall_responder' && x.id === v.id,
    ),
  );
  const shifts: DatadogShift[] = [];
  for (const group of groups) {
    if (!group) throw new Error('Missing responder group');
    if (!['current', 'next'].includes(String(group.attributes?.position)))
      continue;
    const refs = z
      .object({ data: z.array(z.object({ id: z.string() })) })
      .parse(group.relationships?.shifts).data;
    for (const ref of refs) {
      const shift = included.find(
        (v) => v.type === 'shifts' && v.id === ref.id,
      );
      if (!shift) throw new Error('Missing shift');
      const dates = z
        .object({
          start: z.string().datetime({ offset: true }),
          end: z.string().datetime({ offset: true }),
        })
        .parse(shift.attributes);
      if (Date.parse(dates.end) <= Date.parse(dates.start))
        throw new Error('Invalid shift interval');
      const userId = z
        .object({ data: z.object({ id: z.string() }) })
        .parse(shift.relationships?.user).data.id;
      const user = included.find((v) => v.type === 'users' && v.id === userId);
      const name = z.string().min(1).parse(user?.attributes?.name);
      shifts.push({
        ...dates,
        userId,
        name,
        scheduleId,
        scheduleName: String(schedule.attributes?.name ?? scheduleId),
        timezone,
        href: app + '/on-call/schedules/' + encodeURIComponent(scheduleId),
      });
    }
  }
  return { timezone, shifts };
}
export type Get = (path: string, signal?: AbortSignal) => Promise<unknown>;
export async function loadSchedule(
  get: Get,
  scheduleId: string,
  app: string,
  now = Date.now(),
): Promise<DatadogSchedule> {
  const end = now + 7 * 86400000;
  const collected = new Map<string, DatadogShift>();
  const signal = AbortSignal.timeout(15000);
  let cursor = now;
  let timezone = 'Europe/Berlin';
  for (let step = 0; step < 128; step++) {
    const params = new URLSearchParams({
      include: 'schedule,responders,responders.shifts,responders.shifts.user',
      'filter[position]': 'current,next',
      'filter[at_ts]': new Date(cursor).toISOString(),
    });
    const result = normalizeResponders(
      await get(
        '/api/v2/on-call/schedules/' +
          encodeURIComponent(scheduleId) +
          '/responders?' +
          params,
        signal,
      ),
      scheduleId,
      app,
    );
    timezone = result.timezone;
    for (const s of result.shifts)
      if (Date.parse(s.end) > now && Date.parse(s.start) < end)
        collected.set(s.userId + s.start + s.end, s);
    const boundaries = result.shifts
      .flatMap((s) => [Date.parse(s.start), Date.parse(s.end)])
      .filter((t) => t > cursor);
    const next = Math.min(...boundaries);
    if (next >= end)
      return {
        timezone,
        shifts: [...collected.values()].sort((a, b) =>
          a.start.localeCompare(b.start),
        ),
      };
    cursor = next;
  }
  throw new Error('Schedule exceeds bounded lookup window');
}
