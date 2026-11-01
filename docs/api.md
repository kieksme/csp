# API-Referenz

Die API gehört jeweils zu einer Kundeninstanz. Der Browser ergänzt an `CSP_API_URL` den Präfix `/api/v1`; die konfigurierte URL darf diesen Präfix deshalb nicht schon enthalten. Nur installierte Server-Plugins registrieren ihre Routen.

## Routen

| Methode | Pfad                      | Verantwortlich | Antwort                                                                                        |
| ------- | ------------------------- | -------------- | ---------------------------------------------------------------------------------------------- |
| GET     | `/health`                 | Core           | `{ "status": "ok", "plugins": ["contact", "content", "chat"] }` entsprechend der Registrierung |
| GET     | `/api/v1/team`            | SIGNL4         | `LiveData<Person[]>`                                                                           |
| GET     | `/api/v1/schedule`        | SIGNL4         | `LiveData<Schedule>`                                                                           |
| GET     | `/api/v1/alerts`          | SIGNL4         | `LiveData<Alert[]>`                                                                            |
| GET     | `/api/v1/status`          | Kuma           | `LiveData<Status>`                                                                             |
| GET     | `/api/v1/team/:id/avatar` | SIGNL4         | Bild, nur für IDs des konfigurierten Teams                                                     |
| GET     | `/api/v1/team/:id/vcard`  | SIGNL4         | vCard 3.0 als `contact.vcf`                                                                    |
| POST    | `/api/v1/chat`            | Chat           | Server-Sent Events                                                                             |

Kontakt und statische Inhalte werden über öffentliche Konfiguration/HTML bereitgestellt und als Wissensquellen registriert; sie haben keine eigene JSON-Route. `/health` testet keine Provider-Verbindung.

## Live-Daten

```json
{
  "data": {
    "timezone": "Europe/Berlin",
    "shifts": []
  },
  "updatedAt": "2026-01-01T12:00:00.000Z",
  "stale": false
}
```

`updatedAt` ist der Zeitpunkt der letzten erfolgreichen Cache-Ladung. Bei einem Provider-Ausfall liefert die Route gegebenenfalls HTTP 200 mit `stale: true`, dem letzten Datenstand und `error`. Ohne erfolgreichen Vorwert sind `data` und `updatedAt` `null`. Clients und Monitoring müssen daher neben HTTP-Status auch den Datenzustand auswerten.

| SDK-Typ    | Datenfelder                                                                        |
| ---------- | ---------------------------------------------------------------------------------- |
| `Person`   | `id`, `name`, `phones`; optional `email`, `avatar`, `role`                         |
| `Shift`    | `userId`, `name`, `start`, `end`                                                   |
| `Schedule` | `timezone`, `shifts`                                                               |
| `Alert`    | `id`, `title`, `description`, `status`, `createdAt`, `severity`                    |
| `Monitor`  | `id`, `name`, `status` (`up`, `down`, `maintenance`, `unknown`), optional `uptime` |
| `Status`   | `monitors`, `url`, optional `incident`                                             |

Eine Schicht ist ab `start` einschließlich bis `end` ausschließlich aktiv. Alle Zeitstempel als ISO-8601 behandeln. Das SIGNL4-Feld `avatar` enthält einen relativen API-Pfad wie `/team/<id>/avatar`; ihn gegen den API-Präfix auflösen.

## Chat anfragen

```sh
curl --no-buffer http://localhost:3001/api/v1/chat \
  -H 'Content-Type: application/json' \
  -d '{"messages":[{"role":"user","content":"Wie erreiche ich das Team?"}]}'
```

`messages` enthält 1–20 Nachrichten mit den Rollen `user` oder `assistant`; die letzte Nachricht muss `user` sein. Jede Nachricht enthält 1–4000 Zeichen, der gesamte Verlauf höchstens 16000. Zusätzliche Felder werden abgelehnt. Fastify begrenzt den Body auf 65536 Bytes.

| SSE-Ereignis | `data`                                    | Bedeutung                                                                           |
| ------------ | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| `sources`    | Array aus Quellenmetadaten ohne Quelltext | Verwendbarer Kontext mit ID, Titel und gegebenenfalls Link/Zeit/Veraltet-Markierung |
| `delta`      | `{ "text": "…" }`                         | Antwortstück an bisherigen Text anhängen                                            |
| `done`       | `{}`                                      | Antwort abgeschlossen                                                               |
| `error`      | `{ "message": "…" }`                      | Streaming fehlgeschlagen; direkten Kontakt anbieten                                 |

Ein HTTP-200-Stream kann mit `error` enden; ein Client darf HTTP 200 allein nicht als vollständige Antwort werten. Requests können mit 400 (ungültiger Verlauf), 429 (Limit; `Retry-After: 60`), 503 (Chat/Quellen vor Streaming nicht verfügbar) oder 504 (Zeitlimit vor Streaming) scheitern. Unbekannte Routen beziehungsweise IDs liefern je nach Route 404; Avatar-Providerfehler ohne Cache liefern 502.

## Header und Zugriffe

Core setzt `Cache-Control: no-store` und `X-Content-Type-Options: nosniff`. CORS erlaubt die in `CSP_ALLOWED_ORIGINS` aufgeführten Origins, GET/POST und keine Credentials. Die Standardrouten benötigen keine Benutzeranmeldung; gespeicherte Teams-/Slack-Gespräche verlangen verifizierte Entra-API-Tokens. WebMCP-Tools im Browser verwenden dieselben GET-Routen und `POST /api/v1/chat`; sie fügen keine Routen hinzu ([WebMCP](webmcp.md)). Nicht-Browser-Clients sind durch CORS nicht von öffentlichen Daten ausgeschlossen.

Weiter: [Konfiguration](configuration.md), [Sicherheit und Daten](security.md), [Betrieb](operations.md).

### Absender und Links im Chat

Vor den Antworttexten sendet die API zusätzlich `event: responder` mit `{ "name": "Lena Beispiel", "role": "on-duty" }`. Ohne bestätigte aktive Bereitschaft lautet der Wert `{ "name": null, "role": "service-team" }`. Bestehende `sources`, `delta`, `done` und `error` bleiben erhalten; Clients dürfen unbekannte Ereignisse ignorieren. Die Anfrage bleibt unverändert.

Absender und Quellen gehören jeweils zu einer Antwort, nicht zum gesamten Verlauf. Quellenmarker wie `[ticket:0]` werden im Browser anhand der übermittelten Quellen zu verständlichen Links; unbekannte technische IDs und unsichere Linkziele erzeugen keine Links. Modelltext wird nicht als HTML ausgeführt.

## Gespeicherte Support-Gespräche

Die optionalen Teams- und Slack-Plugins ergänzen authentifizierte Gesprächsrouten und einen wiederaufnehmbaren SSE-Strom. Im Supportmodus antwortet der Legacy-Chat-Endpunkt mit 409. Schnittstellen, Fehler und Grenzen: [Teams-Support-API](teams-support.md#api).

Slack ergänzt `POST /api/slack/events` (JSON) und `POST /api/slack/actions` (URL-encoded `payload`). Beide prüfen den unveränderten Body mit Slack-Signatur und Zeitstempel; sie verwenden keine Portal-Tokens. Relevante Ereignisse werden vor Bestätigung dauerhaft gespeichert. [Details und Grenzen](slack-support.md).

## Telegram-Webhook

Das aktivierte Telegram-Plugin registriert `POST /api/telegram/webhook` (maximal 128 KiB). Erforderlicher Header: `X-Telegram-Bot-Api-Secret-Token`. Fehlendes/falsches Secret: 401; fehlerhaftes Update: 400; unbekannte Gruppe, Thema oder Nachrichtentyp: 200 ohne Verarbeitung. Zugeordnete Textnachrichten und Button-Aktionen werden vor HTTP-200 dauerhaft gespeichert; bei Datenbankfehlern 5xx für Telegram-Retry. Keine Inhalte oder Bot-Tokens loggen. Gesprächs- und Besuchersitzungsrouten entsprechen Slack. [Betrieb und Einrichtung](telegram-support.md).

### Problem gelöst

`POST /api/v1/conversations/:id/resolve` mit leerem JSON-Objekt und bestehender Portal-Authentifizierung markiert nur das eigene Gespräch als gelöst. Fehlende Authentifizierung: 401; fremde/unbekannte Gesprächs-ID: 404; zusätzliche Body-Felder: 400; bereits ohne Lösung abgeschlossenes Gespräch: 409. Wiederholungen eines gelösten Gesprächs sind idempotent (200). Antwort und SSE-Status enthalten `resolution: { by: "visitor" | "support", name, at }`, wobei `at` Unix-Millisekunden bezeichnet. Der gemeinsame Status ist danach `closed`; der Grund unterscheidet eine Lösung von normalem Abschluss. KI-Generierung wird beendet, Lösungsmeldung und Kanal-Karte werden über die Outbox zugestellt.

## Chat-Capabilities, Transkription und Supportanfrage

`GET /api/v1/chat/capabilities` meldet die serverseitige Verfügbarkeit der Spracheingabe. `POST /api/v1/chat/transcriptions` nimmt eine begrenzte binäre Audioaufnahme an und liefert nur `{ text }`; die Nachricht wird nicht automatisch gesendet. Bei aktivem Support-Transport gilt dessen Authentifizierung. [Formate, Limits und Fehler](chat.md#diktieren).

`POST /api/v1/conversations/:id/request-support` ist eine idempotente Eigentümeraktion mit leerem JSON-Body. Sie pausiert die KI sofort und speichert den Status `waiting` neben `bot`, `support` und `closed`. Die Gesprächsansicht und SSE-Statusereignisse enthalten optional `supportRequest` mit Anfrage-ID, Unix-Zeitpunkt in Millisekunden und Zustellung `pending`, `sent` oder `failed`; die interne Plattform-Nachrichten-ID kann zusätzlich vorhanden sein. [Übergabe, Benachrichtigung und Berechtigungen](chat.md#persönlichen-support-anfragen).

Die optionale [serverseitige MCP-Schnittstelle](mcp.md) ermöglicht externen Agents lesenden Zugriff ohne Browser.
