import { emitAnalytics } from '@kieksme/csp-sdk/browser';
import { useEffect, useState } from 'react';
import { useLive, DataState, DutyHero, Avatar } from '@kieksme/csp-sdk/browser';
import {
  activeShifts,
  safeTimezone,
  type BrowserContext,
  type BrowserPlugin,
} from '@kieksme/csp-sdk';
import { cspPlugin } from '../package.json';
import {
  caseLabels,
  monitorLabels,
  type CasePage,
  type DatadogMonitor,
  type DatadogSlo,
  type DatadogSchedule,
} from './model.js';
import { demoData, demoSources } from './demo.js';
const card =
  'bg-card border border-line rounded-card p-6 min-w-0 [overflow-wrap:anywhere]';
const grid =
  'grid grid-cols-[repeat(3,minmax(0,1fr))] gap-4 compact:grid-cols-[1fr]';
const button =
  'border border-line rounded-card px-4 py-2 bg-card text-ink text-[0.8125rem] disabled:opacity-50';
function ProviderLink({
  href,
  event,
}: {
  href?: string;
  event?: 'STATUS_CLICK' | 'TICKET_CLICK';
}) {
  return href ? (
    <a
      className="inline-block mt-4 text-[0.75rem]"
      onClick={() => {
        if (event) emitAnalytics(event);
      }}
      href={href}
      target="_blank"
      rel="noopener noreferrer"
    >
      In Datadog öffnen ↗
    </a>
  ) : (
    <p className="text-muted text-[0.75rem] mt-4">Demo · fiktiver Datensatz</p>
  );
}
function Cases(ctx: BrowserContext) {
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(0);
  const live = useLive<CasePage>(
    ctx,
    '/datadog/cases?page=' + page + (status ? '&status=' + status : ''),
  );
  // The hook retains previous values while a new query loads. Never label them as the new page.
  const current = !live.loading && live.data?.page === page;
  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <label htmlFor="datadog-case-status">Ticketstatus</label>
        <select
          id="datadog-case-status"
          className={button}
          value={status}
          onChange={(e) => {
            setStatus(e.target.value);
            setPage(0);
          }}
        >
          <option value="">Alle</option>
          {Object.entries(caseLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <span className="text-muted text-[0.75rem]">Seite {page + 1}</span>
      </div>
      <div className={grid}>
        {current &&
          live.data?.items.map((c) => (
            <article key={c.id} className={card}>
              <p className="font-mono text-muted text-[0.6875rem]">
                {c.key} · {c.priority}
              </p>
              <h3 className="font-bold text-[1rem] mt-3 mb-3">{c.title}</h3>
              <p className="text-[0.8125rem]">
                {caseLabels[c.status] ?? c.status}
              </p>
              <p className="text-muted text-[0.75rem] mt-2">
                Zuständig: {c.assignee ?? 'Nicht zugewiesen'}
              </p>
              <ProviderLink event="TICKET_CLICK" href={c.href} />
            </article>
          ))}
      </div>
      {current && live.data?.items.length === 0 && (
        <p>Keine Tickets für diese Auswahl.</p>
      )}
      <DataState {...live} />
      <div className="flex gap-3 mt-5">
        <button
          className={button}
          disabled={page === 0}
          onClick={() => setPage((p) => p - 1)}
        >
          Vorherige Seite
        </button>
        <button
          className={button}
          disabled={!current || !live.data?.hasMore || live.stale}
          onClick={() => setPage((p) => p + 1)}
        >
          Weitere Tickets
        </button>
      </div>
    </>
  );
}
const percent = (n: number | undefined) =>
  n === undefined
    ? 'Nicht verfügbar'
    : n.toLocaleString('de-DE', { maximumFractionDigits: 3 }) + ' %';
function Health(ctx: BrowserContext) {
  const monitors = useLive<DatadogMonitor[]>(ctx, '/datadog/monitors');
  const slos = useLive<DatadogSlo[]>(ctx, '/datadog/slos');
  return (
    <>
      <h3 className="font-bold text-[1.1875rem] mb-4">Monitorstatus</h3>
      <div className={grid}>
        {monitors.data?.map((m) => (
          <article key={m.id} className={card}>
            <h4 className="font-bold">{m.name}</h4>
            <p className="text-[0.875rem] mt-3">
              {monitors.stale ? 'Letzter bekannter Zustand: ' : ''}
              {monitorLabels[m.status]}
            </p>
            <ProviderLink event="STATUS_CLICK" href={m.href} />
          </article>
        ))}
      </div>
      {monitors.data?.length === 0 && <p>Keine Monitore ausgewählt.</p>}
      <DataState {...monitors} />
      <h3 className="font-bold text-[1.1875rem] mt-8 mb-4">
        SLOs · letzte 30 Tage
      </h3>
      <div className={grid}>
        {slos.data?.map((s) => (
          <article key={s.id} className={card}>
            <h4 className="font-bold">{s.name}</h4>
            <p className="text-[0.875rem] mt-3">
              {slos.stale ? 'Letzter bekannter Stand · ' : ''}
              {s.unavailable
                ? 'Nicht verfügbar'
                : s.sli !== undefined && s.target !== undefined
                  ? s.sli >= s.target
                    ? 'Ziel erfüllt'
                    : 'Ziel verfehlt'
                  : 'Nicht verfügbar'}
            </p>
            <dl className="text-[0.8125rem] grid grid-cols-2 gap-2 mt-4">
              <dt>Ziel</dt>
              <dd>{percent(s.target)}</dd>
              <dt>Gemessen</dt>
              <dd>{percent(s.sli)}</dd>
              <dt>Error Budget</dt>
              <dd>{percent(s.errorBudget)}</dd>
            </dl>
            <ProviderLink event="STATUS_CLICK" href={s.href} />
          </article>
        ))}
      </div>
      {slos.data?.length === 0 && <p>Keine SLOs ausgewählt.</p>}
      <DataState {...slos} />
    </>
  );
}
function Schedule(ctx: BrowserContext) {
  const live = useLive<DatadogSchedule>(ctx, '/datadog/schedule');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const current = activeShifts(live.data?.shifts ?? [], now);
  const time = (value: string, timezone: string) =>
    new Date(value).toLocaleString('de-DE', {
      timeZone: safeTimezone(timezone),
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <>
      <p className="font-bold mb-5">
        {live.stale
          ? 'Erreichbarkeit derzeit nicht bestätigt'
          : live.loading
            ? 'Dienst wird geladen …'
            : !live.data
              ? 'Dienst nicht verfügbar'
              : current.length
                ? [...new Set(current.map((s) => s.name))].join(', ') +
                  ' im Dienst'
                : 'Aktuell keine Schicht aktiv'}
      </p>
      <div className="grid gap-3">
        {live.data?.shifts
          .filter(
            (s) =>
              Date.parse(s.end) > now &&
              Date.parse(s.start) < now + 7 * 86400000,
          )
          .map((s) => (
            <article
              key={s.scheduleId + s.userId + s.start}
              className={card + ' flex flex-wrap items-center gap-4'}
            >
              <Avatar config={ctx.config} id={s.userId} name={s.name} />
              <div className="flex-1 min-w-0">
                <h3 className="font-bold">{s.name}</h3>
                <p className="text-muted text-[0.75rem] mt-2">
                  {s.scheduleName} · {s.timezone}
                </p>
                <p className="text-[0.8125rem] mt-2">
                  {time(s.start, s.timezone)} – {time(s.end, s.timezone)}
                </p>
              </div>
              <span className="text-[0.75rem]">
                {!live.stale && activeShifts([s], now).length
                  ? 'Jetzt im Dienst'
                  : 'Geplante Schicht'}
              </span>
              <ProviderLink href={s.href} />
            </article>
          ))}
      </div>
      {live.data?.shifts.length === 0 && (
        <p>Keine Schichten für die nächsten sieben Tage bekannt.</p>
      )}
      <DataState {...live} />
    </>
  );
}
function DatadogHero(ctx: BrowserContext) {
  return (
    <DutyHero
      {...ctx}
      schedulePath="/datadog/schedule"
      teamPath="/datadog/team"
    />
  );
}
export default {
  id: 'datadog',
  sdkVersion: cspPlugin.sdkVersion,
  hero: DatadogHero,
  demoData,
  demoSources,
  sections: [
    {
      id: 'datadog-schedule',
      label: 'Bereitschaft',
      title: 'Für Sie im Dienst.',
      order: 5,
      component: Schedule,
    },
    {
      id: 'datadog-health',
      label: 'Health',
      title: 'Services und Ziele im Blick.',
      order: 10,
      component: Health,
    },
    {
      id: 'datadog-cases',
      label: 'Tickets',
      title: 'Was gerade ansteht.',
      order: 20,
      component: Cases,
    },
  ],
} satisfies BrowserPlugin;
