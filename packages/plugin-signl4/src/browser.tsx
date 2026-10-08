import { Avatar } from './avatar.js';
import { DutyHero } from './duty-hero.js';
import { cspPlugin } from '../package.json';
import { useEffect, useState } from 'react';
import { useLive, DataState } from '@kieksme/csp-sdk/browser';
import {
  activeShifts,
  safeTimezone,
  type Schedule,
  type Alert,
  type Person,
  type BrowserContext,
  type BrowserPlugin,
} from '@kieksme/csp-sdk';
function ScheduleView(ctx: BrowserContext) {
  const live = useLive<Schedule>(ctx, '/schedule');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 15000);
    return () => clearInterval(timer);
  }, []);
  const current = activeShifts(live.data?.shifts ?? [], now);
  const tz = safeTimezone(live.data?.timezone ?? 'Europe/Berlin');
  const time = (date: string) =>
    new Date(date).toLocaleString('de-DE', {
      timeZone: tz,
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  return (
    <>
      <div className="availability [&_strong]:block [&_strong]:text-[1.1875rem] [&_strong]:mb-2 [&_p]:text-muted [&_p]:m-0 [&_p]:text-[0.8125rem]">
        <strong>
          <span
            className={
              'dot inline-block w-[8px] h-[8px] rounded-full bg-neutral shrink-0 [&.up]:[background:var(--success,_#388264)] [&.down]:[background:var(--danger,_#da642b)] [&.maintenance]:bg-warning ' +
              (current.length && !live.stale ? 'up' : '')
            }
          />{' '}
          {live.stale
            ? 'Erreichbarkeit derzeit nicht bestätigt'
            : live.loading
              ? 'Dienst wird geladen …'
              : !live.data
                ? 'Dienst derzeit nicht verfügbar'
                : current.length
                  ? [...new Set(current.map((s) => s.name))].join(', ') +
                    ' im Dienst'
                  : 'Aktuell keine Schicht aktiv'}
        </strong>
        <p>Zeitzone: {tz}</p>
      </div>
      <DataState {...live} />
      <div className="schedule-list mt-6 grid gap-[0]">
        {live.data?.shifts
          .filter((s) => Date.parse(s.end) > now)
          .map((s, i) => (
            <div
              className={
                'shift grid grid-cols-[1fr_1.5fr_auto] gap-4.5 py-3.25 px-0 border-t border-line text-[0.75rem] [&.active]:text-accent [&.active]:font-bold dark:[&.active]:text-ink [&_time]:font-mono [&_time]:text-[0.6875rem] [&_time]:text-muted compact:grid-cols-[1fr_auto] compact:[&_time]:col-span-full ' +
                (activeShifts([s], now).length ? 'active' : '')
              }
              key={s.userId + s.start + i}
            >
              <span className="shift-person flex items-center gap-3 [&_.avatar]:w-[40px] [&_.avatar]:h-[40px]">
                <Avatar config={ctx.config} id={s.userId} name={s.name} />
                {s.name}
              </span>
              <time>
                {time(s.start)} – {time(s.end)}
              </time>
              <span>
                {activeShifts([s], now).length
                  ? 'Jetzt im Dienst'
                  : 'Nächste Schicht'}
              </span>
            </div>
          ))}
      </div>
    </>
  );
}
function Alerts(ctx: BrowserContext) {
  const live = useLive<Alert[]>(ctx, '/alerts');
  return (
    <>
      <div className="alert-list grid gap-3">
        {live.data?.map((a) => (
          <article
            className="alert grid grid-cols-[110px_1fr_auto] gap-6 p-6 bg-card border border-line [border-left:3px_solid_var(--warning)] rounded-card [&_p]:m-0 [&_p]:text-[0.8125rem] [&_p]:leading-[1.8] [&_p]:text-muted [&_p]:whitespace-pre-wrap [&_p]:[overflow-wrap:anywhere] [&_h3]:text-[0.9375rem] [&_h3]:mb-1.25 [&_time]:font-mono [&_time]:text-[0.625rem] [&_time]:text-muted compact:grid-cols-[1fr] compact:gap-3"
            key={a.id}
          >
            <span className="badge font-mono text-[0.625rem] bg-soft py-1.5 px-2.5 [border-radius:3px] [align-self:start] w-fit">
              {a.status}
            </span>
            <div>
              <h3>{a.title}</h3>
              <p>{a.description}</p>
            </div>
            <time dateTime={a.createdAt}>
              {new Date(a.createdAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })}{' '}
              Uhr
            </time>
          </article>
        ))}
      </div>
      {live.data?.length === 0 && (
        <p className="empty-state p-6.5 [border:1px_dashed_var(--line)] text-muted text-[0.875rem]">
          Keine aktuellen Alerts.
        </p>
      )}
      <DataState {...live} />
    </>
  );
}
function Team(ctx: BrowserContext) {
  const live = useLive<Person[]>(ctx, '/team');
  return (
    <>
      <div className="team-grid grid grid-cols-[repeat(3,_1fr)] gap-4.5 compact:grid-cols-[1fr_1fr] narrow:grid-cols-[1fr]">
        {live.data?.map((p) => (
          <article
            className="person bg-card border border-line rounded-card p-6 [&_h3]:text-[0.9375rem] [&_h3]:m-[0_0_calc(var(--spacing)_*_1)] [&_small]:text-[0.6875rem] [&_small]:text-muted"
            key={p.id}
          >
            <div className="person-top flex gap-3.5 items-center mb-4.5">
              <Avatar
                config={ctx.config}
                id={p.id}
                name={p.name}
                provider={p.avatar}
              />
              <div>
                <h3>{p.name}</h3>
                <small>{p.role ?? 'Operations'}</small>
              </div>
            </div>
            <div className="person-contact grid gap-2 text-[0.75rem] [overflow-wrap:anywhere] [&_a]:no-underline">
              {p.email && <a href={'mailto:' + p.email}>{p.email}</a>}
              {p.phones.map((phone) => (
                <a key={phone} href={'tel:' + phone.replace(/[^+\d]/g, '')}>
                  {phone}
                </a>
              ))}
            </div>
            <a
              className="vcard block mt-5 font-mono text-[0.625rem] no-underline uppercase tracking-[1px]"
              href={
                ctx.config.apiUrl +
                '/api/v1/team/' +
                encodeURIComponent(p.id) +
                '/vcard'
              }
            >
              Kontakt speichern ↓
            </a>
          </article>
        ))}
      </div>
      <DataState {...live} />
    </>
  );
}
export default {
  id: 'signl4',
  hero: DutyHero,
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'schedule',
      label: 'Dienst',
      title: 'Menschen, die erreichbar sind.',
      order: 5,
      component: ScheduleView,
    },
    {
      id: 'alerts',
      label: 'Alerts',
      title: 'Was uns gerade beschäftigt.',
      order: 20,
      component: Alerts,
    },
    {
      id: 'team',
      label: 'Team',
      title: 'Ihre Ansprechpartner.',
      order: 50,
      component: Team,
    },
  ],
} satisfies BrowserPlugin;
