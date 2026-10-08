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
  const Hero = plugins.find((p) => p.hero)?.hero;
  const heroSections = sections.filter((s) => s.placement === 'hero');
  const bodySections = sections.filter((s) => s.placement !== 'hero');
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
      <a
        className="skip-link absolute top-[-100px] p-3 bg-card z-[10] [&:focus]:top-[10px]"
        href="#main"
      >
        Zum Inhalt springen
      </a>
      <header className="site-header max-w-[calc(var(--hero-width)_+_96px)] m-auto py-6.5 px-12 flex gap-7.5 items-center [&_nav]:ml-auto [&_nav]:flex [&_nav]:gap-5.75 [&_nav]:text-[0.8125rem] [&_nav]:font-bold [&_nav_a]:no-underline [&_nav_a:hover]:text-accent dark:[&_nav_a:hover]:text-ink contained:[&_nav]:gap-3.5 compact:pt-5 compact:pb-5 compact:pl-6 compact:pr-6 compact:flex-wrap compact:gap-3.75 compact:[&_nav]:[order:3] compact:[&_nav]:w-full compact:[&_nav]:overflow-auto compact:[&_nav]:p-[calc(var(--spacing)_*_1)_0_calc(var(--spacing)_*_2)] compact:[&_nav]:gap-5 narrow:p-5">
        <a
          className="brand flex items-center gap-3 text-[1.25rem] font-extrabold tracking-[-0.8px] no-underline whitespace-nowrap [&_img]:max-w-[220px] [&_img]:h-[40px] [&_img]:object-contain"
          href={config.basePath}
        >
          {config.logo ? (
            <img src={config.logo} alt={config.name} />
          ) : (
            <>
              <span
                className="brand-symbol grid place-items-center bg-accent text-accent-ink w-[36px] h-[36px] [border-radius:9px] text-[1.75rem]"
                aria-hidden="true"
              >
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
          className="theme-button [background:none] border border-line rounded-full w-[36px] h-[36px] text-ink text-[1.25rem] compact:ml-auto"
          onClick={() => setDark(!dark)}
          aria-label={
            dark ? 'Helles Design aktivieren' : 'Dunkles Design aktivieren'
          }
        >
          {dark ? '☀' : '◐'}
        </button>
      </header>
      {config.demo && (
        <div className="demo-bar py-2.25 px-6 text-center bg-soft text-[0.6875rem] tracking-[0.4px]">
          DEMO · Alle Personen, Kontakte und Meldungen sind synthetisch.
        </div>
      )}
      {offline && (
        <div
          className="offline-bar py-2.25 px-6 text-center text-[0.6875rem] tracking-[0.4px] bg-warning-surface text-warning-ink"
          role="status"
        >
          Offline · Hilfe und Kontakt sind verfügbar. Live-Daten können nicht
          aktualisiert werden.
        </div>
      )}
      <main id="main">
        <div className="hero max-w-hero m-[calc(var(--spacing)_*_5)_auto_0] bg-hero text-hero-ink min-h-[415px] block relative overflow-hidden rounded-card [&_.eyebrow]:[color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] [&_.eyebrow]:flex [&_.eyebrow]:items-center [&_.eyebrow]:gap-2.25 contained:ml-6 contained:mr-6 compact:min-h-[0] narrow:m-[calc(var(--spacing)_*_4)_calc(var(--spacing)_*_4)_0]">
          <div className="hero-main grid grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] items-stretch compact:grid-cols-[1fr]">
            {Hero ? (
              <Hero {...ctx} />
            ) : (
              <>
                <div className="hero-copy py-13 px-15 z-[1] wide:[animation:arrive_0.6s_ease_both] contained:p-11.25 compact:pt-9 compact:pb-9 compact:pl-7.5 compact:pr-7.5 narrow:pt-7.5 narrow:pb-7.5 narrow:pl-6.25 narrow:pr-6.25">
                  <p className="eyebrow font-mono text-[0.6875rem] uppercase tracking-[2px] m-[0_0_calc(var(--spacing)_*_4.25)]">
                    <span className="signal-mark w-[6px] h-[6px] [background:var(--accent-secondary,_#c4e98f)] rounded-full" />{' '}
                    CUSTOMER SERVICE PORTAL
                  </p>
                  <h1 className="text-[clamp(40px,5vw,70px)] leading-[1.08] tracking-[-3px] max-w-[680px] font-semibold my-5.5 compact:tracking-[-2px] compact:text-[2.875rem] narrow:text-[2.5rem]">
                    {config.tagline}
                  </h1>
                  <p className="hero-description text-[1rem] leading-[1.8] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] max-w-[475px] narrow:text-[0.875rem]">
                    {config.description}
                  </p>
                  <div className="hero-note mt-10 font-mono text-[0.75rem] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] [&_span]:mr-2.5 [&_span]:[color:var(--accent-secondary,_#c4e98f)] compact:mt-7.5 compact:text-[0.625rem] narrow:max-w-[230px] narrow:leading-[1.8]">
                    <span aria-hidden="true">↳</span> Ein Kontakt. Klare
                    Antworten. Kurze Wege.
                  </div>
                </div>
                <div
                  className="hero-lines relative overflow-hidden opacity-[0.7] [&_>_span]:absolute [&_>_span]:w-[370px] [&_>_span]:h-[370px] [&_>_span]:[border:1px_solid_var(--hero-line)] [&_>_span]:rounded-full [&_>_span]:top-[25px] [&_>_span]:left-[30px] [&_>_span:nth-child(2)]:w-[290px] [&_>_span:nth-child(2)]:h-[290px] [&_>_span:nth-child(2)]:top-[65px] [&_>_span:nth-child(2)]:left-[70px] [&_>_span:nth-child(3)]:w-[210px] [&_>_span:nth-child(3)]:h-[210px] [&_>_span:nth-child(3)]:top-[105px] [&_>_span:nth-child(3)]:left-[110px] [&_>_span:nth-child(4)]:w-[130px] [&_>_span:nth-child(4)]:h-[130px] [&_>_span:nth-child(4)]:top-[145px] [&_>_span:nth-child(4)]:left-[150px] [&_>_span:nth-child(5)]:w-[50px] [&_>_span:nth-child(5)]:h-[50px] [&_>_span:nth-child(5)]:top-[185px] [&_>_span:nth-child(5)]:left-[190px] [&_>_span:nth-child(5)]:[background:var(--accent-secondary,_#c4e98f)] [&_>_span:nth-child(5)]:[border:0] [&_>_div]:absolute [&_>_div]:bottom-[27px] [&_>_div]:right-[35px] [&_>_div]:font-mono [&_>_div]:text-[0.625rem] [&_>_div]:tracking-[2px] [&_>_div]:leading-[1.6] [&_>_div]:[color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] compact:hidden"
                  aria-hidden="true"
                >
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
              </>
            )}
          </div>
          {heroSections.map((section) => (
            <div
              id={section.id}
              key={section.id}
              className="hero-chat px-15 pb-9 compact:pt-5 compact:px-6.25 compact:pb-7.5"
              aria-label={section.label}
            >
              <section.component {...ctx} surface="hero" />
            </div>
          ))}
        </div>
        {bodySections.map((section, i) => (
          <section
            key={section.id}
            id={section.id}
            className={
              'section max-w-content m-auto px-0 [scroll-margin-top:calc(var(--spacing)_*_5)] wide:[animation:arrive_0.6s_ease_both] contained:ml-12 contained:mr-12 compact:mt-[0] compact:mb-[0] compact:ml-6 compact:mr-6 compact:pt-8 compact:pb-8 compact:pl-[0] compact:pr-[0] narrow:mt-[0] narrow:mb-[0] narrow:ml-5 narrow:mr-5  section-' +
              section.id +
              (section.id === 'contact' ? ' pt-9' : ' pt-12') +
              (section.id === 'chat'
                ? ' [border:0] pb-17.5'
                : ' border-b border-line pb-12')
            }
            aria-labelledby={section.id + '-title'}
          >
            <div className="section-heading mb-6.25 flex justify-between items-baseline gap-5 [&_.eyebrow]:text-muted [&_.eyebrow]:m-0 [&_h2]:text-right compact:block compact:[&_.eyebrow]:mb-3 compact:[&_h2]:text-left compact:[&_h2]:text-[1.6875rem]">
              <p className="eyebrow font-mono text-[0.6875rem] uppercase tracking-[2px] m-[0_0_calc(var(--spacing)_*_4.25)]">
                {String(i + 1).padStart(2, '0')} / {section.label}
              </p>
              <h2
                className="text-[1.875rem] tracking-[-1.1px] leading-[1.2] m-0 font-bold"
                id={section.id + '-title'}
              >
                {section.title}
              </h2>
            </div>
            <section.component {...ctx} />
          </section>
        ))}
      </main>
      <footer className="border-t border-line max-w-hero m-auto py-6.5 px-0 flex gap-7.5 justify-between text-[0.6875rem] text-muted [&_span:first-child]:font-extrabold [&_span:first-child]:text-ink [&_a]:no-underline contained:mt-[0] contained:mb-[0] contained:ml-12 contained:mr-12 compact:mt-[0] compact:mb-[0] compact:ml-6 compact:mr-6 compact:flex-wrap compact:gap-3 compact:pt-6 compact:pb-6 compact:pl-[0] compact:pr-[0] compact:[&_span:nth-child(2)]:hidden">
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
