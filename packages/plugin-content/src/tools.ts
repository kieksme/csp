import {
  optInt,
  optString,
  webMcpJson,
  type WebMcpTool,
} from '@kieksme/csp-sdk';

const readOnly = { readOnlyHint: true };
const noArgs = { type: 'object', properties: {}, additionalProperties: false };

export const contentTools: WebMcpTool[] = [
  {
    name: 'content_search_faq',
    description:
      'Durchsucht die FAQ (Frage und Antwort, Markdown) nach Text und/oder Kategorie. Ohne Parameter werden die ersten Einträge und alle Kategorien geliefert.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Suchtext' },
        category: { type: 'string', description: 'Exakte Kategorie' },
        limit: {
          type: 'integer',
          minimum: 1,
          maximum: 50,
          description: 'Standard 10',
        },
      },
      additionalProperties: false,
    },
    annotations: readOnly,
    execute: (args, { config }) => {
      const query = optString(args, 'query')?.toLocaleLowerCase('de');
      const category = optString(args, 'category');
      const matches = config.content.faq.filter(
        (f) =>
          (!category || f.category === category) &&
          (!query ||
            (f.question + ' ' + f.answer)
              .toLocaleLowerCase('de')
              .includes(query)),
      );
      return webMcpJson({
        categories: [...new Set(config.content.faq.map((f) => f.category))],
        total: matches.length,
        results: matches.slice(0, optInt(args, 'limit', 1, 50) ?? 10),
      });
    },
  },
  {
    name: 'content_list_processes',
    description:
      'Support-Prozesse: Titel, Beschreibung (Markdown) und optionaler Link zum Prozess.',
    inputSchema: noArgs,
    annotations: readOnly,
    execute: (_args, { config }) =>
      webMcpJson({ processes: config.content.processes }),
  },
  {
    name: 'content_list_ticket_templates',
    description:
      'Ticketarten mit Link zum Ticketsystem und Textvorlage. Das Portal legt selbst keine Tickets an; die Nutzerin oder der Nutzer öffnet den Link und fügt die Vorlage ein.',
    inputSchema: noArgs,
    annotations: readOnly,
    execute: (_args, { config }) =>
      webMcpJson({ tickets: config.content.tickets }),
  },
];
