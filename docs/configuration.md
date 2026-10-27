# Konfiguration

Neue Kundeninstanzen werden über `portal.config.json` konfiguriert. Kopiere zusätzlich die `.env.example` der Kunden-Vorlage nach `.env` für Provider und API-Betrieb. Provider-Schlüssel sind ausschließlich Runtime-Variablen des API-Services. Der Vite-Build exportiert eine explizite öffentliche Allowlist. Kein `VITE_*`-Secret setzen.

## Kundenprofil: `portal.config.json`

Das Profil verwendet Schema-Version 1. Die folgenden Felder bilden die vollständige Profilstruktur ab; unbekannte Felder werden abgelehnt. Pflichtfelder sind `schemaVersion`, `id`, `branding.name`, `contact.phone`, `contentFile` und `plugins`. Optionale Werte verwenden die Core-Defaults.

| Feld                   | Bedeutung / Standard                                                                                                                                            |
| ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schemaVersion`        | Muss `1` sein.                                                                                                                                                  |
| `id`                   | Instanzkennung; Kleinbuchstaben, Zahlen und Bindestriche, erstes Zeichen Buchstabe oder Zahl.                                                                   |
| `branding.name`        | Portal-/Kundenname.                                                                                                                                             |
| `branding.tagline`     | Hauptüberschrift; Standard `Wir sind für Sie da.`                                                                                                               |
| `branding.description` | Beschreibung; Standard `Ihr direkter Kontakt zum Operations-Team.`                                                                                              |
| `branding.logoFile`    | Lokale Logodatei relativ zum Profilverzeichnis; wird als Webasset ausgeliefert.                                                                                 |
| `branding.iconFile`    | Lokale Bilddatei für generierte PWA-Icons; sonst neutrales Symbol.                                                                                              |
| `theme.mode`           | Anfangsauswahl `light`, `dark` oder `system`; Standard `system`.                                                                                                |
| `theme.tokens`         | Designwerte; vollständige Liste unten.                                                                                                                          |
| `theme.darkTokens`     | Designwerte für den Dunkelmodus; überschreiben nur angegebene Werte aus `tokens`.                                                                               |
| `contact.phone`        | Hotline; 3–40 Zeichen aus Zahlen, Leerzeichen, Klammern und Bindestrichen, optional führendes `+`.                                                              |
| `contact.label`        | Hotline-Beschriftung; Standard `Operations-Hotline`.                                                                                                            |
| `public.apiUrl`        | Öffentliche API-Adresse, optional mit Proxy-Präfix, ohne `/api/v1`; Standard `http://localhost:3001`.                                                           |
| `public.basePath`      | `/` oder etwa `/kundenportal/`; führender und abschließender Slash, Pfadsegmente aus Buchstaben, Zahlen, `_` und `-`.                                           |
| `public.domain`        | Öffentliche Origin für den Canonical-Link; richtet keine Domain oder DNS-Einträge ein.                                                                          |
| `public.pollMs`        | Ganzzahliges Browser-Polling in Millisekunden, mindestens `1000`; Standard `60000`.                                                                             |
| `public.demo`          | `true` aktiviert gekennzeichnete synthetische Provider-Daten; Standard `false`.                                                                                 |
| `public.staticDemo`    | `true` aktiviert browserseitige synthetische Daten ohne API-Anbindung; erfordert `public.demo: true` beziehungsweise den wirksamen Override `CSP_DEMO=true`.    |
| `public.webmcp`        | `false` schaltet die WebMCP-Tools für Browser-Agenten ab; Standard `true` (an). Wirkt beim Build im Frontend, Override `CSP_WEBMCP`; siehe [WebMCP](webmcp.md). |
| `contentFile`          | JSON-Datei für Prozesse, Ticketlinks/-vorlagen und FAQ.                                                                                                         |
| `avatarsFile`          | Optionale JSON-Datei mit eigenen Mitarbeiterbildern; Format unten.                                                                                              |
| `plugins`              | Liste installierter Plugin-Paketnamen ohne Duplikate; leere Liste möglich.                                                                                      |

Beispiel für eine Kundeninstanz mit Kontakt und Inhalten, ohne Provider-Anbindung:

```json
{
  "schemaVersion": 1,
  "id": "musterkunde",
  "branding": {
    "name": "Musterkunde Service Desk",
    "tagline": "Ihr Kontakt zum Operations-Team",
    "description": "Support und Informationen für Musterkunde"
  },
  "theme": {
    "mode": "system",
    "tokens": {
      "accent": "#176b58",
      "hero": "#102e29",
      "radius": "8px"
    },
    "darkTokens": {
      "paper": "#111d19",
      "card": "#192923"
    }
  },
  "contact": {
    "phone": "+49 30 12345678",
    "label": "Support-Hotline"
  },
  "public": {
    "apiUrl": "https://api.musterkunde.example",
    "domain": "https://portal.musterkunde.example",
    "basePath": "/",
    "pollMs": 60000,
    "demo": false
  },
  "contentFile": "content.json",
  "plugins": ["@kieksme/csp-plugin-contact", "@kieksme/csp-plugin-content"]
}
```

Beispieladressen durch die eigenen Adressen ersetzen. `content.json` muss vorhanden sein; ein leerer Ausgangspunkt ist `{ "processes": [], "tickets": [], "faq": [] }`. Die vollständigen Inhaltsfelder stehen unter [Inhalte](content.md).

### Designwerte

Alle folgenden Tokens sind in `theme.tokens` und `theme.darkTokens` optional. Farben benötigen sechsstellige Hexwerte wie `#176b58`. Größen akzeptieren `px`, `rem` oder `em`; `radius` erlaubt außerdem `0`, alle anderen Größen müssen positiv sein. Schriftfamilien müssen nichtleere Zeichenketten sein.

| Token             | Bedeutung                                  | Standard (hell / dunkel, falls abweichend) |
| ----------------- | ------------------------------------------ | ------------------------------------------ |
| `accent`          | Primäre Akzentfarbe                        | `#176b58`                                  |
| `accentSecondary` | Sekundäre Akzentfarbe                      | `#c4e98f`                                  |
| `hero`            | Hero-Hintergrund                           | `#102e29`                                  |
| `paper`           | Seitenhintergrund                          | `#f6f7f2` / `#111d19`                      |
| `card`            | Kartenhintergrund                          | `#ffffff` / `#192923`                      |
| `ink`             | Haupttext                                  | `#172b26` / `#e4ebe3`                      |
| `muted`           | Nebeninformationen                         | `#5c6c64` / `#a8b9ae`                      |
| `line`            | Rahmen                                     | `#dbe1d9` / `#33483b`                      |
| `soft`            | Dezente Flächen                            | `#edf1e9` / `#24372b`                      |
| `success`         | Erfolgsstatus                              | `#388264`                                  |
| `danger`          | Fehlerstatus                               | `#da642b`                                  |
| `warning`         | Warnstatus                                 | `#985015` / `#efb181`                      |
| `neutral`         | Neutraler Status                           | `#879087`                                  |
| `warningSurface`  | Hintergrund des Offline-Hinweises          | `#f8e4b6`                                  |
| `warningInk`      | Text des Offline-Hinweises                 | `#594114`                                  |
| `heroLine`        | Dekorative Hero-Linien                     | `#73917d`                                  |
| `fontFamily`      | Fließtext                                  | `Manrope, sans-serif`                      |
| `fontMono`        | Technische Beschriftungen                  | `'IBM Plex Mono', monospace`               |
| `fontSize`        | Basis-Schriftgröße                         | `16px`                                     |
| `radius`          | Rundung für Karten, Eingabefelder und Chat | `4px`                                      |
| `spacing`         | Gemeinsame Abstandseinheit                 | `4px`                                      |
| `contentWidth`    | Maximale Inhaltsbreite                     | `1144px`                                   |
| `heroWidth`       | Maximale Hero-Breite                       | `1264px`                                   |

Ohne Overrides verwendet die Oberfläche die Core-Defaults für Hell- und Dunkelmodus. `darkTokens` überschreibt im Dunkelmodus die entsprechenden `tokens`; fehlende Werte werden aus `tokens` beziehungsweise den Core-Defaults übernommen. Textfarben auf Akzent- und Hero-Flächen werden automatisch kontrastreich gewählt. Responsive Breakpoints bleiben im Core festgelegt. Eigene Fonts muss der Betreiber verfügbar machen.

### Mitarbeiterbilder

`avatarsFile` verweist beispielsweise auf `avatars.json`:

```json
{
  "ids": { "SIGNL4-user-id": "public/avatar.webp" },
  "names": { "Lena Demo": "https://images.musterkunde.example/lena.webp" }
}
```

Beide Zuordnungen sind optional. IDs haben Vorrang vor normalisierten Namen. Lokale Bildpfade beziehen sich auf das Profilverzeichnis und werden beim Build als Webassets übernommen; absolute URL-Pfade und HTTP(S)-URLs bleiben URLs. Fehlerhafte Bilder fallen auf Initialen zurück. Der ältere Env-Override `CSP_AVATARS_PATH` verwendet dagegen eine flache Zuordnung `{ "SIGNL4-user-id": "/avatar.png" }` ohne `ids`/`names`.

### Plugins auswählen

| Paket                         | Funktion                                                                   |
| ----------------------------- | -------------------------------------------------------------------------- |
| `@kieksme/csp-plugin-contact` | Hotline und Notfallkontakt.                                                |
| `@kieksme/csp-plugin-signl4`  | Teamprofile, Avatare, Schichten, vCards und aktuelle Alerts.               |
| `@kieksme/csp-plugin-kuma`    | Öffentlicher Systemstatus aus Uptime Kuma.                                 |
| `@kieksme/csp-plugin-content` | Prozesse, Ticketlinks/-vorlagen und FAQ.                                   |
| `@kieksme/csp-plugin-chat`    | Chat mit OpenAI, Azure OpenAI oder Ollama und Quellen der eigenen Instanz. |

Die Kunden-Vorlage installiert Kontakt, Inhalte und Chat. Ein Plugin muss installiert, in den Paketabhängigkeiten deklariert und SDK-kompatibel sein. Auch externe kompatible Plugins sind möglich; deren zusätzliche Konfiguration richtet sich nach ihrer eigenen Dokumentation.

```sh
pnpm exec csp plugin add @kieksme/csp-plugin-signl4
pnpm exec csp plugin list
pnpm exec csp plugin remove @kieksme/csp-plugin-signl4
```

Die CLI synchronisiert Plugin-Liste, Paketabhängigkeiten und Lockfile. Nach Plugin-Änderungen Frontend und API neu bauen und deployen. Provider-Pflichtwerte werden nur für installierte Plugins geprüft.

## Öffentliche Env-Overrides

Die folgenden Variablen überschreiben die entsprechenden Profilwerte. `CSP_COLOR` entspricht `theme.tokens.accent`, `CSP_BACKGROUND` entspricht `theme.tokens.hero`; die übrigen Theme-Tokens sowie Plugin-Auswahl und `public.staticDemo` werden im Profil gesetzt.

| Variable                                     | Zweck / Standard                                                                          |
| -------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `CSP_NAME`, `CSP_TAGLINE`, `CSP_DESCRIPTION` | Marke, Hauptüberschrift und Beschreibung                                                  |
| `CSP_COLOR`, `CSP_BACKGROUND`                | Sechsstellige Hex-Farben; in `.env` **in Anführungszeichen**, da `#` Kommentare einleitet |
| `CSP_LOGO_URL`                               | HTTP(S)-URL oder absoluter URL-Pfad zum Logo                                              |
| `CSP_ICON_PATH`                              | Lokale Bilddatei für generierte PWA-Icons; ansonsten neutrales Symbol                     |
| `CSP_AVATARS_PATH`                           | JSON-Datei mit `{ "SIGNL4-user-id": "/avatar.png" }` für Kunden-Overrides                 |
| `CSP_DOMAIN`                                 | Öffentliche Origin für den Canonical-Link                                                 |
| `CSP_BASE_PATH`                              | `/` oder beispielsweise `/kundenportal/`; immer mit führendem und abschließendem Slash    |
| `CSP_API_URL`                                | Öffentliche API-Origin, optional mit Proxy-Präfix; ohne `/api/v1`                         |
| `CSP_CONTACT_PHONE`, `CSP_CONTACT_LABEL`     | Hotline und Beschriftung                                                                  |
| `CSP_CONTENT_PATH`                           | JSON-Datei für Prozesse, Tickets und FAQ; Vorlage `content.json`                          |
| `CSP_POLL_MS`                                | Browser-Polling; mindestens 1000 ms, Standard 60000 ms                                    |
| `CSP_DEMO`                                   | Nur `true` aktiviert synthetische Daten, sichtbar gekennzeichnet                          |
| `CSP_WEBMCP`                                 | `false` schaltet WebMCP ab, `true` (Standard) lässt es an; andere Werte sind ungültig     |

Prozesstexte und FAQ-Antworten unterstützen Markdown ohne HTML-Ausführung. Ticketvorlagen bleiben einfacher Text. JSON-Inhalte werden beim Build validiert und in das Frontend eingebunden; dieselbe Datei wird im API-Service als Chat-Wissensbasis gelesen. Inhaltsänderungen erfordern einen neuen Frontend-Build und API-Neustart.

Bei URL-Overrides lokale Logos und Avatar-Bilder unter `public/` der Kundeninstanz bereitstellen; URLs müssen den konfigurierten Basispfad enthalten. Externe Bilder benötigen im Offline-Modus weiterhin eine Verbindung. PWA-Icons werden bei jedem Build aus derselben Branding-Konfiguration erzeugt.

## SIGNL4 und Uptime Kuma

- `CSP_SIGNL4_API_KEY`, `CSP_SIGNL4_TEAM_ID`: erforderlich außerhalb der Demo. Key mit passenden **Leserechten** für Teamprofile, Schichten, Bilder und Signls.
- `CSP_SIGNL4_TIMEZONE`: IANA-Zeitzone, Standard `Europe/Berlin`; einige Windows-Bezeichnungen werden normalisiert.
- `CSP_SIGNL4_HORIZON_DAYS`: 1–90, Standard 7.
- `CSP_SIGNL4_BASE_URL`: optional, Standard `https://connect.signl4.com/api/v3`.
- `CSP_KUMA_URL`, `CSP_KUMA_SLUG`: Basisadresse und veröffentlichter Statusseiten-Slug.

Verwendete SIGNL4-v3-Routen: `GET /teams/users?teamId=…`, lesendes `POST /schedules`, lesendes `POST /signls/paged?maxResults=100`, `GET /users/{id}/image`. Der Portal-Service legt keine Signls an, bestätigt keine Alerts und verändert keine Schichten. Alerts werden über Fortsetzungstokens geladen; unvollständige Provider-Antworten werden als Fehler angezeigt.

Quellen: [SIGNL4 OpenAPI](https://connect.signl4.com/api/docs/v3/swagger.json), [Uptime-Kuma-Statusendpunkte](https://github.com/louislam/uptime-kuma/wiki/Internal-API).

## KI-Provider

`CSP_CHAT_DEMO` ist eine optionale Runtime-Variable für das Chat-Plugin. Zulässig sind die Strings `true` und `false`; ohne Angabe übernimmt der Chat den globalen Demo-Modus. `CSP_DEMO=true` mit `CSP_CHAT_DEMO=false` lässt Schichten und Status synthetisch, verwendet aber den echten konfigurierten Chat-Provider. `true` erzwingt synthetische Chat-Antworten. Die Variable wird nur serverseitig ausgewertet und nicht in den Frontend-Build übernommen. Bei `false` sind Modell und Provider-Zugangsdaten wie im Live-Modus erforderlich. Der echte Provider erhält die ausgewählten Demo-Quellen und die eingegebenen Nachrichten.

`CSP_CHAT_PROVIDER` ist `openai`, `azure` oder `ollama` (Standard). Bei einem echten Chat-Provider ist `CSP_CHAT_MODEL` erforderlich: bei Azure der Deployment-Name, bei Ollama ein lokal installiertes Modell.

| Provider     | Runtime-Variablen                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| OpenAI       | `CSP_CHAT_OPENAI_API_KEY`; optional `CSP_CHAT_OPENAI_URL` (Standard `https://api.openai.com/v1`)                              |
| Azure OpenAI | `CSP_CHAT_AZURE_API_KEY`, `CSP_CHAT_AZURE_ENDPOINT` als Ressourcen-Origin, beispielsweise `https://resource.openai.azure.com` |
| Ollama       | `CSP_CHAT_OLLAMA_URL`, Standard `http://localhost:11434`                                                                      |

OpenAI und Azure verwenden Responses mit SSE und `store: false`. Ollama verwendet natives `/api/chat` mit NDJSON. Der Portal-Service übersetzt beide in `responder`, `sources`, `delta`, `done` und `error` SSE-Ereignisse. `responder` kennzeichnet die aktuelle Bereitschaftsperson beziehungsweise das Service-Team pro Antwort; Details stehen im [API-Vertrag](api.md#absender-und-links-im-chat). Provider-Endpunkte müssen vom API-Container erreichbar sein; `localhost` im Container bezeichnet den Container selbst.

| Variable                 | Standard | Zulässiger Bereich / Bedeutung         |
| ------------------------ | -------- | -------------------------------------- |
| `CSP_CHAT_RATE_LIMIT`    | `10`     | 1–1000 Anfragen/Minute/IP.             |
| `CSP_CHAT_CONCURRENCY`   | `2`      | 1–100 aktive Anfragen je API-Prozess.  |
| `CSP_CHAT_MAX_TOKENS`    | `1024`   | 128–16384 generierte Tokens.           |
| `CSP_CHAT_TIMEOUT_MS`    | `60000`  | 1000–300000 Millisekunden pro Antwort. |
| `CSP_CHAT_CONTEXT_CHARS` | `16000`  | 1000–100000 Zeichen Quellkontext.      |

Alle fünf Limits sind optionale, ganzzahlige Runtime-Variablen und werden nicht in den Frontend-Build übernommen. Gesprächshistorie: maximal 20 Nachrichten, 4000 Zeichen je Nachricht, insgesamt 16000 Zeichen. Das Provider-/Chat-Zeitlimit beträgt standardmäßig 60 Sekunden; für langsame lokale Modelle kann es auf bis zu fünf Minuten erhöht werden. Gespräch und API-Antworten werden nicht dauerhaft gespeichert. Externe KI-Provider erhalten die ausgewählten statischen und Live-Quellen dieser Instanz.

Quellen: [OpenAI Responses](https://developers.openai.com/api/docs/guides/streaming-responses), [Azure Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses), [Ollama Chat](https://docs.ollama.com/api/chat).

## Build und Runtime getrennt konfigurieren

Vite lädt `.env`-Dateien für den jeweiligen Modus und übernimmt darüber Prozessvariablen. Der API-Einstieg lädt `.env.local` und `.env` und verwendet die Runtime-Prozessvariablen. `.env.production` ist deshalb keine automatische API-Runtime-Konfiguration.

| Runtime-Variable      | Standard / Bedeutung                                            |
| --------------------- | --------------------------------------------------------------- |
| `CSP_PORT`            | `3001`; ganzzahliger API-Port von 1 bis 65535                   |
| `CSP_HOST`            | `0.0.0.0`; Bind-Adresse                                         |
| `CSP_ALLOWED_ORIGINS` | Leere Liste; kommagetrennte erlaubte Frontend-Origins ohne Pfad |
| `CSP_TRUST_PROXY`     | Nur `true` aktiviert Vertrauen in Proxy-Header                  |

Auch am API-Host dasselbe Kundenprofil und dieselbe Inhaltsdatei bereitstellen; bei Env-Konfiguration Hotline und Inhaltsdatei dort ebenfalls setzen. Provider-Variablen werden nur für installierte Plugins validiert. Der Demo-Modus entbindet SIGNL4/Kuma/Chat von produktiven Provider-Pflichtwerten; Kontakt und Inhaltsdatei bleiben erforderlich.

Frontend-Hosting, eigene Domain, API-Hosting und die Workflow-Optionen `config`, `pages` und `public-overrides` stehen unter [Deployment](deployment.md). Das Setzen von `public.domain` ersetzt keine DNS-/Hosting-Konfiguration; der Kundenworkflow baut das API-Image, deployt die API aber nicht.

Weiter: [Deployment](deployment.md), [Inhalte](content.md), [Sicherheit und Daten](security.md).

## Deklarative Kundeninstanzen

Neue Kundeninstanzen verwenden `portal.config.json` (Schema-Version 1). Core stellt den strikten Loader unter `@kieksme/csp-core/profile` bereit; die CLI stellt `validate`, `inspect`, `dev`, `build`, `start` und `migrate` bereit. `--config` bzw. `CSP_CONFIG_PATH` wählen das Profil; `--mode` wählt die Build-Umgebung. `validate --production` und `build --production` lehnen Beispielhotline und `example.invalid`-Adressen außerhalb expliziter Demos ab.

Priorität: zentrale Defaults → Profil → unterstützte öffentliche Env-Overrides. Builds laden `.env.branding` als Übergangsadapter, danach Vites `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`, schließlich Prozessvariablen. API-Starts laden `.env.branding`, `.env`, `.env.local`, Prozessvariablen. Modusspezifische Dateien gehören nur zum Build. Alle Dateipfade sind relativ zum Profilverzeichnis; URL-Overrides bleiben URLs. Ein API-Neustart ändert kein bereits gebautes Frontend.

`csp migrate` ergänzt ein Basisprofil aus der alten Plugin-Liste, ohne bestehende Dateien zu überschreiben oder zu löschen. Bestehende `.env.branding`-Werte und explizite Overrides werden weiter gelesen. Kundenspezifische TypeScript-Konfiguration, Styles und Komponenten müssen vor Entfernung der alten Einstiege auf die gemeinsame Schnittstelle abgebildet und verglichen werden. Die CLI migriert solche Anpassungen nicht automatisch. Alte `portal.plugins.json`-Instanzen unterstützen weiterhin Plugin-Verwaltung.

Das Editor-Schema liegt im CLI-Paket unter `runtime/portal.schema.json`. Es dokumentiert die Profilstruktur; die Zod-Validierung im Loader ist maßgeblich. Die deklarative Avatar-Datei enthält getrennte `ids` und `names`, lokale Webdateien oder HTTP(S)-URLs. Provider-IDs haben Vorrang vor normalisierten Namen; fehlerhafte Bilder fallen auf Initialen zurück.

## Header-Hintergrundgrafik

`--hero-background-image` ist eine optionale öffentliche CSS-Einstellung für die gesamte Header-Fläche (Standard `none`). Sie akzeptiert einen CSS-Bildwert, etwa `url('../public/header-waves.svg')`, im per `package.json` unter `csp.stylesheet` eingebundenen Kunden-Stylesheet. Lokale URLs sind relativ zu diesem Stylesheet und werden beim Frontend-Build als Assets aufgelöst. Die Grafik wird mittig mit `cover` skaliert; transparente Bereiche zeigen die konfigurierte Header-Farbe. Es ist keine API-Runtime-Variable und kein Provider-Geheimnis. Ein Austausch der Datei oder URL erfordert einen neuen Frontend-Build. Siehe [Header-Gestaltung](plugin-sdk.md#dekorativer-header-hintergrund).

## Teams-Support

Optionales `@kieksme/csp-plugin-teams`; [vollständige Einrichtung](teams-support.md). Alle folgenden Werte sind API-Runtime-Konfiguration. `chatSupport` im Profil enthält ausschließlich öffentliche Frontend-Einstellungen und wird beim Build festgelegt. Zulässige Modi: `teams`, `slack`, `telegram` oder `demo`. Bei Entra-Authentifizierung sind `tenantId` und `clientId` als GUID sowie der vollständige API-`scope` Pflicht; Das zum Modus passende Support-Plugin muss installiert sein; mehrere Supporttransporte gemeinsam sind ausgeschlossen. Demo-Modus erfordert das synthetische Portal. Optionales `chatSupport.auth`: `msal` (Standard bei fehlender Angabe) oder `session`; Slack und Telegram erlauben zusätzlich `anonymous` für eine offene Webseite ohne Login (keine Entra-IDs erforderlich). Build-Einstellung; im Session-Modus verwendet der Browser die vorhandene gleichursprüngliche Portal-Sitzung und erhält nur den API-bestätigten Anzeigenamen. Ein vertrauenswürdiger Gateway muss ein delegiertes API-Token mit passendem Tenant, Audience und `Chat.Access`-Scope ausschließlich serverseitig weitergeben. Die API-Tokenprüfung bleibt unverändert. API und Web-Gateway dürfen nicht direkt öffentlich erreichbar sein; schreibende Cookie-Anfragen benötigen Origin-/CSRF-Prüfung. Demo-Modus benötigt keine Anmeldung.

| Variable                     | Standard                                 | Pflicht und Grenzen                                                                                                                   |
| ---------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_TEAMS_ENABLED`          | `false`                                  | `true`/`false`; aktiviert produktiven Support                                                                                         |
| `CSP_TEAMS_DEMO`             | `false`                                  | `true`/`false`; nur mit `CSP_DEMO=true` und ohne Live-Teams                                                                           |
| `CSP_CHAT_DATABASE_URL`      | keiner                                   | Live: PostgreSQL-URL, Secret; eigene Datenbank                                                                                        |
| `CSP_CHAT_RETENTION_DAYS`    | `30`                                     | Ganzzahl 1–365; Portal-Daten nach Inaktivität löschen                                                                                 |
| `CSP_ENTRA_TENANT_ID`        | keiner                                   | Live: Tenant-GUID, entspricht Frontend                                                                                                |
| `CSP_ENTRA_API_AUDIENCE`     | keiner                                   | Live: v2-API-Application-ID                                                                                                           |
| `CSP_ENTRA_API_SCOPE`        | `Chat.Access`                            | Delegierter Scope, nicht leer                                                                                                         |
| `CSP_ENTRA_PORTAL_CLIENT_ID` | keiner                                   | Live: Portal-Login-App-GUID, entspricht Frontend                                                                                      |
| `CSP_TEAMS_APP_ID`           | keiner                                   | Live: Bot-App-GUID                                                                                                                    |
| `CSP_TEAMS_APP_SECRET`       | keiner                                   | Live: Bot-App-Secret, ausschließlich Runtime                                                                                          |
| `CSP_TEAMS_TEAM_ID`          | keiner                                   | Live: tatsächliche Teams-Team-ID, nicht leer                                                                                          |
| `CSP_TEAMS_CHANNEL_ID`       | keiner                                   | Live: Standard-Channel-ID, nicht leer                                                                                                 |
| `CSP_TEAMS_SUPPORT_GROUP_ID` | keiner                                   | Live: Entra-Gruppen-GUID                                                                                                              |
| `CSP_TEAMS_SUPPORT_AUTH`     | `group`                                  | API-Runtime: `group` prüft beliebige Entra-Gruppe; `team` prüft Teams-Mitglieder mit RSC, Support-Gruppen-ID muss Team-ID entsprechen |
| `CSP_TEAMS_SERVICE_URL`      | `https://smba.trafficmanager.net/teams/` | Microsoft-Service-URL; Public/GCC/GCC High/DoD-Hosts                                                                                  |

Frontend-Scope: `api://<CSP_ENTRA_API_AUDIENCE>/<CSP_ENTRA_API_SCOPE>`. Für Live-Support müssen alle Pflichtwerte gesetzt sein; fehlende Werte oder abweichendes Frontend-/Runtime-Profil verhindern den API-Start. Chat-Limits und Provider-Konfiguration gelten weiter. Ein API-Replikat mit `Recreate` verwenden.

Kundenstyles können in `package.json` unter `csp.stylesheet` als Pfad relativ zum Kundenrepo angegeben werden. Die CLI importiert sie nach den Core-Styles und stellt referenzierte Profil-Assets vor Vites HTML-Fallback bereit. Damit benötigen Kunden beim Produktupdate keine entsprechenden CLI-Übergangspatches mehr.

## Slack-Support

Optionales `@kieksme/csp-plugin-slack`; [Installation und Betrieb](slack-support.md). Alle folgenden Werte sind **API-Runtime**-Konfiguration und gehören niemals in `VITE_*`, das Frontend-Profil oder Build-Secrets. `chatSupport.mode: "slack"` ist eine öffentliche Build-Einstellung; `tenantId`, `clientId`, `scope` und optional `auth` folgen den Entra-Regeln im Abschnitt Teams-Support. Der Portal-Login bleibt Entra; Supportrechte werden über Slack geprüft.

| Variable                     | Standard / Pflicht               | Zweck und zulässige Werte                                                                                                                                                                                                  |
| ---------------------------- | -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_SLACK_ENABLED`          | `false`                          | `true`/`false`; aktiviert Live-Slack. Bei Slack-Live-Profil Pflicht `true`.                                                                                                                                                |
| `CSP_SLACK_AUTH`             | `entra`                          | API-Runtime: `entra` oder `anonymous`; muss dem öffentlichen Profil entsprechen. Anonymous ist nur bei Slack verfügbar.                                                                                                    |
| `CSP_CHAT_SESSION_SECRET`    | Kein Standard                    | API-Runtime: Pflicht bei `CSP_SLACK_AUTH=anonymous`; zufälliger 32-Byte-Schlüssel als 64 Hexzeichen. Nicht ins Profil oder Image aufnehmen. Signiert Besuchertokens für 24 Stunden; Rotation beendet bestehende Sitzungen. |
| `CSP_SLACK_DEMO`             | `false`                          | `true`/`false`; nur mit `CSP_DEMO=true`, `CSP_SLACK_ENABLED=false` und Profilmodus `demo`.                                                                                                                                 |
| `CSP_SLACK_BOT_TOKEN`        | Kein Standard; Pflicht mit Entra | Bot-Token `xoxb-…`, Secret; wird für Slack Web API verwendet.                                                                                                                                                              |
| `CSP_SLACK_SIGNING_SECRET`   | Kein Standard; Pflicht mit Entra | Secret mit mindestens 16 Zeichen; HMAC-Verifikation der Callbacks.                                                                                                                                                         |
| `CSP_SLACK_APP_ID`           | Kein Standard; Pflicht mit Entra | Slack-App-ID `A…`, Großbuchstaben/Ziffern, mindestens drei Zeichen; isoliert Callback-App.                                                                                                                                 |
| `CSP_SLACK_TEAM_ID`          | Kein Standard; Pflicht mit Entra | Workspace-ID `T…`, gleiche Syntax; genau ein Workspace.                                                                                                                                                                    |
| `CSP_SLACK_CHANNEL_ID`       | Kein Standard; Pflicht mit Entra | Channel-ID `C…` oder `G…`, gleiche Syntax; aktiver interner Channel mit Bot-Mitgliedschaft.                                                                                                                                |
| `CSP_SLACK_SUPPORT_USER_IDS` | Kein Standard; Pflicht mit Entra | Kommaseparierte Liste mit 1–100 Nutzer-IDs `U…`/`W…`; Großbuchstaben/Ziffern, mindestens drei Zeichen. Jede Aktion erfordert zusätzlich aktuelle Channel-Mitgliedschaft und aktiven menschlichen Nutzer.                   |
| `CSP_CHAT_DATABASE_URL`      | Kein Standard; Pflicht mit Entra | Eigene PostgreSQL-URL `postgres://` oder `postgresql://`; gemeinsame Gesprächs-/Outbox-/Inbox-Speicherung, Server-Secret.                                                                                                  |
| `CSP_CHAT_RETENTION_DAYS`    | `30`                             | Ganze Zahl 1–365; löscht Portal-Gespräche nach dieser Anzahl Tage ohne Aktivität samt Queues und Empfangsbelegen. Slack und Backups behalten ihre eigene Aufbewahrung.                                                     |
| `CSP_ENTRA_TENANT_ID`        | Kein Standard; Pflicht mit Entra | GUID des Portal-Tenants; Eigentümerprüfung.                                                                                                                                                                                |
| `CSP_ENTRA_API_AUDIENCE`     | Kein Standard; Pflicht mit Entra | GUID der API-App; JWT-Audience.                                                                                                                                                                                            |
| `CSP_ENTRA_API_SCOPE`        | `Chat.Access`                    | Nichtleerer delegierter API-Scope; muss dem öffentlichen Profilscope entsprechen.                                                                                                                                          |
| `CSP_ENTRA_PORTAL_CLIENT_ID` | Kein Standard; Pflicht mit Entra | GUID der Portal-SPA-App; muss dem Profil entsprechen.                                                                                                                                                                      |

Beispiel: `templates/customer/.env.slack.example`. Profil und Editor-Schema erlauben Slack; Installation allein aktiviert keine Routen. Vor Nutzung beide Images mit demselben Profil bauen, Runtime setzen und reale Slack-Abnahme durchführen. Eine eigene Datenbank und genau ein API-Replikat verwenden.

Bei Slack mit `chatSupport.auth: "anonymous"` entstehen automatisch Besuchersitzungen mit 24 Stunden Laufzeit, gespeichert im Browser-Tab (`sessionStorage`). Zugriff auf Gespräche erfordert das signierte Bearer-Token, keinen Login. Fünf neue Sitzungen je IP/Stunde und 30 schreibende Gesprächsanfragen je IP/Minute; bestehende Nachrichten-/Generierungsgrenzen gelten zusätzlich. Der Anzeigename ist nicht verifiziert. Details und Proxy-Konfiguration: [Slack-Support](slack-support.md#offene-webseite-ohne-login).

## Telegram-Support

Optionales `@kieksme/csp-plugin-telegram`; [Einrichtung, Rechte und Zustellung](telegram-support.md). Alle folgenden Werte sind ausschließlich **API-Runtime**. Das öffentliche Build-Profil verwendet `chatSupport.mode: "telegram"` und `auth: "anonymous"` für offene Webseiten oder `msal`/`session` mit den Entra-IDs für verifizierte Portal-Nutzer. Genau ein Supporttransport je Profil.

| Variable                        | Zweck                                | Pflicht und Standard                        | Zulässige Werte und Grenzen                                                                                           |
| ------------------------------- | ------------------------------------ | ------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `CSP_TELEGRAM_ENABLED`          | Echte Telegram-Verbindung aktivieren | Nein, `false`                               | `true` / `false`                                                                                                      |
| `CSP_TELEGRAM_DEMO`             | Synthetische Support-UI              | Nein, `false`                               | `true` erfordert `CSP_DEMO=true` und `CSP_TELEGRAM_ENABLED=false`                                                     |
| `CSP_TELEGRAM_AUTH`             | Portal-Authentifizierung             | Nein, `entra`                               | `entra` / `anonymous`; muss zum öffentlichen Profil passen                                                            |
| `CSP_TELEGRAM_BOT_TOKEN`        | Bot API autorisieren, Secret         | Bei aktivem Live-Support, kein Standard     | Numerische Bot-ID, Doppelpunkt, mindestens 20 Tokenzeichen; nur Runtime                                               |
| `CSP_TELEGRAM_WEBHOOK_SECRET`   | Secret-Header eingehender Webhooks   | Bei aktivem Live-Support, kein Standard     | 32–256 Zeichen, `A-Z`, `a-z`, `0-9`, `_`, `-`; identisch zu `setWebhook.secret_token`                                 |
| `CSP_TELEGRAM_CHAT_ID`          | Eine Forum-Supergruppe auswählen     | Bei aktivem Live-Support, kein Standard     | Negative numerische `-100…`-ID, sichere Ganzzahl; beim Start auf Forum und Botrechte geprüft                          |
| `CSP_TELEGRAM_SUPPORT_USER_IDS` | Berechtigte Supportpersonen          | Bei aktivem Live-Support, kein Standard     | 1–100 kommaseparierte positive numerische Telegram-Nutzer-IDs; aktuelle Gruppenmitgliedschaft zusätzlich erforderlich |
| `CSP_CHAT_DATABASE_URL`         | Persistenz, Inbox und Outbox         | Bei aktivem Live-Support, kein Standard     | PostgreSQL-Verbindungs-URL; eigene Support-Datenbank und ein API-Replikat                                             |
| `CSP_CHAT_SESSION_SECRET`       | Besuchertoken signieren              | Bei aktivem anonymem Support, kein Standard | 64 Hexzeichen, stabil über API-Neustarts; niemals im Frontend                                                         |
| `CSP_CHAT_RETENTION_DAYS`       | Datenbank-Aufbewahrung               | Nein, `30`                                  | Ganze Zahl 1–365; Telegram-Nachrichten werden nicht gelöscht                                                          |

Für `entra` sind `CSP_ENTRA_TENANT_ID`, `CSP_ENTRA_API_AUDIENCE` und `CSP_ENTRA_PORTAL_CLIENT_ID` als UUID Pflicht; `CSP_ENTRA_API_SCOPE` ist standardmäßig `Chat.Access`. Dieselben Profil-/Gateway-Regeln wie bei Teams gelten. Beispiel: `templates/customer/.env.telegram.example`. Webhook-Pfad: `/api/telegram/webhook`, Registrierung mit `max_connections=1`. Die Installation allein registriert keinen externen Webhook und aktiviert keine Live-Verbindung.

## Spracheingabe und Supportanfragen

Alle folgenden Werte sind ausschließlich API-Runtime-Konfiguration; sie gehören nicht in das öffentliche Kundenprofil oder den Frontend-Build.

| Variable                         | Zweck, Standard und Grenzen                                                                                                                                                                                                                                                                                            |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_CHAT_TRANSCRIPTION_ENABLED` | Optional `true` (Standard) oder `false`. Nur echte OpenAI-Provider mit vorhandenem `CSP_CHAT_OPENAI_API_KEY` aktivieren Spracheingabe; Demo, Azure und Ollama bleiben ohne Transkription. Bei OpenAI-kompatiblen Proxies ohne Audio-API auf `false` setzen.                                                            |
| `CSP_CHAT_TRANSCRIPTION_MODEL`   | Optionaler Modellname, Standard `gpt-4o-mini-transcribe`, 1–100 Zeichen. Verwendet denselben API-Schlüssel und optionalen `CSP_CHAT_OPENAI_URL` wie der Chat. Das konfigurierte Modell muss die OpenAI-Dateitranskription unterstützen.                                                                                |
| `CSP_SUPPORT_DUTY_USER_MAP`      | Optional JSON-Objekt, Standard `{}`: echte Dienstplan-ID → Account-ID des aktiven Support-Transports. Maximal 100 Zuordnungen, IDs 1–100 Zeichen; Account-IDs nur Buchstaben, Ziffern, `_`, `-`. Slack: `U…`/`W…`; Teams: Entra-Object-ID; Telegram: numerische Benutzer-ID. Supportberechtigung wird separat geprüft. |
| `CSP_SUPPORT_FALLBACK_USER_IDS`  | Optional kommagetrennte feste Vertretungen, Standard leer. Maximal 20 Account-IDs mit obigem Format. Bei fehlender Dienstzuordnung benachrichtigen; ohne berechtigte Vertretung Channel-Anfrage ohne Erwähnung.                                                                                                        |

`CSP_CHAT_RATE_LIMIT`, `CSP_CHAT_CONCURRENCY` und `CSP_CHAT_TIMEOUT_MS` begrenzen auch die Transkriptions-API, mit eigener Quote pro IP und zusätzlich authentifizierter Sitzung. Aufnahmegrenze im Browser: 60 Sekunden; API-Uploadgrenze: 10 MiB. [Bedienung, API und Zustellungszustände](chat.md).

## Datadog

Optionales Plugin: `@kieksme/csp-plugin-datadog`. Alle nachfolgenden Optionen sind **Server-Runtime** und werden beim API-Start geprüft. Sie gehören nicht in `public`, `VITE_*` oder das Browser-Bundle. [Einrichtung und Betriebsgrenzen](datadog.md).

| Option                        | Zweck                           | Pflicht/Standard         | Zulässige Werte                                                                                                                          |
| ----------------------------- | ------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `CSP_DATADOG_SITE`            | Datadog-Region                  | Optional; `datadoghq.eu` | `datadoghq.eu`, `datadoghq.com`, `us3.datadoghq.com`, `us5.datadoghq.com`, `ap1.datadoghq.com`, `ap2.datadoghq.com`, `uk1.datadoghq.com` |
| `CSP_DATADOG_API_KEY`         | API-Key                         | Pflicht außerhalb Demo   | Nicht leer; Secret                                                                                                                       |
| `CSP_DATADOG_APP_KEY`         | Application-Key mit Leserechten | Pflicht außerhalb Demo   | Nicht leer; Secret                                                                                                                       |
| `CSP_DATADOG_CASE_PROJECT_ID` | Auswahl eines Case-Projekts     | Pflicht außerhalb Demo   | UUID                                                                                                                                     |
| `CSP_DATADOG_MONITOR_IDS`     | Freigegebene Monitore           | Pflicht außerhalb Demo   | 1–50 numerische IDs, kommagetrennt                                                                                                       |
| `CSP_DATADOG_SLO_IDS`         | Freigegebene SLOs               | Pflicht außerhalb Demo   | 1–50 IDs aus Buchstaben, Zahlen und Bindestrichen, kommagetrennt                                                                         |
| `CSP_DATADOG_SCHEDULE_IDS`    | Freigegebene Bereitschaftspläne | Pflicht außerhalb Demo   | 1–10 IDs aus Buchstaben, Zahlen und Bindestrichen, kommagetrennt                                                                         |

`CSP_DEMO=true` verzichtet auf alle Datadog-Zugangsdaten und liefert synthetische Daten. SLO-Fenster: fest 30 Tage. Schichtfenster: fest sieben Tage. Browser-Aktualisierung: bestehendes `public.pollMs`, standardmäßig 60 Sekunden.

## Optional Swetrix analytics

`analytics.swetrix` is an optional public **build-time** profile object. It is copied to `PublicConfig.analytics.swetrix`; changing it requires rebuilding the frontend. Install `@kieksme/csp-plugin-swetrix` to activate it. There are no new server secrets or environment overrides.

| Property     | Required             | Default | Allowed values / purpose                                                                           |
| ------------ | -------------------- | ------- | -------------------------------------------------------------------------------------------------- |
| `projectId`  | yes, when configured | none    | 1–50 ASCII letters/digits; public Swetrix project ID                                               |
| `apiUrl`     | yes                  | none    | Absolute HTTPS Events API ingestion endpoint (including `/log`); no credentials, query or fragment |
| `variant`    | yes                  | none    | 1–50 lowercase letters/digits/hyphens, starting with letter/digit; distinguishes portal builds     |
| `enabled`    | no                   | `true`  | Boolean; disables all analytics requests when false                                                |
| `respectDNT` | no                   | `true`  | Boolean; suppresses requests for browser DNT `1`                                                   |

Localhost, `.localhost`, IPv4 loopback, IPv6 loopback and `0.0.0.0` never send analytics even when enabled. Metadata is limited to variant, section, FAQ/process IDs, contact channel and chat mode. See [Swetrix analytics](analytics.md) for the event catalog, funnels and verification.

Die Suchmaschinenregeln sind ein fester Build-Default ohne Env-/Profiloption: `noindex, nofollow`, Root-`robots.txt` mit `Disallow: /` und eine statische Header-Vorlage. Runtime-API und Dev-/Preview-Server setzen `X-Robots-Tag`. Hosting unter `CSP_BASE_PATH` benötigt zusätzlich die Root-Datei; siehe [Deployment](deployment.md#suchmaschinensteuerung).
