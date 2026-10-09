# Konfiguration

Neue Kundeninstanzen werden über `portal.config.json` konfiguriert. Kopiere zusätzlich die `.env.example` der Kunden-Vorlage nach `.env` für Provider und API-Betrieb. Provider-Schlüssel sind ausschließlich Runtime-Variablen des API-Services. Der Vite-Build exportiert eine explizite öffentliche Allowlist. Kein `VITE_*`-Secret setzen.

## Kundenprofil: `portal.config.json`

Das Profil verwendet Schema-Version 1. Die folgenden Felder bilden die vollständige Profilstruktur ab; unbekannte Felder werden abgelehnt. Pflichtfelder sind `schemaVersion`, `id`, `branding.name`, `contact.phone`, `contentFile` und `plugins`. Optionale Werte verwenden die Core-Defaults.

| Feld                   | Bedeutung / Standard                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `schemaVersion`        | Muss `1` sein.                                                                                                                                               |
| `id`                   | Instanzkennung; Kleinbuchstaben, Zahlen und Bindestriche, erstes Zeichen Buchstabe oder Zahl.                                                                |
| `branding.name`        | Portal-/Kundenname.                                                                                                                                          |
| `branding.tagline`     | Hauptüberschrift; Standard `Wir sind für Sie da.`                                                                                                            |
| `branding.description` | Beschreibung; Standard `Ihr direkter Kontakt zum Operations-Team.`                                                                                           |
| `branding.logoFile`    | Lokale Logodatei relativ zum Profilverzeichnis; wird als Webasset ausgeliefert.                                                                              |
| `branding.iconFile`    | Lokale Bilddatei für generierte PWA-Icons; sonst neutrales Symbol.                                                                                           |
| `theme.mode`           | Anfangsauswahl `light`, `dark` oder `system`; Standard `system`.                                                                                             |
| `theme.tokens`         | Designwerte; vollständige Liste unten.                                                                                                                       |
| `theme.darkTokens`     | Designwerte für den Dunkelmodus; überschreiben nur angegebene Werte aus `tokens`.                                                                            |
| `contact.phone`        | Hotline; 3–40 Zeichen aus Zahlen, Leerzeichen, Klammern und Bindestrichen, optional führendes `+`.                                                           |
| `contact.label`        | Hotline-Beschriftung; Standard `Operations-Hotline`.                                                                                                         |
| `public.apiUrl`        | Öffentliche API-Adresse, optional mit Proxy-Präfix, ohne `/api/v1`; Standard `http://localhost:3001`.                                                        |
| `public.basePath`      | `/` oder etwa `/kundenportal/`; führender und abschließender Slash, Pfadsegmente aus Buchstaben, Zahlen, `_` und `-`.                                        |
| `public.domain`        | Öffentliche Origin für den Canonical-Link; richtet keine Domain oder DNS-Einträge ein.                                                                       |
| `public.pollMs`        | Ganzzahliges Browser-Polling in Millisekunden, mindestens `1000`; Standard `60000`.                                                                          |
| `public.demo`          | `true` aktiviert gekennzeichnete synthetische Provider-Daten; Standard `false`.                                                                              |
| `public.staticDemo`    | `true` aktiviert browserseitige synthetische Daten ohne API-Anbindung; erfordert `public.demo: true` beziehungsweise den wirksamen Override `CSP_DEMO=true`. |
| `contentFile`          | JSON-Datei für Prozesse, Ticketlinks/-vorlagen und FAQ.                                                                                                      |
| `avatarsFile`          | Optionale JSON-Datei mit eigenen Mitarbeiterbildern; Format unten.                                                                                           |
| `plugins`              | Liste installierter Plugin-Paketnamen ohne Duplikate; leere Liste möglich.                                                                                   |

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

OpenAI und Azure verwenden Responses mit SSE und `store: false`. Ollama verwendet natives `/api/chat` mit NDJSON. Der Portal-Service übersetzt beide in `sources`, `delta`, `done` und `error` SSE-Ereignisse. Provider-Endpunkte müssen vom API-Container erreichbar sein; `localhost` im Container bezeichnet den Container selbst.

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
