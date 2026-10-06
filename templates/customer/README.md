# Kundeninstanz

Kopiere `.env.example` nach `.env`, konfiguriere Branding und Provider, dann `pnpm install`, `pnpm build` und `pnpm start:api`. `pnpm dev` startet das Frontend. Für eine explizite synthetische Demo setze `CSP_DEMO=true`; produktiv bleibt dieser Wert `false`. Weitere Plugins: `pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-signl4`.
