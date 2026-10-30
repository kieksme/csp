# Datadog

Das optionale Paket `@kieksme/csp-plugin-datadog` bündelt Datadog Case Management, Monitors, SLOs und On-Call. Es liest ausschließlich Daten. Tickets, Monitore und Schichtpläne werden über Links in Datadog bearbeitet. Die echte Datadog-Verbindung ist **noch ungetestet**; automatisierte Tests prüfen dokumentierte API-Antworten mit Mocks.

Unabhängig davon instrumentiert Core die API mit **Datadog APM** (`dd-trace`); siehe [APM](#apm-dd-trace).

## Installation und Anzeige

Ab CSP 0.14.0 `csp plugin add @kieksme/csp-plugin-datadog@0.14.0` ausführen oder das installierte Paket in die `plugins`-Liste des Kundenprofils aufnehmen. Ein eigenes Profil kann SIGNL4 und Kuma durch Datadog ersetzen. Für einen Datadog-Header SIGNL4 aus diesem Profil entfernen: CSP verwendet die erste registrierte Hero-Komponente. Es gibt keine Überschneidung der API-Routen.

Drei Bereiche zeigen Tickets (20 pro Seite, Statusfilter), Monitorstatus und SLOs sowie aktuelle Bereitschaft und die nächsten sieben Tage. SLOs zeigen den gemessenen Wert, das für `30d` konfigurierte Ziel und das verbleibende Error Budget. SLOs ohne 30-Tage-Ziel oder mit Teilfehlern werden als nicht verfügbar angezeigt. Negative Error Budgets werden erhalten. Die Erfüllungsquote ist keine allgemeine Verfügbarkeitsgarantie.

Monitorzustände bleiben unterscheidbar: OK, Warnung, Alarm, Wartung, keine Daten und unbekannt. Bei Ausfällen kennzeichnet der Cache den letzten Erfolg als veraltet. Erreichbarkeit wird dann nicht bestätigt. Dienste werden an ihren Grenzen neu ausgewertet. Jede Schicht zeigt die Zeitzone ihres Datadog-Schedules; parallele Schichten und durch Datadog aufgelöste Vertretungen bleiben sichtbar.

Cases zeigen Titel, Status, Priorität und Zuständigkeit als Datadog-Benutzer-ID. Beschreibungen, E-Mail-Adressen und Telefonnummern werden nicht übertragen. Der Server prüft zusätzlich die Projektzugehörigkeit der Suchergebnisse. Eigene Statusnamen bleiben erhalten. Die Portal-Seiten beginnen bei 0 und werden für Datadog in Seiten ab 1 übersetzt. Die erste Seite des ausgewählten Acme-Testprojekts wurde am 16. Oktober 2026 live gelesen; das Projekt war dabei leer. Statusfilter und befüllte Projekte sind noch nicht live abgenommen.

Leere oder fehlende Anzeigenamen von Dienstpersonen werden als `ID: <Benutzer-ID>` dargestellt; E-Mail-Adressen dienen nicht als Ersatz. Monitor-Zeitstempel werden für die Statusanzeige nicht benötigt. `null` statt einer SLO-Fehlerliste gilt als keine gemeldeten Fehler; vorhandene Fehler oder fehlende Kennzahlen bleiben als nicht verfügbar gekennzeichnet.

## Serverkonfiguration

Alle Optionen werden beim API-Start geprüft, niemals als Browser-Konfiguration ausgegeben. Leere Schlüssel- und Auswahl-Platzhalter gelten als nicht gesetzt; im Demo-Modus sind sie erlaubt, außerhalb der Demo bleiben sie Pflicht. Die vollständige Tabelle steht in [Konfiguration](configuration.md#datadog).

```dotenv
CSP_DATADOG_SITE=datadoghq.eu
CSP_DATADOG_API_KEY=
CSP_DATADOG_APP_KEY=
CSP_DATADOG_CASE_PROJECT_ID=
CSP_DATADOG_MONITOR_IDS=123,456
CSP_DATADOG_SLO_IDS=
CSP_DATADOG_SCHEDULE_IDS=
```

API- und Application-Key ausschließlich am API-Host hinterlegen. Leserechte `cases_read`, `monitors_read`, `slos_read` und `on_call_read` verwenden; Datadog Case Management und On-Call müssen im Konto verfügbar sein. Die Auswahl von Projekt, Monitoren, SLOs und Schedules ist verpflichtend. Das Plugin öffnet keine organisationsweite Datenansicht. Das vorhandene öffentliche Portal veröffentlicht jedoch die ausgewählten Titel, Kennzahlen und Namen. Deshalb vor einer späteren Live-Aktivierung Auswahl und Zielgruppe prüfen.

Datadog-API-Aufrufe laufen maximal 15 Sekunden. HTTP 429 setzt eine gemeinsame Pause anhand `Retry-After` (mindestens 30 Sekunden, höchstens eine Stunde); es gibt keine sofortige Retry-Schleife. Provider-Fehlertexte und Schlüssel werden nicht an Besucher durchgereicht. Der bestehende LiveCache bündelt Abfragen, hält Erfolge 30 Sekunden und liefert bei Fehlern den letzten Erfolg als veraltet. Die Schichtauflösung durchläuft echte Übergänge, höchstens 128 Abfragen pro Schedule; eine Überschreitung wird als Fehler behandelt, statt einen unvollständigen Plan zu bestätigen.

## Demo und Chat

`CSP_DEMO=true` nutzt ausschließlich synthetische Daten; es werden keine Datadog-Zugangsdaten benötigt und keine Provider-Anfragen ausgeführt. Die Browser-Demo funktioniert auch ohne API. Beispiel-Cases und Schichten enthalten keine Links zu erfundenen Datadog-Ressourcen. Beispiele decken Alarme, Wartung, fehlende Daten, erfüllte und verfehlte SLOs sowie offene und geschlossene Tickets ab.

Vier Quellen versorgen den KI-Chat mit Cases, Monitoren, SLOs und Schichten. Daten bleiben unprivilegierte Quellen; Demo und veraltete Daten werden gekennzeichnet. Der statische Demo-Chat liefert eine feste Zusammenfassung mit Quellen, keine echte KI-Auswertung.

## API

Alle Routen sind GET und verwenden `LiveData<T>` (`data`, `updatedAt`, `stale`, optional `error`):

- `/api/v1/datadog/cases?page=0&status=OPEN`: `CasePage` mit `items`, `page` und `hasMore`; Seiten beginnen bei 0, Status optional `OPEN`, `IN_PROGRESS`, `CLOSED`.
- `/api/v1/datadog/monitors`: `DatadogMonitor[]` mit unverfälschtem Monitorstatus.
- `/api/v1/datadog/slos`: `DatadogSlo[]` für 30 Tage; fehlende Kennzahlen werden ausgelassen.
- `/api/v1/datadog/schedule`: Schichten mit Schedule-ID/-Name und eigener Zeitzone.
- `/api/v1/datadog/team`: nur Namen/IDs der ausgewählten Dienstpersonen für den gemeinsamen Header.

Ungültige Ticketfilter ergeben HTTP 400. Es gibt keine schreibenden Routen oder schreibenden Chat-Werkzeuge.

## Acme-Demo und Konto

Acme veröffentlicht eine zusätzliche, vollständig synthetische Demo unter `https://kieksme.github.io/csp-acme/datadog/`. Das bestehende Supportportal bleibt unter `/csp-acme/` erreichbar. Die Datadog-Demo benötigt keinen API-Account und keine Datadog-Schlüssel.

Für die Acme-Einrichtung wurde ein eigenständiger EU1-Testaccount angelegt. Am 15. Oktober 2026 wurden Browser-Login, bestätigte Eigentümeradresse und Admin-Zugriff auf die vom Eigentümer benannte Organisation „kieks.me GbR“ geprüft. Am 16. Oktober 2026 wurde die korrigierte Provider-Version mit serverseitigen Leseschlüsseln gegen diesen Account geprüft: zwei Monitore mit Status OK, ein verfügbares SLO, sieben Schichten und das leere Case-Projekt ließen sich lesen. Auch die Team-Ableitung war erfolgreich. Diese Leseabnahme bestätigt weder Statusfilter an befüllten Projekten noch Alarmzustellung oder einen öffentlichen Live-Betrieb. Der öffentliche Demo-Build bleibt bis zur separat geprüften Live-Aktivierung synthetisch.

## Quellen

- [Cases suchen](https://docs.datadoghq.com/api/latest/case-management/search-cases/)
- [Monitor abrufen](https://docs.datadoghq.com/api/latest/monitors/get-a-monitor/)
- [SLO-History](https://docs.datadoghq.com/api/latest/service-level-objectives/get-an-slos-history/)
- [On-Call-Responder](https://docs.datadoghq.com/api/latest/on-call/get-on-call-responders-for-a-schedule/)

## WebMCP

Browser-Agenten erhalten lesende Tools für Bereitschaft (`datadog_get_on_duty`, `datadog_get_oncall_schedule`), Monitore, SLOs und Cases (`datadog_list_monitors`, `datadog_list_slos`, `datadog_list_cases`). Sie nutzen ausschließlich die oben beschriebenen `/api/v1/datadog/*`-Routen, legen keine Cases an und ändern nichts in Datadog. Veraltete Schichtdaten bestätigen keine Erreichbarkeit. Abschalten mit `public.webmcp: false`. Siehe [WebMCP](webmcp.md).

## APM (`dd-trace`)

Die Fastify-API lädt `dd-trace` vor den übrigen Imports (`import '@kieksme/csp-core/tracing'`) und startet Node mit `--import @kieksme/csp-core/tracing-register` (Docker-`CMD`, `csp start` / `csp dev`, Demo-`start:api`). Der Register-Einstieg lädt `dd-trace/initialize.mjs` über Core, damit pnpm und Kundeninstallationen das Paket finden. So greift die ESM-Instrumentierung. Traces laufen über den **Datadog Agent** zur Site `datadoghq.eu` (Organisation kieks.me GbR). In der Anwendung keine Datadog-API-Keys hinterlegen.

```dotenv
# API runtime only — no secrets. Agent must use site datadoghq.eu.
DD_TRACE_ENABLED=true
DD_AGENT_HOST=datadog-agent
DD_TRACE_AGENT_PORT=8126
DD_SERVICE=csp-api
DD_ENV=production
DD_VERSION=0.16.0
```

| Variable                | Bedeutung                            |
| ----------------------- | ------------------------------------ |
| `DD_TRACE_ENABLED`      | `false` schaltet Tracing aus (No-Op) |
| `DD_AGENT_HOST`         | Agent-Host (Standard `localhost`)    |
| `DD_TRACE_AGENT_PORT`   | Trace-Port (Standard `8126`)         |
| `DD_SERVICE`            | Service-Name (CSP-Default `csp-api`) |
| `DD_ENV` / `DD_VERSION` | Umgebungs- und Versionstag in APM    |

Ohne Agent: Prozess startet weiter; Spans werden verworfen. Ohne Agent lokal/CI: `DD_TRACE_ENABLED=false`. API-Start ohne `--import @kieksme/csp-core/tracing-register` prüfen, falls Traces fehlen. Vollständige Tabelle: [Konfiguration](configuration.md#datadog-apm-dd-trace). Agent-Einrichtung und Intake liegen außerhalb dieses Repos.
