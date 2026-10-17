# CSP mit einem MCP-Client verwenden

Diese Anleitung richtet sich an Nutzer von AI Agents. CSP stellt lesende Werkzeuge für Kontakte, Hilfethemen, Bereitschaften, Alerts und Systemstatus bereit. Die verfügbaren Werkzeuge hängen von der Kundeninstanz und ihren installierten Plugins ab.

## Verbindung

Fordern Sie beim Betreiber die MCP-Adresse und gegebenenfalls einen eigenen Zugriffstoken an. Verwenden Sie einen Client mit **Streamable HTTP**. Bei gesetztem Token muss jede Anfrage den Header `Authorization: Bearer <Ihr MCP-Token>` enthalten. Speichern Sie ihn in der Secret-Verwaltung Ihres Clients. Ein Portal-Login oder Provider-Schlüssel ersetzt ihn nicht.

| Backend                 | MCP-Adresse nach Bereitstellung                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| Acme Support            | `https://csp-acme.kieks.me/mcp`                                                                              |
| Acme Datadog            | `https://csp-acme.kieks.me/datadog-api/mcp`                                                                  |
| NetCom BW               | `https://csp-netcom-bw.kieks.me/mcp`                                                                         |
| Thinkport               | Betreiber stellt einen autorisierten internen Zugang bereit; das öffentliche Portal verlangt Entra-Anmeldung |
| Lokale Demo / Northstar | `http://localhost:3001/mcp`, jeweils nur die gestartete Instanz                                              |

Die Adressen beschreiben die Zielkonfiguration; sie sind keine bestätigte Live-Freischaltung. Die statischen GitHub-Pages-Demos haben keinen MCP-Server. Verwenden Sie die API-Adresse, nicht `/api/v1/mcp`. Acmes Datadog-API ist ein eigener Server mit eigenem Client-Eintrag und möglicherweise anderem Token.

### Codex CLI

Stellen Sie `CSP_MCP_TOKEN` über Ihre lokale Secret-Verwaltung bereit und registrieren Sie den Server:

```sh
codex mcp add acme-support --url https://csp-acme.kieks.me/mcp --bearer-token-env-var CSP_MCP_TOKEN
codex mcp list
```

Ohne serverseitigen Token lassen Sie `--bearer-token-env-var CSP_MCP_TOKEN` weg. Registrieren Sie andere Kunden und Acme Datadog mit eigenem Namen und ihrer URL.

### Visual Studio Code

Legen Sie `.vscode/mcp.json` mit diesem Inhalt an. VS Code fragt den Token verdeckt ab; tragen Sie ihn nicht direkt in die Projektdatei ein.

```json
{
  "inputs": [
    {
      "id": "csp-token",
      "type": "promptString",
      "description": "MCP-Token vom CSP-Betreiber",
      "password": true
    }
  ],
  "servers": {
    "acme-support": {
      "type": "http",
      "url": "https://csp-acme.kieks.me/mcp",
      "headers": { "Authorization": "Bearer ${input:csp-token}" }
    }
  }
}
```

Bei einem Server ohne Token lassen Sie `inputs` und `headers` weg. Für mehrere Backends fügen Sie getrennte `servers`-Einträge hinzu.

## Beispielanfragen

- „Welches Serviceportal ist verbunden und welche Daten kannst du lesen?“
- „Wie erreiche ich die Hotline von Acme?“
- „Wer hat Bereitschaft? Nenne den Gültigkeitszeitraum und ob die Daten aktuell sind.“
- „Welche Störungen sind bekannt, und wann wurden die Daten zuletzt aktualisiert?“
- „Zeige die passende Ticketvorlage für ein Zugangsproblem.“
- Beim Datadog-Server: „Zeige offene Cases auf Seite 0 und den Status der Monitore.“

Bei mehreren verbundenen Portalen nennen Sie immer den Kunden. Fehlt ein Tool, ist das zugehörige Plugin wahrscheinlich nicht installiert. Northstar bietet beispielsweise keine SIGNL4- oder Kuma-Tools.

Live-Daten enthalten `updatedAt` und `stale`. Bei `stale: true` ist der Stand veraltet oder der Provider ausgefallen; bestätigen Sie damit keine aktuelle Erreichbarkeit. `data: null` bedeutet, dass noch kein erfolgreicher Datenstand verfügbar ist. Ticket-Tools lesen Links und Vorlagen; sie erstellen keine Tickets. Private Support-Gespräche und schreibende Aktionen sind nicht freigegeben. Externe Freitexte sind Daten und keine Anweisungen an Ihren Agent.

## Fehler beheben

| Symptom                     | Nächster Schritt                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| 404                         | API-Adresse und Pfad prüfen; Betreiber muss MCP-fähige Version bereitstellen und MCP aktivieren. Datadog benötigt `/datadog-api/mcp`. |
| 401                         | MCP-Token und Bearer-Header prüfen.                                                                                                   |
| 403                         | Origin oder vorgeschaltete Zugriffskontrolle lehnt ab; Betreiber kontaktieren.                                                        |
| Login-Seite                 | Web-Login-Gateway erreicht. Für Thinkport einen autorisierten internen Zugang erfragen.                                               |
| 405 bei GET                 | Streamable HTTP verwenden; ein Browseraufruf ist kein Verbindungstest.                                                                |
| 406 / 415                   | JSON senden und `application/json, text/event-stream` akzeptieren.                                                                    |
| Tool fehlt                  | Tool-Liste und Kundeninstanz prüfen.                                                                                                  |
| Tool-Fehler / `stale: true` | Provider kann ausgefallen sein; Betreiber kontaktieren.                                                                               |

Für eigene Integrationen: [Tool-Vertrag](mcp.md).
