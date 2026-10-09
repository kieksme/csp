# WebMCP für Browser-Agenten

Das Portal stellt seine Funktionen über [WebMCP](https://webmachinelearning.github.io/webmcp/) bereit. Ein KI-Agent im Browser kann damit Dienstplan, Team, Alerts, Systemstatus, Hotline, FAQ und Ticketvorlagen als Tools aufrufen, statt die Oberfläche zu bedienen. Jedes mitgelieferte Plugin bringt seine eigenen Tools mit; Core ergänzt `portal_get_info`.

WebMCP ist ein frühes Browser-Angebot und noch nicht überall verfügbar. Das Portal erkennt `document.modelContext` und `navigator.modelContext` und registriert nur über `registerTool`. Fehlt die Schnittstelle, passiert nichts und die Oberfläche bleibt unverändert. Der Spezifikationsstand kann sich ändern; die Anbindung ist deshalb in einem Modul (`packages/sdk/src/webmcp.ts`) gekapselt.

## Aktivieren und abschalten

WebMCP ist standardmäßig **an**. Abschalten über das Profil oder eine Umgebungsvariable beim Build:

```json
{ "public": { "webmcp": false } }
```

`CSP_WEBMCP=false` überschreibt den Profilwert (zulässig sind `true` und `false`). Danach Frontend neu bauen. Details: [Konfiguration](configuration.md).

## Tools

Alle Tools lesen ausschließlich die bestehenden öffentlichen Routen unter `/api/v1` oder die öffentliche Konfiguration; es gibt keine neue API. Wo ein Plugin nicht installiert ist, fehlen seine Tools.

| Plugin    | Tool                            | Zweck                                                                                 | Schreibend |
| --------- | ------------------------------- | ------------------------------------------------------------------------------------- | ---------- |
| Core      | `portal_get_info`               | Name, Beschreibung, Demo-Modus, installierte Plugins und Tools                        | nein       |
| `signl4`  | `signl4_get_on_duty`            | Wer hat jetzt Dienst, wer ist als Nächstes dran                                       | nein       |
| `signl4`  | `signl4_get_shift_schedule`     | Schichtplan, optional `personId` und `horizonHours` (1–2160, Standard 168)            | nein       |
| `signl4`  | `signl4_list_team`              | Teammitglieder mit Rolle, E-Mail und Telefon, optional `query`                        | nein       |
| `signl4`  | `signl4_get_vcard`              | vCard 3.0 als Text für `id`                                                           | nein       |
| `signl4`  | `signl4_list_alerts`            | Aktuelle Alerts, optional `minSeverity`                                               | nein       |
| `kuma`    | `kuma_get_status`               | Dienste mit Zustand und 24-Stunden-Verfügbarkeit, Störungsmeldung, optional `monitor` | nein       |
| `contact` | `contact_get_hotline`           | Hotline und `tel:`-Link; das Tool wählt nicht selbst                                  | nein       |
| `content` | `content_search_faq`            | FAQ nach `query`, `category`, `limit` (1–50, Standard 10)                             | nein       |
| `content` | `content_list_processes`        | Prozesse mit Links                                                                    | nein       |
| `content` | `content_list_ticket_templates` | Ticketarten mit Link und Textvorlage                                                  | nein       |
| `chat`    | `chat_ask`                      | Fragt den digitalen Assistenten (`messages`, wie in der [API](api.md#chat-anfragen))  | Kontingent |

`chat_ask` ändert keine Daten, verbraucht aber das IP-Limit und das KI-Kontingent der Instanz und ruft den konfigurierten Provider auf. Es ist deshalb nicht als `readOnlyHint` markiert. Alle anderen Tools sind es.

**Tickets:** Das Portal legt keine Tickets an. `content_list_ticket_templates` liefert Link und Vorlage; die Person öffnet das Ticketsystem selbst. Ein Tool zum Anlegen setzt eine eigene API mit Ticketsystem-Anbindung, Anmeldung und Bestätigung voraus und ist nicht Teil dieser Funktion.

## Antworten und Fehlerverhalten

- Ergebnisse sind JSON als Text in `content[0].text`; Fehler setzen `isError: true`.
- Fehler zeigen keine internen Details. Nicht erreichbare Daten melden „nicht verfügbar“.
- Veraltete Live-Daten werden nie als bestätigt ausgegeben. `signl4_get_on_duty` und die übrigen SIGNL4-Lesetools liefern bei veralteten Schicht- und Teamdaten einen Fehler mit dem Hinweis, dass die Erreichbarkeit nicht bestätigt ist; Alerts und Status tragen `stale` und `updatedAt`.
- Textfelder aus Alerts und Chat-Antworten stammen aus externen Quellen. Ergebnisse enthalten dafür ein `notice`; Agenten müssen sie als Daten behandeln, nicht als Anweisungen.
- Argumente werden geprüft und begrenzt. Unbekannte Werte werden ignoriert.

## Eigene Plugin-Tools

Ein Browser-Plugin deklariert optionale `tools`. Namen müssen mit der Plugin-ID beginnen (Bindestriche werden zu Unterstrichen), aus `a-z`, `0-9` und `_` bestehen und höchstens 64 Zeichen lang sein. Core prüft das beim Start; ein ungültiger oder doppelter Name verhindert den Start.

```ts
import { webMcpJson, type WebMcpTool } from '@kieksme/csp-sdk';
import type { LiveData } from '@kieksme/csp-sdk';

const tools: WebMcpTool[] = [
  {
    name: 'my_service_get_label', // Plugin-ID `my-service`
    description: 'Liefert die aktuelle Bezeichnung des Dienstes.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    // ctx.api ruft /api/v1 der eigenen Instanz auf, auch in der statischen Demo.
    execute: async (_args, ctx) =>
      webMcpJson(await ctx.api<LiveData<{ label: string }>>('/my-service')),
  },
];
// export default { id: 'my-service', …, tools } satisfies BrowserPlugin;
```

Tools laufen im Browser mit den Rechten der Seite. Sie dürfen nur öffentliche Portalrouten nutzen, nie Schlüssel enthalten und keine HTML-Inhalte zurückgeben. Links vorher mit `safeUrl` prüfen. Weitere Vertragsdetails: [Plugin-SDK](plugin-sdk.md#webmcp-tools).

## Datenschutz

Die Tools geben Daten aus, die das Portal ohnehin öffentlich zeigt, darunter Namen, E-Mail-Adressen und Telefonnummern des Teams. Sie machen diese Daten aber für jeden Agenten im Browser maschinenlesbar. Instanzen, die das nicht wollen, setzen `public.webmcp: false`. Hinter einer vorgeschalteten Anmeldung (zum Beispiel einem Reverse-Proxy) gelten die Tools nur für angemeldete Sitzungen. Siehe [Sicherheit und Daten](security.md#webmcp).

## Prüfen

- Tests: `tests/webmcp.test.ts` (Registrierung, Abmeldung, Namensregeln, alle Tool-Handler) und ein Browser-Test mit simulierter WebMCP-Schnittstelle in `tests/browser/portal.spec.ts`.
- Manuell: Demo starten (`pnpm dev:api`, `pnpm dev`) und in einem Browser mit aktivierter WebMCP-Vorschau oder einer WebMCP-Inspector-Erweiterung die Tools auflisten und aufrufen.
