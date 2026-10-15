import type { Schedule, Shift } from '@kieksme/csp-sdk';
export type CaseStatus = 'OPEN' | 'IN_PROGRESS' | 'CLOSED';
export interface DatadogCase {
  id: string;
  key: string;
  title: string;
  status: string;
  statusGroup: string;
  priority: string;
  assignee?: string;
  href?: string;
}
export interface CasePage {
  items: DatadogCase[];
  page: number;
  hasMore: boolean;
}
export type MonitorState =
  'ok' | 'warning' | 'alert' | 'maintenance' | 'no-data' | 'unknown';
export interface DatadogMonitor {
  id: string;
  name: string;
  status: MonitorState;
  href?: string;
}
export interface DatadogSlo {
  id: string;
  name: string;
  target?: number;
  sli?: number;
  errorBudget?: number;
  href?: string;
  unavailable?: boolean;
}
export interface DatadogShift extends Shift {
  scheduleId: string;
  scheduleName: string;
  timezone: string;
  href?: string;
}
export interface DatadogSchedule extends Schedule {
  shifts: DatadogShift[];
}
export const caseLabels: Record<string, string> = {
  OPEN: 'Offen',
  IN_PROGRESS: 'In Bearbeitung',
  CLOSED: 'Geschlossen',
};
export const monitorLabels: Record<MonitorState, string> = {
  ok: 'OK',
  warning: 'Warnung',
  alert: 'Alarm',
  maintenance: 'Wartung',
  'no-data': 'Keine Daten',
  unknown: 'Unbekannt',
};
