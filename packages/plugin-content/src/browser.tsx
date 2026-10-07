import { cspPlugin } from '../package.json';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { BrowserContext, BrowserPlugin } from '@kieksme/csp-sdk';
function Help({ config }: BrowserContext) {
  return (
    <div className="help-grid grid grid-cols-[1fr_1fr] gap-8 compact:grid-cols-[1fr] compact:gap-3.75">
      <div>
        <h3>Der richtige Weg zur Lösung.</h3>
        {config.content.processes.map((p) => (
          <article
            className="process border-b border-line p-[0_0_calc(var(--spacing)_*_4.5)] mb-4.5 [&_h3]:text-[0.9375rem] [&_p]:text-[0.8125rem] [&_p]:leading-[1.8] [&_p]:text-muted [&_a]:text-[0.75rem]"
            key={p.id}
          >
            <h3>{p.title}</h3>
            <div className="markdown text-[0.8125rem] leading-[1.8] text-muted">
              <ReactMarkdown>{p.text}</ReactMarkdown>
            </div>
            {p.href && (
              <a href={p.href} target="_blank" rel="noopener noreferrer">
                Prozess öffnen ↗
              </a>
            )}
          </article>
        ))}
      </div>
      <div>
        <h3>Ein Anliegen? Hier geht’s los.</h3>
        <div className="ticket-grid grid gap-3">
          {config.content.tickets.map((t) => (
            <div key={t.href}>
              <a
                className="ticket block bg-card border border-line p-5.5 no-underline rounded-card [transition:transform_0.15s] [&:hover]:[transform:translateY(-2px)] [&:hover]:[border-color:var(--accent)] [&_strong]:flex [&_strong]:justify-between [&_strong]:text-[0.9375rem] [&_p]:text-[0.8125rem] [&_p]:text-muted [&_p]:leading-[1.7] [&_p]:m-[calc(var(--spacing)_*_2)_0_0]"
                href={t.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                <strong>
                  {t.title}
                  <span aria-hidden="true">↗</span>
                </strong>
                <p>{t.description}</p>
              </a>
              {t.template && (
                <details className="border-t border-line py-5 px-0 [&:last-child]:border-b [&:last-child]:border-line [&[open]_summary::after]:[content:'−'] [&_p]:max-w-[850px] [&_p]:text-[0.875rem] [&_p]:text-muted [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap">
                  <summary className="text-[0.875rem] font-bold cursor-pointer list-none flex justify-between gap-3.75 [&::after]:[content:'+'] [&::after]:text-[1.1875rem] [&::after]:font-normal [&::after]:text-muted">
                    Ticketvorlage anzeigen
                  </summary>
                  <p>{t.template}</p>
                </details>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
function FAQ({ config }: BrowserContext) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('Alle');
  const categories = [
    'Alle',
    ...new Set(config.content.faq.map((f) => f.category)),
  ];
  const results = config.content.faq.filter(
    (f) =>
      (category === 'Alle' || f.category === category) &&
      (f.question + ' ' + f.answer)
        .toLocaleLowerCase('de')
        .includes(query.toLocaleLowerCase('de')),
  );
  return (
    <>
      <label className="sr-only" htmlFor="faq-search">
        FAQ durchsuchen
      </label>
      <input
        className="search bg-card border border-line rounded-card py-3.5 px-4.5 text-ink w-full"
        type="search"
        id="faq-search"
        placeholder="Was möchten Sie wissen?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="faq-controls flex gap-2.25 flex-wrap m-[calc(var(--spacing)_*_3.75)_0_calc(var(--spacing)_*_5.75)] [&_button]:[background:none] [&_button]:border [&_button]:border-line [&_button]:text-muted [&_button]:pt-1.75 [&_button]:pb-1.75 [&_button]:pl-3.25 [&_button]:pr-3.25 [&_button]:[border-radius:20px] [&_button]:text-[0.6875rem] [&_button[aria-pressed='true']]:text-accent-ink [&_button[aria-pressed='true']]:bg-accent [&_button[aria-pressed='true']]:[border-color:var(--accent)]">
        {categories.map((c) => (
          <button
            key={c}
            aria-pressed={category === c}
            onClick={() => setCategory(c)}
          >
            {c}
          </button>
        ))}
      </div>
      {results.map((f) => (
        <details
          className="border-t border-line py-5 px-0 [&:last-child]:border-b [&:last-child]:border-line [&[open]_summary::after]:[content:'−'] [&_p]:max-w-[850px] [&_p]:text-[0.875rem] [&_p]:text-muted [&_p]:leading-[1.8] [&_p]:whitespace-pre-wrap"
          key={f.id}
        >
          <summary className="text-[0.875rem] font-bold cursor-pointer list-none flex justify-between gap-3.75 [&::after]:[content:'+'] [&::after]:text-[1.1875rem] [&::after]:font-normal [&::after]:text-muted">
            {f.question}
          </summary>
          <div className="markdown text-[0.8125rem] leading-[1.8] text-muted">
            <ReactMarkdown>{f.answer}</ReactMarkdown>
          </div>
        </details>
      ))}
      {!results.length && (
        <p
          className="empty-state p-6.5 [border:1px_dashed_var(--line)] text-muted text-[0.875rem]"
          role="status"
        >
          Keine passende Antwort. Unser Team hilft Ihnen weiter.
        </p>
      )}
    </>
  );
}
export default {
  id: 'content',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'help',
      label: 'Hilfe',
      title: 'Ein klarer nächster Schritt.',
      order: 30,
      component: Help,
    },
    {
      id: 'faq',
      label: 'FAQ',
      title: 'Gut zu wissen.',
      order: 40,
      component: FAQ,
    },
  ],
} satisfies BrowserPlugin;
