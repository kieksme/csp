import { cspPlugin } from '../package.json';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import type { BrowserContext, BrowserPlugin } from '@kieksme/csp-sdk';
function Help({ config }: BrowserContext) {
  return (
    <div className="help-grid">
      <div>
        <h3>Der richtige Weg zur Lösung.</h3>
        {config.content.processes.map((p) => (
          <article className="process" key={p.id}>
            <h3>{p.title}</h3>
            <div className="markdown">
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
        <div className="ticket-grid">
          {config.content.tickets.map((t) => (
            <div key={t.href}>
              <a
                className="ticket"
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
                <details>
                  <summary>Ticketvorlage anzeigen</summary>
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
        className="search"
        type="search"
        id="faq-search"
        placeholder="Was möchten Sie wissen?"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="faq-controls">
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
        <details key={f.id}>
          <summary>{f.question}</summary>
          <div className="markdown">
            <ReactMarkdown>{f.answer}</ReactMarkdown>
          </div>
        </details>
      ))}
      {!results.length && (
        <p className="empty-state" role="status">
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
