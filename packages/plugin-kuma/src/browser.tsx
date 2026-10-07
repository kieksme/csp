import { cspPlugin } from '../package.json';
import { useLive, DataState } from '@kieksme/csp-sdk/browser';
import type { BrowserContext, BrowserPlugin, Status } from '@kieksme/csp-sdk';
function StatusView(ctx: BrowserContext) {
  const live = useLive<Status>(ctx, '/status');
  const labels = {
    up: 'Verfügbar',
    down: 'Störung',
    maintenance: 'Wartung',
    unknown: 'Unbekannt',
  };
  return (
    <>
      {live.data?.incident && (
        <p className="empty-state p-6.5 [border:1px_dashed_var(--line)] text-muted text-[0.875rem]">
          {live.data.incident}
        </p>
      )}
      <div className="monitor-grid grid grid-cols-[repeat(3,_1fr)] gap-3 compact:grid-cols-[1fr]">
        {live.data?.monitors.map((m) => (
          <div
            className="monitor bg-card border border-line py-5.5 px-6 rounded-card flex items-center gap-3 [&_small]:block [&_small]:text-muted [&_small]:text-[0.6875rem] [&_small]:mt-1.25"
            key={m.id}
          >
            <span
              className={
                'dot inline-block w-[8px] h-[8px] rounded-full bg-neutral shrink-0 [&.up]:[background:var(--success,_#388264)] [&.down]:[background:var(--danger,_#da642b)] [&.maintenance]:bg-warning ' +
                (live.stale ? 'unknown' : m.status)
              }
            />
            <div className="monitor-name text-[0.875rem] font-bold">
              {m.name}
              <small>
                {live.stale ? 'Letzter bekannter Zustand: ' : ''}
                {labels[m.status]}
                {m.uptime !== undefined
                  ? ' · ' + (m.uptime * 100).toFixed(2) + ' % / 24 h'
                  : ''}
              </small>
            </div>
          </div>
        ))}
      </div>
      <DataState {...live} />
      {live.data?.url && (
        <a
          className="status-link text-[0.75rem] inline-block mt-4"
          href={live.data.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          Statusseite öffnen ↗
        </a>
      )}
    </>
  );
}
export default {
  id: 'kuma',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'status',
      label: 'Status',
      title: 'Alles im Blick.',
      order: 10,
      component: StatusView,
    },
  ],
} satisfies BrowserPlugin;
