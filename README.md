# Customer Service Portal

Eine gemeinsame Produktbasis, viele eigenständige Kundeninstanzen. Neutrales React/PWA-Frontend, Fastify-API und versionierte npm-Plugins; TypeScript, pnpm und automatische Tests.

## Lokal starten

Voraussetzungen: Node **22.12+**, pnpm **12.8.1**.

```sh
pnpm install --frozen-lockfile
pnpm build
pnpm dev:api   # Terminal 1: synthetische Service-Desk-API auf :3001
pnpm dev       # Terminal 2: http://localhost:5173
```

Die Demo verwendet ausschließlich erfundene Personen, Kontakte und Alerts. `apps/northstar` zeigt eine zweite Marke mit weniger Plugins. Die Kunden-Vorlage unter `templates/customer` aktiviert Demo-Daten nur, wenn dies ausdrücklich konfiguriert wird.

```sh
pnpm check             # TypeScript, Unit-/Integrationstests, alle Builds
pnpm test:packages     # npm-Tarballs in frischer Instanz, externes Plugin add/remove
pnpm exec playwright install chromium
pnpm test:browser      # Desktop/Mobile, zwei Instanzen, Offline, Fehlerfälle
```

## Kundeninstanz erstellen

Nach der ersten npm-Veröffentlichung:

```sh
pnpm dlx @kieksme/csp-cli init mein-kundenportal
cd mein-kundenportal
cp .env.example .env
# Branding, Kontakt und Provider in .env konfigurieren
pnpm install
pnpm build
pnpm start:api
```

Vor der Veröffentlichung: `pnpm build` und `node packages/cli/dist/index.js init <absoluter-neuer-pfad>`. Die entstandene Instanz benötigt dann lokale Tarballs/Overrides, wie sie `scripts/package-smoke.ts` prüft; die Namen sind noch nicht auf npm veröffentlicht.

Plugins lassen sich pro Kundenrepo installieren und entfernen:

```sh
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-signl4
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-kuma
pnpm dlx @kieksme/csp-cli plugin list
pnpm dlx @kieksme/csp-cli plugin remove @kieksme/csp-plugin-kuma
```

Nach einer Änderung Frontend und API neu bauen und deployen. Die CLI hält Paketabhängigkeiten, Lockfile und beide Registrierungen synchron. SDK-Inkompatibilitäten, fehlende Plugin-Abhängigkeiten und fehlende Provider-Konfiguration führen zu klaren Fehlern.

## Pakete

| Paket                         | Aufgabe                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `@kieksme/csp-sdk`            | Verträge, Schemas, Live-Cache, UI-Hooks, vCard               |
| `@kieksme/csp-core`           | Portal-Shell, öffentliche Konfiguration, PWA-Build, API-Host |
| `@kieksme/csp-cli`            | Kundeninstanz erstellen, Plugins verwalten                   |
| `@kieksme/csp-plugin-contact` | Öffentlicher Notfallkontakt                                  |
| `@kieksme/csp-plugin-signl4`  | Teamprofile, Avatare, Schichten, vCards, aktuelle Alerts     |
| `@kieksme/csp-plugin-kuma`    | Öffentlicher Systemstatus aus Uptime Kuma                    |
| `@kieksme/csp-plugin-content` | Prozesse, Ticketlinks/-vorlagen und FAQ                      |
| `@kieksme/csp-plugin-chat`    | Öffentlicher Chat: OpenAI, Azure OpenAI, Ollama              |

Vollständige Kontaktinformationen und Alert-Beschreibungen sind öffentlich. Provider-Schlüssel bleiben im API-Service. Der Chat liest statische Inhalte und die Live-Daten **seiner eigenen Instanz**, führt aber keine Aktionen aus. Gesprächsverläufe werden weder in einer Datenbank noch im Browser-Storage gespeichert.

Weitere Dokumentation: [Plugin-SDK](docs/plugin-sdk.md), [Konfiguration](docs/configuration.md), [Betrieb und Releases](docs/operations.md). Umsetzung der Anforderungen aus [circle-zero #304](https://github.com/ThinkportRepo/circle-zero/issues/304). Das bestehende PoC bleibt unverändert.
