import type { Source } from '@kieksme/csp-sdk';
import type {
  CasePage,
  DatadogMonitor,
  DatadogSchedule,
  DatadogSlo,
} from './model.js';
export function demoSchedule(now = Date.now()): DatadogSchedule {
  const names = [
    'Lena Demo',
    'Noah Demo',
    'Mila Demo',
    'Sara Demo',
    'Jonas Demo',
  ];
  const ids = ['lena', 'noah', 'mila', 'sara', 'jonas'];
  const hour = 3600000;
  const anchor = Math.floor(now / (8 * hour)) * 8 * hour;
  const offset = Math.floor(now / (8 * hour)) % 5;
  return {
    timezone: 'Europe/Berlin',
    shifts: Array.from({ length: 22 }, (_, i) => ({
      userId: 'demo-' + ids[(i + offset) % 5],
      name: names[(i + offset) % 5],
      start: new Date(anchor + i * 8 * hour).toISOString(),
      end: new Date(anchor + (i + 1) * 8 * hour).toISOString(),
      scheduleId: 'demo-ops',
      scheduleName: 'Operations · Demo',
      timezone: 'Europe/Berlin',
    })),
  };
}
export const demoMonitors: DatadogMonitor[] = [
  { id: 'portal', name: 'Kundenportal', status: 'ok' },
  { id: 'api', name: 'Bestell-API', status: 'warning' },
  { id: 'payments', name: 'Zahlungsdienst', status: 'alert' },
  { id: 'backup', name: 'Backup-Service', status: 'maintenance' },
  { id: 'mail', name: 'E-Mail-Zustellung', status: 'no-data' },
];
export const demoSlos: DatadogSlo[] = [
  {
    id: 'portal',
    name: 'Kundenportal',
    target: 99.9,
    sli: 99.98,
    errorBudget: 80,
  },
  {
    id: 'api',
    name: 'Bestell-API',
    target: 99.9,
    sli: 99.82,
    errorBudget: -80,
  },
  { id: 'mail', name: 'E-Mail-Zustellung', target: 99.9, unavailable: true },
];
export function demoCases(page = 0, status?: string): CasePage {
  const items = Array.from({ length: 24 }, (_, i) => ({
    id: 'demo-case-' + i,
    key: 'DEMO-' + (100 + i),
    title: [
      'API-Antwortzeit untersuchen',
      'Zahlungsdienst wiederherstellen',
      'Backup-Wartung abgeschlossen',
    ][i % 3],
    status: ['OPEN', 'IN_PROGRESS', 'CLOSED'][i % 3],
    statusGroup: ['SG_OPEN', 'SG_IN_PROGRESS', 'SG_CLOSED'][i % 3],
    priority: ['P2', 'P1', 'P3'][i % 3],
    assignee: ['Lena Demo', 'Noah Demo', 'Sara Demo'][i % 3],
  })).filter((item) => !status || item.status === status);
  return {
    items: items.slice(page * 20, (page + 1) * 20),
    page,
    hasMore: (page + 1) * 20 < items.length,
  };
}
export function demoData(path: string): unknown | undefined {
  const url = new URL(path, 'https://demo.invalid');
  switch (url.pathname) {
    case '/datadog/cases':
      return demoCases(
        Number(url.searchParams.get('page') ?? 0),
        url.searchParams.get('status') ?? undefined,
      );
    case '/datadog/monitors':
      return demoMonitors;
    case '/datadog/slos':
      return demoSlos;
    case '/datadog/schedule':
      return demoSchedule();
    case '/datadog/team':
      return demoSchedule().shifts.map((s) => ({
        id: s.userId,
        name: s.name,
        phones: [],
      }));
    default:
      return undefined;
  }
}
export function demoSources(): Source[] {
  const current = demoSchedule().shifts[0];
  return [
    {
      id: 'datadog-cases',
      title: 'Datadog Cases · Demo',
      text: 'Synthetische Demo: DEMO-100 API-Antwortzeit untersuchen ist offen (P2). DEMO-101 Zahlungsdienst wiederherstellen ist in Bearbeitung (P1).',
      href: '#datadog-cases',
    },
    {
      id: 'datadog-health',
      title: 'Datadog Health · Demo',
      text: 'Synthetische Demo: Kundenportal OK, Bestell-API Warnung, Zahlungsdienst Alarm, Backup-Service Wartung, E-Mail-Zustellung ohne Daten.',
      href: '#datadog-health',
    },
    {
      id: 'datadog-slos',
      title: 'Datadog SLOs · Demo',
      text: 'Synthetische Demo: Kundenportal erfüllt 99,98 % bei 99,9 % Ziel über 30 Tage, Error Budget 80 %. Bestell-API verfehlt das Ziel mit 99,82 %, Error Budget -80 %.',
      href: '#datadog-health',
    },
    {
      id: 'datadog-schedule',
      title: 'Datadog Bereitschaft · Demo',
      text:
        'Synthetische Demo: ' +
        current.name +
        ' ist jetzt im Dienst. Schichtende: ' +
        current.end +
        '. Zeitzone Europe/Berlin; kommende Schichten für sieben Tage.',
      href: '#datadog-schedule',
    },
  ];
}
