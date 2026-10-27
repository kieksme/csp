import {
  UNTRUSTED_NOTE,
  activeShifts,
  dutyState,
  nextShiftLabel,
  optInt,
  optString,
  safeTimezone,
  webMcpError,
  webMcpJson,
  type BrowserContext,
  type LiveData,
  type WebMcpTool,
} from '@kieksme/csp-sdk';
import type {
  CasePage,
  DatadogMonitor,
  DatadogSchedule,
  DatadogSlo,
} from './model.js';

const readOnly = { readOnlyHint: true };
const noArgs = { type: 'object', properties: {}, additionalProperties: false };
const UNAVAILABLE =
  'Daten derzeit nicht verfügbar. Erreichbarkeit nicht bestätigt; bitte die Hotline nutzen.';
const STATUSES = ['OPEN', 'IN_PROGRESS', 'CLOSED'];

/** Fresh data only: stale schedules must never confirm availability. */
async function fresh<T>(ctx: BrowserContext, path: string) {
  const result = await ctx.api<LiveData<T>>(path);
  return result.data && !result.stale ? result : null;
}

export const datadogTools: WebMcpTool[] = [
  {
    name: 'datadog_get_on_duty',
    description:
      'Wer hat jetzt Bereitschaft (On-Call) und wer ist als Nächstes dran? Bei veralteten Daten wird die Erreichbarkeit ausdrücklich nicht bestätigt.',
    inputSchema: noArgs,
    annotations: readOnly,
    execute: async (_args, ctx) => {
      const schedule = await fresh<DatadogSchedule>(ctx, '/datadog/schedule');
      if (!schedule?.data) return webMcpError(UNAVAILABLE);
      const now = Date.now();
      const { current, next } = dutyState(schedule.data.shifts, now);
      const shifts = schedule.data.shifts;
      const scheduleOf = (id: string, start: string) =>
        shifts.find((s) => s.userId === id && s.start === start)?.scheduleName;
      return webMcpJson({
        confirmed: true,
        updatedAt: schedule.updatedAt,
        timezone: schedule.data.timezone,
        onDuty: current.map((s) => ({
          id: s.userId,
          name: s.name,
          schedule: scheduleOf(s.userId, s.start),
          until: s.end,
        })),
        nextShift: next
          ? {
              id: next.userId,
              name: next.name,
              schedule: scheduleOf(next.userId, next.start),
              start: next.start,
              end: next.end,
              hint: nextShiftLabel(next.start, now, schedule.data.timezone),
            }
          : null,
      });
    },
  },
  {
    name: 'datadog_get_oncall_schedule',
    description:
      'Bereitschaftsplan: laufende und kommende Schichten, optional für eine Person (personId) oder einen Plan (scheduleId) und einen Zeithorizont in Stunden.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'ID der Person' },
        scheduleId: {
          type: 'string',
          description: 'ID des Bereitschaftsplans',
        },
        horizonHours: {
          type: 'integer',
          minimum: 1,
          maximum: 2160,
          description: 'Zeithorizont ab jetzt in Stunden, Standard 168',
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const schedule = await fresh<DatadogSchedule>(ctx, '/datadog/schedule');
      if (!schedule?.data) return webMcpError(UNAVAILABLE);
      const now = Date.now();
      const personId = optString(args, 'personId');
      const scheduleId = optString(args, 'scheduleId');
      const until = now + (optInt(args, 'horizonHours', 1, 2160) ?? 168) * 36e5;
      const shifts = schedule.data.shifts
        .filter(
          (s) =>
            Date.parse(s.end) > now &&
            Date.parse(s.start) < until &&
            (!personId || s.userId === personId) &&
            (!scheduleId || s.scheduleId === scheduleId),
        )
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .map(({ userId, name, start, end, scheduleId, scheduleName }) => ({
          userId,
          name,
          start,
          end,
          scheduleId,
          scheduleName,
          active: activeShifts([{ userId, name, start, end }], now).length > 0,
        }));
      return webMcpJson({
        timezone: safeTimezone(schedule.data.timezone),
        updatedAt: schedule.updatedAt,
        from: new Date(now).toISOString(),
        until: new Date(until).toISOString(),
        shifts,
      });
    },
  },
  {
    name: 'datadog_list_monitors',
    description:
      'Zustand der überwachten Services (ok, warning, alert, maintenance, no-data, unknown). Optional nach Name oder Zustand filtern. Bei veralteten Daten ist `stale` true und der Zustand nur der letzte bekannte.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Teil des Servicenamens' },
        status: {
          type: 'string',
          enum: ['ok', 'warning', 'alert', 'maintenance', 'no-data', 'unknown'],
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const monitors =
        await ctx.api<LiveData<DatadogMonitor[]>>('/datadog/monitors');
      if (!monitors.data) return webMcpError('Status derzeit nicht verfügbar.');
      const query = optString(args, 'query')?.toLocaleLowerCase('de');
      const status = optString(args, 'status');
      return webMcpJson({
        stale: monitors.stale,
        updatedAt: monitors.updatedAt,
        monitors: monitors.data.filter(
          (m) =>
            (!query || m.name.toLocaleLowerCase('de').includes(query)) &&
            (!status || m.status === status),
        ),
      });
    },
  },
  {
    name: 'datadog_list_slos',
    description:
      'Service-Level-Objectives der letzten 30 Tage: Ziel, aktueller SLI und verbleibendes Fehlerbudget in Prozent. `unavailable` markiert SLOs ohne Messwerte.',
    inputSchema: noArgs,
    annotations: readOnly,
    execute: async (_args, ctx) => {
      const slos = await ctx.api<LiveData<DatadogSlo[]>>('/datadog/slos');
      if (!slos.data) return webMcpError('SLOs derzeit nicht verfügbar.');
      return webMcpJson({
        stale: slos.stale,
        updatedAt: slos.updatedAt,
        slos: slos.data,
      });
    },
  },
  {
    name: 'datadog_list_cases',
    description:
      'Datadog-Cases (Tickets), neueste zuerst, seitenweise. Optional nach Status filtern. Nur lesend; es werden keine Cases angelegt oder geändert.',
    inputSchema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: STATUSES },
        page: {
          type: 'integer',
          minimum: 0,
          maximum: 1000,
          description: 'Seite ab 0, Standard 0',
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const status = optString(args, 'status');
      if (status && !STATUSES.includes(status))
        return webMcpError('Ungültiger Status.');
      const page = optInt(args, 'page', 0, 1000) ?? 0;
      const query = new URLSearchParams({ page: String(page) });
      if (status) query.set('status', status);
      const cases = await ctx.api<LiveData<CasePage>>(
        '/datadog/cases?' + query,
      );
      if (!cases.data) return webMcpError('Cases derzeit nicht verfügbar.');
      return webMcpJson({
        stale: cases.stale,
        updatedAt: cases.updatedAt,
        notice: UNTRUSTED_NOTE,
        page: cases.data.page,
        hasMore: cases.data.hasMore,
        cases: cases.data.items,
      });
    },
  },
];
