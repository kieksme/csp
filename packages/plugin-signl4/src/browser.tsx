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
      <div className="availability">
        <strong>
          <span
            className={'dot ' + (current.length && !live.stale ? 'up' : '')}
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
      <div className="schedule-list">
        {live.data?.shifts
          .filter((s) => Date.parse(s.end) > now)
          .map((s, i) => (
            <div
              className={
                'shift ' + (activeShifts([s], now).length ? 'active' : '')
              }
              key={s.userId + s.start + i}
            >
              <span>{s.name}</span>
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
      <div className="alert-list">
        {live.data?.map((a) => (
          <article className="alert" key={a.id}>
            <span className="badge">{a.status}</span>
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
        <p className="empty-state">Keine aktuellen Alerts.</p>
      )}
      <DataState {...live} />
    </>
  );
}
function Team(ctx: BrowserContext) {
  const live = useLive<Person[]>(ctx, '/team');
  return (
    <>
      <div className="team-grid">
        {live.data?.map((p) => (
          <article className="person" key={p.id}>
            <div className="person-top">
              {ctx.config.avatarOverrides[p.id] || p.avatar ? (
                <img
                  className="avatar"
                  src={
                    ctx.config.avatarOverrides[p.id] ??
                    ctx.config.apiUrl + '/api/v1' + p.avatar
                  }
                  alt={'Profilbild ' + p.name}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <span className="avatar" aria-hidden="true">
                  {p.name
                    .split(' ')
                    .map((s) => s[0])
                    .slice(0, 2)
                    .join('')}
                </span>
              )}
              <div>
                <h3>{p.name}</h3>
                <small>{p.role ?? 'Operations'}</small>
              </div>
            </div>
            <div className="person-contact">
              {p.email && <a href={'mailto:' + p.email}>{p.email}</a>}
              {p.phones.map((phone) => (
                <a key={phone} href={'tel:' + phone.replace(/[^+\d]/g, '')}>
                  {phone}
                </a>
              ))}
            </div>
            <a
              className="vcard"
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
