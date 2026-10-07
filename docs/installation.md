# Installation

## Produktrepo lokal starten

Voraussetzungen: Node.js **22.12 oder neuer** und **pnpm 12.8.1**. Das Produktrepo ist ein pnpm-Workspace.

```sh
git clone https://github.com/kieksme/csp.git
cd csp
pnpm install --frozen-lockfile
pnpm build
```

Anschließend in zwei Terminals:

```sh
pnpm dev:api # Demo-API auf http://localhost:3001
pnpm dev     # Demo-Frontend auf http://localhost:5173
```

Die Demo verwendet synthetische Personen, Kontakte und Meldungen. Für die zweite Marke `pnpm --filter csp-northstar dev:api` und `pnpm --filter csp-northstar dev` verwenden. Beide Apps verwenden dieselben Ports; parallel müssen Ports beziehungsweise Konfigurationen angepasst werden.

## Eigenständige Kundeninstanz erstellen

Nach Veröffentlichung der npm-Pakete:

```sh
pnpm dlx @kieksme/csp-cli init mein-kundenportal
cd mein-kundenportal
cp .env.example .env
```

Branding, API-URL, Kontakt und Plugin-Auswahl in `portal.config.json` konfigurieren; erlaubte Frontend-Origin und Chat-Provider in `.env`, dann:

```sh
pnpm install
pnpm build
pnpm start:api
```

`pnpm dev` startet Frontend und API gemeinsam. Die Vorlage aktiviert `contact`, `content` und `chat`; SIGNL4 und Kuma werden bei Bedarf hinzugefügt. Außerhalb der Demo benötigt Chat ein erreichbares Modell. Ollama ist voreingestellt; Modell installieren und Ollama starten oder einen anderen Provider konfigurieren. Für eine ausschließlich synthetische Vorschau ausdrücklich `CSP_DEMO=true` setzen und neu bauen/starten.

Die CLI erwartet ein noch nicht vorhandenes Zielverzeichnis. Initialisierung installiert keine Abhängigkeiten. Das erzeugte Kundenrepo sollte außerhalb des Produkt-Workspaces liegen, damit Plugin-Mutationen dessen Lockfile nicht verändern. Nach der Installation das Kunden-Lockfile committen.

## Installation aus GitHub Packages

Die Produktpakete werden auch bei GitHub Packages veröffentlicht. Standardmäßig verwendet die Kundeninstanz npmjs. Für GitHub Packages im Kundenrepo eine `.npmrc` anlegen:

```ini
@kieksme:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Den lesenden Token als Umgebungsvariable übergeben und nicht in die Datei schreiben. GitHub Packages benötigt auch für öffentliche npm-Pakete Authentifizierung. Lokal einen klassischen PAT mit `read:packages` und den nötigen Paketrechten verwenden. In GitHub Actions ist `GITHUB_TOKEN` mit `packages: read` möglich, wenn die Pakete dem Kundenrepo Leserechte gewähren. Details zu Sichtbarkeit und Berechtigungen stehen in [Contribute.md](https://github.com/kieksme/csp/blob/main/Contribute.md).

## Entwicklung vor einer npm-Veröffentlichung

Im Produktrepo zuerst `pnpm build`, dann `node packages/cli/dist/index.js init /absoluter/neuer/pfad`. Solange die Paketversionen nicht auf npm verfügbar sind, benötigt die Instanz lokale Tarballs oder Overrides. `pnpm test:packages` prüft diesen Weg automatisiert einschließlich eines externen Plugins.

## Erste Funktionsprüfung

`GET http://localhost:3001/health` muss die registrierten Plugin-IDs liefern. Frontend öffnen und Kontakt, Hilfetexte und Chat prüfen. SIGNL4/Kuma nach Installation und Konfiguration zusätzlich über ihre API-Routen prüfen. Ein erfolgreicher Healthcheck bestätigt nur den Prozessstart, keine funktionierende Provider-Verbindung.

Weiter: [Konfiguration](configuration.md), [Plugins und CLI](plugins.md), [Deployment](deployment.md).
