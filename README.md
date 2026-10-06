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

## Kundeninstanz über GitHub personalisieren

Im **Kundenrepo** unter **Settings → Secrets and variables → Actions → Variables → New repository variable** die folgenden Werte anlegen. Der mitgelieferte Workflow [deploy.yml](templates/customer/.github/workflows/deploy.yml) übergibt sie beim Schritt `pnpm build` als Umgebungsvariablen. Repository-Variablen verwenden: Das Environment `github-pages` ist nur dem anschließenden Deployment-Job zugeordnet.

| GitHub-Variable     | Erforderlich / Beispiel                              | Wirkung                                                                                                                                 |
| ------------------- | ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_NAME`          | Ja, z. B. `Musterkunde Service Portal`               | Portalname, Seitentitel und PWA-Name.                                                                                                   |
| `CSP_API_URL`       | Ja, z. B. `https://api.musterkunde.example`          | Öffentlich erreichbare API-Adresse, optional mit Proxy-Präfix, ohne `/api/v1`. Für ein HTTPS-Portal ebenfalls HTTPS verwenden.          |
| `CSP_CONTACT_PHONE` | Ja, z. B. `+49 30 123456`                            | Öffentliche Hotline; erlaubt sind Ziffern, Leerzeichen, Klammern, Bindestriche und ein führendes `+` (3–40 Zeichen).                    |
| `CSP_BASE_PATH`     | Bei Pages im Repo-Unterpfad `/<repo>/`, sonst `/`    | Basispfad für Frontend, Assets und PWA; führender und abschließender Slash sind erforderlich. Ohne Variable verwendet der Workflow `/`. |
| `CSP_DOMAIN`        | Optional, z. B. `https://portal.musterkunde.example` | Öffentliche Origin für den Canonical-Link. Richtet weder DNS noch eine Pages-Domain ein.                                                |

`CSP_NAME`, `CSP_API_URL` und `CSP_CONTACT_PHONE` müssen gesetzt sein: Fehlende GitHub-Variablen werden im Workflow als leere Zeichenfolgen übergeben und überschreiben dadurch die Standardwerte beziehungsweise eine lokale `.env`-Konfiguration.

Für GitHub Pages unter **Settings → Pages → Build and deployment → Source** `GitHub Actions` wählen. Bei einer Custom Domain zusätzlich DNS und die Pages-Domain konfigurieren sowie `public/CNAME` anlegen. Pull Requests bauen das Portal und das API-Image; Pushes auf `main` deployen zusätzlich das Frontend. Der API-Service wird separat beim gewählten API-Host betrieben.

Für weitere Personalisierung unterstützt der Build diese öffentlichen Variablen:

| Variable                      | Zweck / Standard ohne eigene Konfiguration                                                                                                                  |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_TAGLINE`                 | Hauptüberschrift; `Wir sind für Sie da.`                                                                                                                    |
| `CSP_DESCRIPTION`             | Portal- und PWA-Beschreibung; `Ihr direkter Kontakt zum Operations-Team.`                                                                                   |
| `CSP_COLOR`, `CSP_BACKGROUND` | Akzent- und Hintergrundfarbe; `#176b58` und `#102e29`. Sechsstellige Hex-Farben in GitHub ohne Anführungszeichen eingeben; in `.env` mit Anführungszeichen. |
| `CSP_CONTACT_LABEL`           | Hotline-Beschriftung; `Operations-Hotline`.                                                                                                                 |
| `CSP_LOGO_URL`                | Optional: HTTP(S)-URL oder absoluter URL-Pfad, z. B. `/kundenportal/logo.png`.                                                                              |
| `CSP_ICON_PATH`               | Optional: lokale Bilddatei relativ zum Kundenrepo, z. B. `public/icon.png`, für generierte PWA-Icons.                                                       |
| `CSP_AVATARS_PATH`            | Optional: JSON-Datei relativ zum Kundenrepo mit SIGNL4-Benutzer-IDs und Avatar-URLs.                                                                        |
| `CSP_CONTENT_PATH`            | Datei für Prozesse, Ticketvorlagen und FAQ; die Vorlage verwendet `content.json`.                                                                           |
| `CSP_POLL_MS`                 | Browser-Polling in Millisekunden; `60000`, mindestens `1000`.                                                                                               |
| `CSP_DEMO`                    | Nur `true` aktiviert synthetische Daten; produktiv `false` verwenden.                                                                                       |

Diese zusätzlichen GitHub-Variablen werden **noch nicht** vom mitgelieferten Workflow übernommen. Für jeden gewünschten Wert im `env`-Block des Schritts `pnpm build` eine Zuordnung ergänzen, beispielsweise:

```yaml
CSP_COLOR: ${{ vars.CSP_COLOR || '#176b58' }}
CSP_TAGLINE: ${{ vars.CSP_TAGLINE || 'Wir sind für Sie da.' }}
CSP_LOGO_URL: ${{ vars.CSP_LOGO_URL }}
```

Alternativ öffentliche Build-Werte in einer `.env.production` im Kundenrepo pflegen. Prozessvariablen aus dem Workflow haben Vorrang. Lokale Bild- und JSON-Dateien müssen im Kundenrepo vorhanden sein; Bilder für das Frontend gehören in `public/`, und ihre URLs müssen den Basispfad berücksichtigen. Änderungen an Variablen oder Inhalten werden erst durch einen neuen Build und ein Deployment sichtbar.

Provider-Schlüssel gehören ausschließlich in die Runtime-Konfiguration des API-Hosts. Auch `CSP_CONTACT_PHONE`, `CSP_CONTENT_PATH`, `CSP_ALLOWED_ORIGINS` und die gewählte Provider-Konfiguration dort setzen; GitHub-Build-Variablen werden nicht automatisch an den API-Service weitergereicht. Alle öffentlichen Build-Werte sind im Frontend lesbar; keine Schlüssel als `VITE_*`-Variable setzen. Details zu Providern stehen unter [Konfiguration](docs/configuration.md), die benötigten Action-Secrets unter [Contribute.md](Contribute.md).

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

Vollständige Kontaktinformationen und Alert-Beschreibungen sind öffentlich. Provider-Schlüssel bleiben im API-Service. Der Chat liest statische Inhalte und die Live-Daten **seiner eigenen Instanz**, führt aber keine Aktionen aus. Gesprächsverläufe werden weder in einer Datenbank noch im Browser-Storage gespeichert.

Weitere Dokumentation: [Plugin-SDK](docs/plugin-sdk.md), [Konfiguration](docs/configuration.md), [Betrieb und Releases](docs/operations.md). Umsetzung der Anforderungen aus [circle-zero #304](https://github.com/ThinkportRepo/circle-zero/issues/304). Das bestehende PoC bleibt unverändert.
