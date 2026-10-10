# Teams-Support im Portal

Das optionale Paket `@kieksme/csp-plugin-teams` erweitert den installierten Chat um authentifizierte, gespeicherte Gespräche und menschlichen Support in einem Teams-Standard-Channel. Ohne Aktivierung bleibt der bisherige Chat verfügbar.

## Ablauf

Beim ersten Gespräch entsteht ein Teams-Thread mit Name, optionalem Microsoft-Benutzernamen und Gesprächs-ID. Nutzerfragen und abgeschlossene KI-Antworten erscheinen im Thread. Die KI bleibt im Portal ausdrücklich als digitaler Assistent gekennzeichnet.

Ein Mitglied der konfigurierten Entra-Supportgruppe klickt **Übernehmen**. Nur eine Person kann gleichzeitig übernehmen. Die laufende KI-Ausgabe wird abgebrochen und als unterbrochen gespeichert. Das Portal zeigt den Namen des echten Supports. **Alle neuen Textantworten der zuständigen Person in diesem Thread werden unmittelbar Kundenantworten.** Andere Personen können intern diskutieren. Auch die zuständige Person muss für interne Diskussionen einen anderen Ort verwenden.

**Bot freigeben** übergibt ausdrücklich zurück; die nächste Nutzerfrage startet die KI. **Abschließen** beendet das Gespräch; der Nutzer kann einen neuen Chat starten. Es gibt keinen automatischen Rückwechsel. Anhänge, nachträgliche Bearbeitungen und Löschungen sind in v1 nicht synchronisiert.

## Installation und Entra

1. Teams-Plugin in den Kundenabhängigkeiten und in `plugins` ergänzen. `chat` muss installiert sein; der Core initialisiert Plugin-Abhängigkeiten zuerst.
2. Eine Single-Tenant-Entra-API mit v2-Access-Tokens und delegiertem Scope `Chat.Access` konfigurieren. Die API-Audience ist deren Application-ID (GUID). Der Application-ID-URI ist `api://<API-ID>`.
3. Eine SPA-App für das Portal registrieren, den API-Scope erlauben und die tatsächliche Portal-Origin samt Basispfad als SPA-Redirect-URI freigeben. Die UI nutzt Authorization Code mit PKCE über MSAL. Bestehende App-IDs können verwendet werden; ID-Token und Graph-Token sind keine API-Zugangstoken.
4. Die Single-Tenant-Bot-App in Azure Bot mit Microsoft-Teams-Channel registrieren. Der Messaging-Endpunkt lautet `https://<api-host>/api/messages`. Das Teams SDK validiert eingehende Service-Tokens; der Endpunkt akzeptiert keine anonymen Aktivitäten.
5. Für die Bot-App Microsoft Graph **Application**-Rechte `User.Read.All` und `GroupMember.Read.All` mit Admin-Consent bereitstellen, passend zu `POST /users/{id}/checkMemberGroups`. Die Gruppe wird bei jeder Kundenantwort und Aktion überprüft. Bei Graph-Ausfall wird die Aktion verweigert.
6. Manifest-Vorlage unter `packages/plugin-teams/teams-app/manifest.example.json` ausfüllen, App-Icons ergänzen, ins Organisations-App-Verzeichnis hochladen und im Ziel-Team installieren. Einen Standard-Channel „Portal-Support“ erstellen; tatsächliche Team-/Channel-IDs konfigurieren. Private/geteilte Channels sind nicht Teil dieser Version.

```json
"chatSupport": {
  "mode": "teams",
  "tenantId": "<Tenant-GUID>",
  "clientId": "<SPA-App-GUID>",
  "scope": "api://<API-App-GUID>/Chat.Access"
}
```

Eine Runtime-Vorlage steht in `templates/customer/.env.teams.example`.

Diese öffentlichen Werte werden im Frontend gebaut. Runtime-Werte müssen übereinstimmen; Änderungen erfordern Frontend-Neubau und API-Neustart. Die Gruppen-ID und Geheimnisse gehören ausschließlich in die Runtime.

`ChannelMessage.Read.Group` erlaubt der Teams-App den Empfang von Nachrichten im gesamten installierten Team. Der Handler beschränkt Verarbeitung auf den konfigurierten Tenant, das Team, den Channel und gespeicherte Gesprächsthreads. Channel-Mitgliedschaft allein erlaubt keine Supportaktion.

## Persistenz und Betrieb

PostgreSQL speichert Eigentümer (Tenant-ID und Nutzer-ID), Verlauf, Ereignisse, Übernahmestatus, Teams-Zuordnung und eine transaktionale Outbox. Die Tabellen `csp_conversations` und `csp_teams_outbox` werden beim Start idempotent angelegt; der Runtime-Benutzer benötigt anfangs DDL-Rechte. Für diese Instanz eine eigene Datenbank verwenden. TLS, Backups und deren Aufbewahrung auf Datenbankebene konfigurieren; keine Zugangsdaten im Frontend oder Git.

**Genau ein API-Replikat**, Deployment mit `Recreate`. Ein PostgreSQL-Advisory-Lock verweigert einen zweiten aktiven Runtime-Prozess. Bei Neustart werden unvollständige Bot-Antworten als unterbrochen abgeschlossen; Supportzuständigkeiten bleiben erhalten. Für mehrere Replikas müssen Generierungsjobs, Limits und Worker-Leases zuerst verteilt werden.

Outbox-Nachrichten werden je Gespräch geordnet wiederholt, mit exponentieller Pause bis 300 Sekunden. Nutzeranfragen und eingehende Teams-Aktivitäten werden dedupliziert. Die externe Teams-Zustellung ist **at least once**: Geht nach erfolgreicher Microsoft-Zustellung die Bestätigung verloren, kann ein Thread oder eine Nachricht doppelt erscheinen. Es gibt keine Exactly-once-Zusicherung über zwei Systeme.

Teams-Ausfälle stoppen den KI-Chat nicht. Nach menschlicher Übernahme bleibt der Bot auch bei einem Ausfall pausiert. Betreiber überwachen Outbox-Rückstau (`count(*)`, `max(attempts)`, ältesten `seq`), API-Erreichbarkeit, Datenbank und reale Testzustellung. `/health` bestätigt nur den API-Prozess, keine Teams-/Graph-Verbindung.

Nach standardmäßig 30 Tagen ohne Gesprächsaktivität werden Portal-Daten einschließlich Outbox beim Start und stündlich gelöscht. Teams-Kopien und Datenbank-Backups unterliegen eigener Aufbewahrung. Lesen des Verlaufs verlängert die Frist nicht. Das Portal informiert vor der ersten Nachricht über die Weitergabe an Support. MSAL hält Anmeldeinformationen im Session-Storage; Gesprächsinhalte bleiben serverseitig.

## API

Alle produktiven Gesprächsrouten verlangen `Authorization: Bearer <API-Access-Token>` und prüfen die Eigentümer-ID. Fremde Gesprächs-IDs liefern 404.

| Methode | Pfad                                        | Ergebnis                                                                   |
| ------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| GET     | `/api/v1/conversations`                     | Eigene Gespräche, neueste zuerst, maximal 100                              |
| POST    | `/api/v1/conversations`                     | Neues Gespräch, 201; maximal 10 offene Gespräche                           |
| GET     | `/api/v1/conversations/:id`                 | Verlauf, Status, Support, Ereignisposition                                 |
| POST    | `/api/v1/conversations/:id/messages`        | `{ "id": "<UUID>", "content": "Text" }`, 202; ID bei Retry wiederverwenden |
| GET     | `/api/v1/conversations/:id/events?after=42` | SSE mit `id`, `message`, `status` und bei größerer Lücke `snapshot`        |

Status: `bot`, `support`, `closed`. Nachrichten: `user`, `bot`, `support`, `system`; jeweils ID, Inhalt und `complete`, optional Name, KI-Absender und Quellen. SSE wird nach vier Minuten beendet; der Client erneuert sein Access-Token und verbindet ab der letzten Sequenz erneut. 64 Ereignisse bleiben als Replay-Fenster, der vollständige Verlauf als Snapshot. Pro Nachricht maximal 4000 Zeichen; pro Gespräch höchstens 500 Nachrichten und ungefähr 200000 Zeichen Verlauf. Rate-Limit und KI-Parallelität übernehmen die Chat-Konfiguration. Im Supportmodus ist `/api/v1/chat` mit 409 gesperrt.

## Lokale Demo und Prüfung

Zwei Terminals im Produktrepo:

```sh
pnpm --filter csp-demo dev:support
pnpm --filter csp-demo dev:api:support
```

Die Demo nutzt synthetische Identität, Memory-Storage und sichtbare Aktionen „Lena übernimmt“, „Lena antwortet“, „Bot freigeben“ und „Abschließen“. Keine Microsoft-Anfragen. Sie braucht `CSP_DEMO=true`, `CSP_TEAMS_DEMO=true`, `CSP_TEAMS_ENABLED=false` und das öffentliche Demo-Profil. Nur lokal einsetzen; der Demo-API-Zugang ist bewusst anonym und nicht produktionsgeeignet.

```sh
CSP_TEST_DATABASE_URL=postgresql://... pnpm test -- tests/teams.test.ts
```

Vor Live-Freigabe mit zwei echten Portal-Nutzern und einer Supportperson prüfen: getrennte Verläufe, Thread-Zustellung, Übernahme während Streaming, echte Antwort, Rückgabe, Abschluss, Berechtigungsentzug sowie Wiederaufnahme nach API-Neustart. Demo- und Mock-Tests beweisen keine Microsoft-Konnektivität.

Referenzen: [Teams SDK](https://learn.microsoft.com/en-us/microsoftteams/platform/teams-sdk/welcome), [RSC](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/conversations/channel-messages-with-rsc), [Entra-Tokenvalidierung](https://learn.microsoft.com/en-us/entra/identity-platform/claims-validation), [Graph checkMemberGroups](https://learn.microsoft.com/en-us/graph/api/directoryobject-checkmembergroups?view=graph-rest-1.0).

## Vorhandene Portal-Anmeldung verwenden

Für ein bereits durch OAuth2-Proxy geschütztes Portal `chatSupport.auth: "session"` setzen. Der Browser lädt `/api/v1/conversations/identity` über seine gleiche Origin und zeigt den durch die API bestätigten Namen; Access-Tokens gelangen weder ins Frontend noch in dessen Speicher. Bei abgelaufener Sitzung erneuert „Portal-Anmeldung erneuern“ durch Neuladen den vorhandenen Login. Ohne diese Einstellung bleibt MSAL der Standard.

Der Login-Proxy muss den delegierten API-Scope `api://<API-App-GUID>/Chat.Access` anfordern und das Access-Token an den internen Web-Gateway geben. Dieser darf ausschließlich das vom Proxy gesetzte Token an Conversation-Routen weiterreichen, muss vom Client gesetzte Authentifizierungsheader verwerfen und Cookie-Schreibzugriffe über exakte Origin-/CSRF-Prüfung schützen. OAuth2-Proxy verwendet dafür `pass_access_token`; `pass_authorization_header` würde ein ID-Token liefern und ersetzt das delegierte API-Token nicht. API und Gateway bleiben intern. [OAuth2-Proxy Header-Konfiguration](https://oauth2-proxy.github.io/oauth2-proxy/configuration/overview/#header-options).

Die API prüft auch in diesem Modus Signatur, Tenant, Audience, Ablauf und `Chat.Access`. `/identity` gibt ausschließlich den Anzeigenamen zurück und setzt `Cache-Control: no-store, private`. Benutzer-IDs, Mailadressen, Token und Sitzungsdaten werden darüber nicht veröffentlicht. Dieser Modus aktiviert weder Teams noch eine Datenbank allein.
