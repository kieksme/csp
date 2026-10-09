# Customer Service Portal

[![Build-Status](https://github.com/kieksme/csp/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/kieksme/csp/actions/workflows/ci.yml?query=branch%3Amain)

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
# Branding/Kontakt in portal.config.json, Provider in .env konfigurieren
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

Nach einer Änderung Frontend und API neu bauen und deployen. Die CLI hält Paketabhängigkeiten, Lockfile und das Profil synchron; getrennte Browser-/Server-Imports entstehen im ignorierten .csp-Verzeichnis. SDK-Inkompatibilitäten, fehlende Plugin-Abhängigkeiten und fehlende Provider-Konfiguration führen zu klaren Fehlern.

## Deklaratives Kundenprofil und Deployment

Das Template enthält acht Basisdateien plus das nach der Installation erzeugte Lockfile. Name, Theme, Hotline, Plugin-Auswahl sowie Logo-, Icon- und Avatar-Verweise liegen in `portal.config.json`; Prozesse, Tickets und FAQ liegen in `content.json`. Die Anwendungseinstiege und Build-Konfiguration werden von Core/CLI bereitgestellt.

```sh
pnpm exec csp validate --config portal.config.json
pnpm exec csp inspect --config portal.config.json
pnpm exec csp dev --config portal.config.json
pnpm exec csp build --config portal.config.json
pnpm exec csp start --config portal.config.json
```

`--production` prüft produktive Beispielwerte. `csp migrate` ergänzt bestehende Kundenrepos ohne Überschreiben; kundenspezifische Codeanpassungen benötigen einen expliziten Verhaltensvergleich. Ein API-Neustart verändert kein gebautes Frontend.

Der kurze Kundenworkflow ruft den gemeinsamen [Build-Workflow](.github/workflows/customer-build.yml) auf. Der Workflow ist auf eine konkrete CSP-Commit-SHA fixiert. Er baut Frontend und API-Image als Artefakte; Pages ist ausdrücklich optional. Öffentliche Overrides werden als JSON übergeben; fehlende GitHub-Variablen werden nicht als leere Overrides eingetragen. Provider-Secrets bleiben ausschließlich im API-Hosting. Das API-Deployment ist separat einzurichten.

Details: [Template](templates/customer/README.md), [Konfiguration](docs/configuration.md), [Deployment](docs/deployment.md).

## Pakete

Alle acht Pakete verwenden das Präfix `@kieksme/csp-` und werden mit identischen Versionen bei npmjs und GitHub Packages veröffentlicht. Standardmäßig installieren die gezeigten Befehle von npmjs. Für GitHub Packages sind eine Scope-Zuordnung und Authentifizierung nötig; siehe [Contribute.md](Contribute.md#github-packages-zugriff-und-installation).

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

Vollständige Kontaktinformationen und Alert-Beschreibungen sind öffentlich. Provider-Schlüssel bleiben im API-Service. Der Chat liest statische Inhalte und die Live-Daten **seiner eigenen Instanz**, führt aber keine Aktionen aus. Jedes Plugin stellt zusätzlich lesende [WebMCP](docs/webmcp.md)-Tools für Browser-Agenten bereit (Dienst und Schichten, Team, Alerts, Status, Hotline, FAQ, Ticketvorlagen, Chat); standardmäßig an, mit `public.webmcp: false` abschaltbar. Gesprächsverläufe werden weder in einer Datenbank noch im Browser-Storage gespeichert.

Projekt-Dokumentation: [Startseite und Übersicht](docs/Home.md), [Architektur](docs/architecture.md), [Installation](docs/installation.md), [Deployment](docs/deployment.md), [API](docs/api.md), [Dokumentation und Wiki](docs/wiki.md).

Weitere Dokumentation: [Plugin-SDK](docs/plugin-sdk.md), [Konfiguration](docs/configuration.md), [Betrieb und Releases](docs/operations.md). Umsetzung der Anforderungen aus [circle-zero #304](https://github.com/ThinkportRepo/circle-zero/issues/304). Das bestehende PoC bleibt unverändert.

Chat-Antworten verwenden die aktuelle Bereitschaftsperson in Ich-Form, mit Name und Kennzeichnung als digitaler Assistent. Ohne bestätigte Bereitschaft antwortet das Service-Team. Dienststatus wird nur für passende Monitore bestätigt; Ticketquellen werden als direkte Links angezeigt. Details: [Chat-Vertrag](docs/plugin-sdk.md#persönliche-chat-antworten).
