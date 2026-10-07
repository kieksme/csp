import { useEffect, useState } from 'react';
import type { BrowserContext, LiveData } from './index.js';
export function useLive<T>(ctx: BrowserContext, path: string) {
  const [live, setLive] = useState<LiveData<T>>({
    data: null,
    updatedAt: null,
    stale: false,
  });
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    let pending = false;
    const controller = new AbortController();
    async function load() {
      if (pending) return;
      pending = true;
      try {
        const result = await ctx.api<LiveData<T>>(path, {
          signal: controller.signal,
        });
        if (mounted) setLive(result);
      } catch {
        if (mounted)
          setLive((previous) => ({
            ...previous,
            stale: true,
            error: 'Verbindung unterbrochen',
          }));
      } finally {
        pending = false;
        if (mounted) setLoading(false);
      }
    }
    void load();
    const interval = setInterval(() => void load(), ctx.config.pollMs);
    return () => {
      mounted = false;
      controller.abort();
      clearInterval(interval);
    };
  }, [path, ctx.api, ctx.config.pollMs]);
  return { ...live, loading };
}
export function DataState({
  loading,
  stale,
  updatedAt,
  error,
}: {
  loading?: boolean;
  stale: boolean;
  updatedAt: string | null;
  error?: string;
}) {
  return (
    <p
      className={`data-state font-mono text-[0.625rem] text-muted m-[calc(var(--spacing)_*_3)_0_0] [&.warning]:text-warning ${stale ? 'warning' : ''}`}
      role="status"
    >
      {loading
        ? 'Wird geladen …'
        : stale
          ? `${error ?? 'Veraltete Daten'}${updatedAt ? ' · Letzter Stand: ' + new Date(updatedAt).toLocaleString('de-DE') : ''}`
          : updatedAt
            ? 'Aktualisiert ' +
              new Date(updatedAt).toLocaleTimeString('de-DE', {
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Noch keine Daten verfügbar'}
    </p>
  );
}
