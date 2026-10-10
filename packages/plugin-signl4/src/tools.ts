import {
  UNTRUSTED_NOTE,
  activeShifts,
  dutyState,
  nextShiftLabel,
  optInt,
  optString,
  safeTimezone,
  vCard,
  webMcpError,
  webMcpJson,
  type Alert,
  type BrowserContext,
  type LiveData,
  type Person,
  type Schedule,
  type WebMcpTool,
} from '@kieksme/csp-sdk';

const readOnly = { readOnlyHint: true };
const noArgs = { type: 'object', properties: {}, additionalProperties: false };
const UNAVAILABLE =
  'Daten derzeit nicht verfügbar. Erreichbarkeit nicht bestätigt; bitte die Hotline nutzen.';

async function live<T>(ctx: BrowserContext, path: string) {
  const result = await ctx.api<LiveData<T>>(path);
  return result.data && !result.stale ? result : null;
}
const iso = (ms: number) => new Date(ms).toISOString();

export const signl4Tools: WebMcpTool[] = [
  {
    name: 'signl4_get_on_duty',
    description:
      'Wer ist jetzt im Bereitschaftsdienst (Schichtbetrieb)? Liefert die aktuell diensthabenden Personen und die nächste Schicht. Bei veralteten Daten wird die Erreichbarkeit ausdrücklich nicht bestätigt.',
    inputSchema: noArgs,
    annotations: readOnly,
    execute: async (_args, ctx) => {
      const schedule = await live<Schedule>(ctx, '/schedule');
      if (!schedule?.data) return webMcpError(UNAVAILABLE);
      const now = Date.now();
      const { current, next } = dutyState(schedule.data.shifts, now);
      return webMcpJson({
        confirmed: true,
        updatedAt: schedule.updatedAt,
        timezone: schedule.data.timezone,
        onDuty: current.map((s) => ({
          id: s.userId,
          name: s.name,
          until: s.end,
        })),
        nextShift: next
          ? {
              id: next.userId,
              name: next.name,
              start: next.start,
              end: next.end,
              hint: nextShiftLabel(next.start, now, schedule.data.timezone),
            }
          : null,
      });
    },
  },
  {
    name: 'signl4_get_shift_schedule',
    description:
      'Schichtplan: kommende und laufende Schichten, optional für eine Person (personId aus signl4_list_team) und einen Zeithorizont in Stunden.',
    inputSchema: {
      type: 'object',
      properties: {
        personId: { type: 'string', description: 'ID der Person' },
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
      const schedule = await live<Schedule>(ctx, '/schedule');
      if (!schedule?.data) return webMcpError(UNAVAILABLE);
      const now = Date.now();
      const personId = optString(args, 'personId');
      const until = now + (optInt(args, 'horizonHours', 1, 2160) ?? 168) * 36e5;
      const shifts = schedule.data.shifts
        .filter(
          (s) =>
            Date.parse(s.end) > now &&
            Date.parse(s.start) < until &&
            (!personId || s.userId === personId),
        )
        .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
        .map((s) => ({
          ...s,
          active: activeShifts([s], now).length > 0,
        }));
      return webMcpJson({
        timezone: safeTimezone(schedule.data.timezone),
        updatedAt: schedule.updatedAt,
        from: iso(now),
        until: iso(until),
        shifts,
      });
    },
  },
  {
    name: 'signl4_list_team',
    description:
      'Teammitglieder mit Rolle, E-Mail und Telefonnummern. Optional nach Name, Rolle oder E-Mail filtern.',
    inputSchema: {
      type: 'object',
      properties: { query: { type: 'string', description: 'Suchtext' } },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const team = await live<Person[]>(ctx, '/team');
      if (!team?.data) return webMcpError(UNAVAILABLE);
      const query = optString(args, 'query')?.toLocaleLowerCase('de');
      const people = team.data
        .filter(
          (p) =>
            !query ||
            [p.name, p.role, p.email].some((value) =>
              value?.toLocaleLowerCase('de').includes(query),
            ),
        )
        .map(({ id, name, role, email, phones }) => ({
          id,
          name,
          role: role ?? 'Operations',
          email,
          phones,
        }));
      return webMcpJson({ updatedAt: team.updatedAt, people });
    },
  },
  {
    name: 'signl4_get_vcard',
    description:
      'vCard (Kontaktkarte, Text im Format vCard 3.0) einer Person. Die ID stammt aus signl4_list_team.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'ID der Person' } },
      required: ['id'],
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const id = optString(args, 'id');
      if (!id) return webMcpError('Parameter "id" fehlt.');
      const team = await live<Person[]>(ctx, '/team');
      if (!team?.data) return webMcpError(UNAVAILABLE);
      const person = team.data.find((p) => p.id === id);
      if (!person) return webMcpError('Person nicht gefunden.');
      return webMcpJson({
        id: person.id,
        name: person.name,
        vcard: vCard(person, ctx.config.name),
      });
    },
  },
  {
    name: 'signl4_list_alerts',
    description:
      'Aktuelle Alerts (offen, bestätigt, geschlossen) mit Schweregrad und Zeitpunkt. Optional ab einem Mindest-Schweregrad.',
    inputSchema: {
      type: 'object',
      properties: {
        minSeverity: {
          type: 'integer',
          minimum: 0,
          description: 'Nur Alerts mit mindestens diesem Schweregrad',
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: async (args, ctx) => {
      const alerts = await ctx.api<LiveData<Alert[]>>('/alerts');
      if (!alerts.data) return webMcpError('Alerts derzeit nicht verfügbar.');
      const min = optInt(args, 'minSeverity', 0, 1000) ?? 0;
      return webMcpJson({
        stale: alerts.stale,
        updatedAt: alerts.updatedAt,
        notice: UNTRUSTED_NOTE,
        alerts: alerts.data.filter((a) => a.severity >= min),
      });
    },
  },
];
