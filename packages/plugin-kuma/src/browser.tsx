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
        <p className="empty-state">{live.data.incident}</p>
      )}
      <div className="monitor-grid">
        {live.data?.monitors.map((m) => (
          <div className="monitor" key={m.id}>
            <span className={'dot ' + (live.stale ? 'unknown' : m.status)} />
            <div className="monitor-name">
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
          className="status-link"
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
  sdkVersion: '^0.1.0',
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
