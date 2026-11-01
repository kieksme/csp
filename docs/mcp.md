# MCP für externe Agents

Der CSP-API-Host bietet optional `/mcp` über das offizielle TypeScript-SDK mit zustandslosem Streamable HTTP an. Für Codex, VS Code und andere Clients: [Nutzeranleitung](mcp-client.md).

## Aktivierung

`CSP_MCP_ENABLED=true` ausschließlich am API-Host setzen und ihn neu starten. Ohne diese Option ist der Pfad 404. Optional `CSP_MCP_TOKEN` als separates Runtime-Secret mit mindestens 32 Zeichen setzen. Clients senden `Authorization: Bearer <token>`. Ohne Token sind nur die ohnehin öffentlichen Portal-Daten zugänglich. Produktiv HTTPS verwenden. Ein statischer Token bietet keine benutzerbezogene Autorisierung und keinen MCP-OAuth-Login.

`POST /mcp` verarbeitet Initialisierung, Benachrichtigungen und Tool-Aufrufe. Clients müssen JSON und SSE im Accept-Header erlauben. GET und DELETE liefern 405; persistente MCP-Sessions gibt es nicht. Ungültige Tokens liefern 401. Ein vorhandener Origin-Header muss in `CSP_ALLOWED_ORIGINS` stehen, sonst 403. Server-Clients ohne Origin sind zugelassen. Der Body ist auf 65536 Bytes begrenzt, Antworten werden nicht gecacht.

## Werkzeuge

Nur installierte Server-Plugins steuern Werkzeuge bei. Alle sind lesend und liefern JSON im Textinhalt. Bis auf `datadog_get_cases` erwarten sie ein leeres Argumentobjekt.

| Plugin  | Werkzeuge                                                                                                   |
| ------- | ----------------------------------------------------------------------------------------------------------- |
| Core    | `portal_get_info`                                                                                           |
| contact | `contact_get_hotline`                                                                                       |
| content | `content_get_faq`, `content_get_processes`, `content_get_tickets`                                           |
| signl4  | `signl4_get_team`, `signl4_get_schedule`, `signl4_get_alerts`                                               |
| kuma    | `kuma_get_status`                                                                                           |
| datadog | `datadog_get_monitors`, `datadog_get_slos`, `datadog_get_schedule`, `datadog_get_team`, `datadog_get_cases` |

`datadog_get_cases` akzeptiert optional `page` (Ganzzahl 0–1000, Standard 0) und `status` (`OPEN`, `IN_PROGRESS`, `CLOSED`). Live-Werkzeuge verwenden dieselben Provider und Caches wie die API-Routen; `stale`, `updatedAt` und `error` bleiben erhalten. Ein erfolgreicher Aufruf garantiert keine frischen Daten. Ticketvorlagen erzeugen keine Tickets. Private Support-Gespräche, Webhooks, KI-Generierung, Audio und Änderungen an Alerts, Schichten oder Cases sind nicht Teil dieser Schnittstelle. Neue kundenspezifische Plugins erhalten nicht automatisch Tools.

## Kundeninstanzen

Demo, Northstar und die Kunden-Vorlage verwenden den gemeinsamen Core. Die bestehenden Kundenrepos erhalten bis zu einem veröffentlichten MCP-Core versionierte Backports: Acme 0.15.1, Thinkport 0.8.0 und NetCom BW 0.7.0. Das offizielle MCP-SDK ist dort eine explizite Produktionsabhängigkeit; die Lockfiles enthalten Patch-Hashes. API-Images müssen `patches/` vor `pnpm install --prod --frozen-lockfile` kopieren.

Acmes Support- und Datadog-API sind getrennte Prozesse. Beide benötigen MCP-Runtime-Konfiguration. Der Datadog-Reverse-Proxy muss `/datadog-api/mcp` mit Strip-Prefix als `/mcp` beim richtigen Container zustellen. Thinkports API liegt intern hinter dem Entra-geschützten Web-Gateway. Ein interner MCP-Endpunkt ist noch kein öffentlicher Agent-Zugang.

Backports werden aus `packages/core/src/mcp.ts` erzeugt. Mit den drei Kundenrepos neben dem CSP-Repo:

```sh
node scripts/sync-mcp-backports.mjs
node scripts/sync-mcp-backports.mjs --check
```

Zuvor die Kunden-Lockfiles installieren, danach die Lockfiles erneuern und in jeder Instanz `pnpm test:mcp` und `pnpm check` ausführen. Nach Adoption eines veröffentlichten MCP-Core Patches und Zuordnung entfernen.
