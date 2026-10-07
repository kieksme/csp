# Konfiguration

Kopiere die `.env.example` der Kunden-Vorlage nach `.env`. Provider-Schlüssel sind ausschließlich Runtime-Variablen des API-Services. Der Vite-Build exportiert eine explizite öffentliche Allowlist. Kein `VITE_*`-Secret setzen.

## Branding und statische Inhalte

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
| `CSP_POLL_MS`                                | Browser-Polling; Standard 60000 ms                                                        |
| `CSP_DEMO`                                   | Nur `true` aktiviert synthetische Daten, sichtbar gekennzeichnet                          |

Prozesstexte und FAQ-Antworten unterstützen Markdown ohne HTML-Ausführung. Ticketvorlagen bleiben einfacher Text. JSON-Inhalte werden beim Build validiert und in das Frontend eingebunden; dieselbe Datei wird im API-Service als Chat-Wissensbasis gelesen. Inhaltsänderungen erfordern einen neuen Frontend-Build und API-Neustart.

Lokale Logos und Avatar-Overrides gehören in `public/` der Kundeninstanz; URLs müssen den konfigurierten Basispfad enthalten. Externe Bilder benötigen im Offline-Modus weiterhin eine Verbindung. PWA-Icons werden bei jedem Build aus derselben Branding-Konfiguration erzeugt.

## SIGNL4 und Uptime Kuma

- `CSP_SIGNL4_API_KEY`, `CSP_SIGNL4_TEAM_ID`: erforderlich außerhalb der Demo. Key mit passenden **Leserechten** für Teamprofile, Schichten, Bilder und Signls.
- `CSP_SIGNL4_TIMEZONE`: IANA-Zeitzone, Standard `Europe/Berlin`; einige Windows-Bezeichnungen werden normalisiert.
- `CSP_SIGNL4_HORIZON_DAYS`: 1–90, Standard 7.
- `CSP_SIGNL4_BASE_URL`: optional, Standard `https://connect.signl4.com/api/v3`.
- `CSP_KUMA_URL`, `CSP_KUMA_SLUG`: Basisadresse und veröffentlichter Statusseiten-Slug.

Verwendete SIGNL4-v3-Routen: `GET /teams/users?teamId=…`, lesendes `POST /schedules`, lesendes `POST /signls/paged?maxResults=100`, `GET /users/{id}/image`. Der Portal-Service legt keine Signls an, bestätigt keine Alerts und verändert keine Schichten. Alerts werden über Fortsetzungstokens geladen; unvollständige Provider-Antworten werden als Fehler angezeigt.

Quellen: [SIGNL4 OpenAPI](https://connect.signl4.com/api/docs/v3/swagger.json), [Uptime-Kuma-Statusendpunkte](https://github.com/louislam/uptime-kuma/wiki/Internal-API).

## KI-Provider

`CSP_CHAT_PROVIDER` ist `openai`, `azure` oder `ollama` (Standard). Außerhalb der Demo ist `CSP_CHAT_MODEL` erforderlich: bei Azure der Deployment-Name, bei Ollama ein lokal installiertes Modell.

| Provider     | Runtime-Variablen                                                                                                             |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| OpenAI       | `CSP_CHAT_OPENAI_API_KEY`; optional `CSP_CHAT_OPENAI_URL`                                                                     |
| Azure OpenAI | `CSP_CHAT_AZURE_API_KEY`, `CSP_CHAT_AZURE_ENDPOINT` als Ressourcen-Origin, beispielsweise `https://resource.openai.azure.com` |
| Ollama       | `CSP_CHAT_OLLAMA_URL`, Standard `http://localhost:11434`                                                                      |

OpenAI und Azure verwenden Responses mit SSE und `store: false`. Ollama verwendet natives `/api/chat` mit NDJSON. Der Portal-Service übersetzt beide in `sources`, `delta`, `done` und `error` SSE-Ereignisse. Provider-Endpunkte müssen vom API-Container erreichbar sein; `localhost` im Container bezeichnet den Container selbst.

Limits: `CSP_CHAT_RATE_LIMIT=10` Anfragen/Minute/IP; `CSP_CHAT_CONCURRENCY=2` aktive Anfragen je API-Prozess; `CSP_CHAT_MAX_TOKENS=1024` generierte Tokens; `CSP_CHAT_CONTEXT_CHARS=16000` Zeichen Quellkontext. Gesprächshistorie: maximal 20 Nachrichten, 4000 Zeichen je Nachricht, insgesamt 16000 Zeichen. Provider-/Chat-Zeitlimit: 60 Sekunden. Gespräch und API-Antworten werden nicht dauerhaft gespeichert. Externe KI-Provider erhalten die ausgewählten statischen und Live-Quellen dieser Instanz.

Quellen: [OpenAI Responses](https://developers.openai.com/api/docs/guides/streaming-responses), [Azure Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/responses), [Ollama Chat](https://docs.ollama.com/api/chat).

## Build und Runtime getrennt konfigurieren

Vite lädt `.env`-Dateien für den jeweiligen Modus und übernimmt darüber Prozessvariablen. Der API-Einstieg lädt `.env.local` und `.env` und verwendet die Runtime-Prozessvariablen. `.env.production` ist deshalb keine automatische API-Runtime-Konfiguration.

| Runtime-Variable      | Standard / Bedeutung                                            |
| --------------------- | --------------------------------------------------------------- |
| `CSP_PORT`            | `3001`; API-Port                                                |
| `CSP_HOST`            | `0.0.0.0`; Bind-Adresse                                         |
| `CSP_ALLOWED_ORIGINS` | Leere Liste; kommagetrennte erlaubte Frontend-Origins ohne Pfad |
| `CSP_TRUST_PROXY`     | Nur `true` aktiviert Vertrauen in Proxy-Header                  |

Hotline und Inhaltsdatei auch am API-Host setzen. Provider-Variablen werden nur für installierte Plugins validiert. Der Demo-Modus entbindet SIGNL4/Kuma/Chat von produktiven Provider-Pflichtwerten; Kontakt und Inhaltsdatei bleiben erforderlich.

Weiter: [Deployment](deployment.md), [Inhalte](content.md), [Sicherheit und Daten](security.md).

## Deklarative Kundeninstanzen

Neue Kundeninstanzen verwenden `portal.config.json` (Schema-Version 1). Core stellt den strikten Loader unter `@kieksme/csp-core/profile` bereit; die CLI stellt `validate`, `inspect`, `dev`, `build`, `start` und `migrate` bereit. `--config` bzw. `CSP_CONFIG_PATH` wählen das Profil; `--mode` wählt die Build-Umgebung. `validate --production` und `build --production` lehnen Beispielhotline und `example.invalid`-Adressen außerhalb expliziter Demos ab.

Priorität: zentrale Defaults → Profil → unterstützte öffentliche Env-Overrides. Builds laden `.env.branding` als Übergangsadapter, danach Vites `.env`, `.env.local`, `.env.[mode]`, `.env.[mode].local`, schließlich Prozessvariablen. API-Starts laden `.env.branding`, `.env`, `.env.local`, Prozessvariablen. Modusspezifische Dateien gehören nur zum Build. Alle Dateipfade sind relativ zum Profilverzeichnis; URL-Overrides bleiben URLs. Ein API-Neustart ändert kein bereits gebautes Frontend.

`csp migrate` ergänzt ein Basisprofil aus der alten Plugin-Liste, ohne bestehende Dateien zu überschreiben oder zu löschen. Bestehende `.env.branding`-Werte und explizite Overrides werden weiter gelesen. Kundenspezifische TypeScript-Konfiguration, Styles und Komponenten müssen vor Entfernung der alten Einstiege auf die gemeinsame Schnittstelle abgebildet und verglichen werden. Die CLI migriert solche Anpassungen nicht automatisch. Alte `portal.plugins.json`-Instanzen unterstützen weiterhin Plugin-Verwaltung.

Das Editor-Schema liegt im CLI-Paket unter `runtime/portal.schema.json`. Es dokumentiert die Profilstruktur; die Zod-Validierung im Loader ist maßgeblich. Die deklarative Avatar-Datei enthält getrennte `ids` und `names`, lokale Webdateien oder HTTP(S)-URLs. Provider-IDs haben Vorrang vor normalisierten Namen; fehlerhafte Bilder fallen auf Initialen zurück.
