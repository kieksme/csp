import { resolveThemeTokens, themeTokenKeys, tokenVariable } from './theme.js';
import { staticDemoRequest } from './demo.js';
import { useMemo, useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  validatePlugins,
  type BrowserPlugin,
  type PublicConfig,
} from '@kieksme/csp-sdk';
import './style.css';
export function readableForeground(hex: string) {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((value) =>
      value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  const luminance =
    channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
export function Portal({
  config,
  plugins,
}: {
  config: PublicConfig;
  plugins: BrowserPlugin[];
}) {
  validatePlugins(plugins);
  const sections = plugins
    .flatMap((p) => p.sections)
    .sort((a, b) => a.order - b.order);
  const [dark, setDark] = useState(() => {
    try {
      const stored = localStorage.getItem('csp-theme');
      return stored
        ? stored === 'dark'
        : config.theme?.mode === 'dark' ||
            (config.theme?.mode === 'system' &&
              matchMedia('(prefers-color-scheme: dark)').matches);
    } catch {
      return config.theme?.mode === 'dark';
    }
  });
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    for (const key of themeTokenKeys)
      document.documentElement.style.removeProperty('--' + tokenVariable(key));
    const tokens = resolveThemeTokens(config, dark);
    for (const [key, value] of Object.entries(tokens))
      document.documentElement.style.setProperty(
        '--' + tokenVariable(key),
        value,
      );
    document.documentElement.dataset.theme = dark ? 'dark' : 'light';
    try {
      localStorage.setItem('csp-theme', dark ? 'dark' : 'light');
    } catch {
      /* Storage may be disabled. */
    }
  }, [dark, config.theme]);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  const request = useMemo(
    () => (config.staticDemo ? staticDemoRequest(config) : fetch),
    [config],
  );
  const api = useMemo(
    () =>
      async <T,>(path: string, init?: RequestInit): Promise<T> => {
        const response = await request(config.apiUrl + '/api/v1' + path, init);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      },
    [config.apiUrl, request],
  );
  const ctx = { config, api, request };
  return (
    <div
      className="portal"
      style={
        {
          '--accent-ink': readableForeground(
            resolveThemeTokens(config, dark).accent,
          ),
          '--hero-ink': readableForeground(
            resolveThemeTokens(config, dark).hero,
          ),
        } as React.CSSProperties
      }
    >
      <a className="skip-link" href="#main">
        Zum Inhalt springen
      </a>
      <header className="site-header">
        <a className="brand" href={config.basePath}>
          {config.logo ? (
            <img src={config.logo} alt={config.name} />
          ) : (
            <>
              <span className="brand-symbol" aria-hidden="true">
                ↗
              </span>
              <span>{config.name}</span>
            </>
          )}
        </a>
        <nav aria-label="Hauptnavigation">
          {sections
            .filter((s) => s.id !== 'contact')
            .map((s) => (
              <a key={s.id} href={'#' + s.id}>
                {s.label}
              </a>
            ))}
        </nav>
        <button
          className="theme-button"
          onClick={() => setDark(!dark)}
          aria-label={
            dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'
          }
        >
          {dark ? '☀' : '◐'}
        </button>
      </header>
      {config.demo && (
        <div className="demo-bar">
          DEMO · Alle Personen, Kontakte und Meldungen sind synthetisch.
        </div>
      )}
      {offline && (
        <div className="offline-bar" role="status">
          Offline · Hilfe und Kontakt sind verfügbar. Live-Daten können nicht
          aktualisiert werden.
        </div>
      )}
      <main id="main">
        <div className="hero">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="signal-mark" /> CUSTOMER SERVICE PORTAL
            </p>
            <h1>{config.tagline}</h1>
            <p className="hero-description">{config.description}</p>
            <div className="hero-note">
              <span aria-hidden="true">↳</span> Ein Kontakt. Klare Antworten.
              Kurze Wege.
            </div>
          </div>
          <div className="hero-lines" aria-hidden="true">
            <span />
            <span />
            <span />
            <span />
            <span />
            <div>
              OPS
              <br />/ SUPPORT
            </div>
          </div>
        </div>
        {sections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            className={'section section-' + section.id}
            aria-labelledby={section.id + '-title'}
          >
            <div className="section-heading">
              <p className="eyebrow">
                {String(i + 1).padStart(2, '0')} / {section.label}
              </p>
              <h2 id={section.id + '-title'}>{section.title}</h2>
            </div>
            <section.component {...ctx} />
          </section>
        ))}
      </main>
      <footer>
        <span>{config.name}</span>
        <span>Direkt verbunden mit Ihrem Operations-Team.</span>
        <a href="#main">Nach oben ↑</a>
        {config.customerVersion && (
          <small>Version {config.customerVersion}</small>
        )}
      </footer>
    </div>
  );
}
export function mountPortal(config: PublicConfig, plugins: BrowserPlugin[]) {
  const root = document.getElementById('root');
  if (!root) throw new Error('Missing #root element');
  createRoot(root).render(<Portal config={config} plugins={plugins} />);
  if ('serviceWorker' in navigator && import.meta.env?.PROD)
    void navigator.serviceWorker
      .register(config.basePath + 'sw.js', { scope: config.basePath })
      .catch(() => undefined);
}
