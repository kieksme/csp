# Kundeninstanz

Kopiere `.env.example` nach `.env`, konfiguriere Branding und Provider, dann `pnpm install`, `pnpm build` und `pnpm start:api`. `pnpm dev` startet das Frontend. Die mitgelieferte Entwicklungskonfiguration ist eine synthetische Demo. Für Produktivbetrieb gilt `.env` mit `CSP_DEMO=false`. Weitere Plugins: `pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-signl4`.

Die lokale Entwicklungs-API stellt `/mcp` über Streamable HTTP bereit. [Nutzeranleitung](../../docs/mcp-client.md).
