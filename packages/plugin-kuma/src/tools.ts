import {
  optString,
  webMcpError,
  webMcpJson,
  type BrowserContext,
  type LiveData,
  type Status,
  type WebMcpTool,
} from '@kieksme/csp-sdk';

export const kumaTools: WebMcpTool[] = [
  {
    name: 'kuma_get_status',
    description:
      'Systemstatus: alle überwachten Dienste mit Zustand (up, down, maintenance, unknown), 24-Stunden-Verfügbarkeit (0 bis 1) und aktueller Störungsmeldung. Optional nach Dienstname filtern. Bei veralteten Daten ist `stale` true und der Zustand nur der letzte bekannte.',
    inputSchema: {
      type: 'object',
      properties: {
        monitor: { type: 'string', description: 'Teil des Dienstnamens' },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: async (args, ctx: BrowserContext) => {
      const status = await ctx.api<LiveData<Status>>('/status');
      if (!status.data) return webMcpError('Status derzeit nicht verfügbar.');
      const filter = optString(args, 'monitor')?.toLocaleLowerCase('de');
      return webMcpJson({
        stale: status.stale,
        updatedAt: status.updatedAt,
        incident: status.data.incident ?? null,
        statusPage: status.data.url,
        monitors: status.data.monitors.filter(
          (m) => !filter || m.name.toLocaleLowerCase('de').includes(filter),
        ),
      });
    },
  },
];
