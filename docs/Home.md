# Customer Service Portal

Das Customer Service Portal bündelt Notfallkontakt, Operations-Team, Schichtplan, aktuelle Meldungen, Systemstatus, Hilfe und Chat in einer konfigurierbaren React-PWA. Eine gemeinsame Produktbasis versorgt eigenständige Kundenrepos über versionierte npm-Pakete. Frontend und Fastify-API werden pro Kunde getrennt betrieben.

## Einstieg nach Aufgabe

| Aufgabe                                             | Dokumentation                                           |
| --------------------------------------------------- | ------------------------------------------------------- |
| Infrastruktur und Instanzstand                      | [Infrastrukturübersicht](infrastructure.md)             |
| Acme und NetCom BW betreiben                        | [Coolify-Infrastruktur](infrastructure-coolify.md)      |
| Thinkport-Hosting und Teams verstehen               | [Thinkport-Infrastruktur](infrastructure-thinkport.md)  |
| Releases, Monitoring und Restore planen             | [Lieferkette und Betrieb](infrastructure-operations.md) |
| Projekt verstehen                                   | [Architektur und Repository](architecture.md)           |
| Produkt lokal starten oder Kundeninstanz erstellen  | [Installation](installation.md)                         |
| Branding, Provider und Runtime einrichten           | [Konfiguration](configuration.md)                       |
| Kundenportal auf GitHub Pages veröffentlichen       | [Deployment](deployment.md)                             |
| Plugins auswählen und verwalten                     | [Plugins und CLI](plugins.md)                           |
| Eigenes Plugin entwickeln                           | [Plugin-SDK](plugin-sdk.md)                             |
| Prozesse, Ticketvorlagen und FAQ pflegen            | [Inhalte](content.md)                                   |
| API integrieren und Chat-Streaming verstehen        | [API-Referenz](api.md)                                  |
| Instanz betreiben und Pakete veröffentlichen        | [Betrieb und Releases](operations.md)                   |
| Änderungen entwickeln und prüfen                    | [Entwicklung und Tests](development.md)                 |
| Datenflüsse und öffentliche Informationen verstehen | [Sicherheit und Daten](security.md)                     |
| Portal für Browser-Agenten über WebMCP öffnen       | [WebMCP](webmcp.md)                                     |
| Störungen eingrenzen                                | [Fehlerbehebung](troubleshooting.md)                    |
| Dokumentation pflegen und ins Wiki spiegeln         | [Dokumentation und Wiki](wiki.md)                       |

## Produktgrenzen

Die Standard-Module sind öffentlich. Das optionale [Teams-Support-Plugin](teams-support.md) schützt gespeicherte Chat-Gespräche über Entra-Anmeldung. Teamkontakte und Alert-Beschreibungen sind öffentlich lesbar. Provider-Schlüssel verbleiben im API-Service. Der Chat beantwortet Fragen anhand der Inhalte und Live-Quellen seiner Instanz; er legt keine Tickets an und verändert keine Alerts oder Schichten. Per WebMCP lesen Browser-Agenten dieselben öffentlichen Daten (standardmäßig an, abschaltbar); auch dabei werden keine Tickets angelegt.

`apps/demo` verwendet synthetische Daten. `apps/northstar` zeigt eine zweite Marke mit weniger Plugins. Die Kunden-Vorlage startet außerhalb des Demo-Modus und muss für ihre installierten Provider konfiguriert werden.

Die Dokumentation wird im Produktrepo unter `docs/` gepflegt. Das Wiki zeigt die Dokumentation des zuletzt gespiegelten Release-Tags; Änderungen auf `main` erscheinen dort erst bei der nächsten Veröffentlichung. Details zum Abgleich stehen unter [Dokumentation und Wiki](wiki.md).

Quellcode: [kieksme/csp](https://github.com/kieksme/csp). Lizenz: [MIT](https://github.com/kieksme/csp/blob/main/LICENSE).
