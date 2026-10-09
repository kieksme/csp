# Plugins und CLI

## Mitgelieferte Plugins

| Paket                         | ID        | Funktionen                                                 | Produktionskonfiguration                    |
| ----------------------------- | --------- | ---------------------------------------------------------- | ------------------------------------------- |
| `@kieksme/csp-plugin-contact` | `contact` | Notfall-Hotline und Kontakt-Wissensquelle                  | `CSP_CONTACT_PHONE`                         |
| `@kieksme/csp-plugin-signl4`  | `signl4`  | Teamprofile, Bilder, vCards, Schichten und Alerts          | API-Key und Team-ID                         |
| `@kieksme/csp-plugin-kuma`    | `kuma`    | Monitorstatus und Vorfall der veröffentlichten Statusseite | URL und Statusseiten-Slug                   |
| `@kieksme/csp-plugin-content` | `content` | Prozesse, Ticketlinks/-vorlagen, FAQ und Chat-Quellen      | `CSP_CONTENT_PATH`                          |
| `@kieksme/csp-plugin-chat`    | `chat`    | Gestreamte Antworten aus statischen und Live-Quellen       | Provider, Modell und gegebenenfalls API-Key |

Jedes Plugin stellt zusätzlich WebMCP-Tools für Browser-Agenten bereit: `signl4_*` (Dienst, Schichtplan, Team, vCard, Alerts), `kuma_get_status`, `contact_get_hotline`, `content_*` (FAQ, Prozesse, Ticketvorlagen) und `chat_ask`. Die Liste mit Parametern steht unter [WebMCP](webmcp.md). Mit dem Hinzufügen oder Entfernen eines Plugins ändern sich die Tools automatisch; `public.webmcp: false` schaltet sie ab.

`apps/demo` registriert alle fünf Plugins. `apps/northstar` und `templates/customer` registrieren Kontakt, Inhalte und Chat. Die mitgelieferten Plugins haben keine verpflichtenden Plugin-Abhängigkeiten; der Chat verwendet die Wissensquellen der tatsächlich installierten Plugins.

## CLI verwenden

Im eigenständigen Kundenrepo:

```sh
pnpm dlx @kieksme/csp-cli plugin list
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-signl4
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-kuma
pnpm dlx @kieksme/csp-cli plugin remove @kieksme/csp-plugin-kuma
```

`add` akzeptiert auch eine Paketversion, beispielsweise `@kieksme/csp-plugin-kuma@<version>`; `<version>` durch die verwendete Release-Version ersetzen. Für `remove` den Paketnamen ohne Versionsangabe verwenden. Alle Pakete der Produktfamilie sollten auf demselben Release-Stand bleiben.

Die CLI führt `pnpm add --save-exact` beziehungsweise `pnpm remove` aus, überprüft Plugin-Metadaten und erzeugt `portal.plugins.json`, `portal.browser.ts` und `portal.server.ts`. Paketdatei, Lockfile und Registrierungen bleiben synchron. Fehlgeschlagene Änderungen stellen gesicherte Dateien wieder her und versuchen, den vorherigen Dependency-Baum zu installieren.

Vor dem Hinzufügen muss das Paket `cspPlugin`-Metadaten und Browser-/Server-Exporte bereitstellen. IDs, SDK-Kompatibilität und `requires` werden geprüft. Entfernen wird abgelehnt, wenn ein verbleibendes Plugin von der entfernten ID abhängt.

## Nach einer Plugin-Änderung

Provider-Variablen am API-Host ergänzen oder entfernen, Frontend und API neu bauen und deployen. Ein bloßes Installieren des Pakets aktiviert weder seine Oberfläche noch seine Routen; die Registrierung muss mit aktualisiert werden. Generierte TypeScript-Registrierungen deshalb über die CLI pflegen.

Plugin-Mutationen sind in einem übergeordneten pnpm-Workspace nicht erlaubt. Eine `pnpm-workspace.yaml` mit reinen pnpm-Einstellungen ist in einem eigenständigen Kundenrepo zulässig; eine eigene Workspace-Paketliste wird abgelehnt.

Weiter: [Plugin-SDK](plugin-sdk.md), [Konfiguration](configuration.md), [API](api.md).
