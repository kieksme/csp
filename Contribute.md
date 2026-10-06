# Mitwirken und GitHub Actions einrichten

Für die lokale Entwicklung und Prüfung gelten die Schritte in der [README](README.md). Vor einem PR `pnpm check` und `pnpm test:packages` ausführen; für Browserprüfungen zusätzlich Chromium installieren und `pnpm test:browser` ausführen. Änderungen als Conventional Commits liefern; Release Please erstellt daraus automatisch den Release-PR und Changelog. Weitere Details: [Betrieb und Releases](docs/operations.md).

## Secrets im Produktrepo

Secrets unter **Settings → Secrets and variables → Actions → Secrets → New repository secret** anlegen. Die vorhandenen Workflows benötigen:

Alternativ `NPM_TOKEN` als Organisationssecret unter **kieksme → Settings → Secrets and variables → Actions** hinterlegen und den Repository-Zugriff für `kieksme/csp` freigeben. Auch bei einem Organisationssecret bleibt die Referenz im Workflow `${{ secrets.NPM_TOKEN }}`. `NODE_AUTH_TOKEN` ist lediglich der Name der von npm gelesenen Umgebungsvariable im Publish-Schritt.

| Secret         | Manuell anlegen?                                             | Verwendung                                                                                                                                                            |
| -------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_TOKEN`    | Ja, für npm-Releases.                                        | npm-Token mit Schreibrechten für die zu veröffentlichenden öffentlichen `@kieksme/csp-*`-Pakete. Der Publish-Job reicht den Wert als `NODE_AUTH_TOKEN` an npm weiter. |
| `GITHUB_TOKEN` | Nein. GitHub stellt es pro Workflow-Lauf automatisch bereit. | Release Please erstellt damit den Release-PR, Tag und GitHub-Release. Der Release-Job fordert `contents: write` und `pull-requests: write` an.                        |

Für `NPM_TOKEN` einen npm-Token mit Zugriff auf den Scope `@kieksme` und die betroffenen Pakete verwenden. Für automatisiertes Publishing muss der Token gemäß der npm-Konfiguration des Accounts ohne interaktive 2FA-Abfrage veröffentlichen dürfen. Für die Erstveröffentlichung muss der Token auch neue Pakete im npm-Scope `@kieksme` anlegen dürfen; Zugriff nur auf bereits bestehende Pakete reicht nicht. Der npm-Benutzer des Tokens benötigt entsprechende Rechte in der Organisation `kieksme`. Ablaufdatum und Rotation berücksichtigen und den erneuerten Wert im GitHub-Secret hinterlegen. `NODE_AUTH_TOKEN` ist kein zusätzlich anzulegendes GitHub-Secret.

Unter **Settings → Actions → General → Workflow permissions** muss **Allow GitHub Actions to create and approve pull requests** für den Release-PR erlaubt sein; Organisationsrichtlinien können diese Einstellung einschränken. Die Schreibrechte sind im Release-Job bereits deklariert. `id-token: write` allein ersetzt den verwendeten `NPM_TOKEN` nicht: Der aktuelle Publish-Job übergibt ausdrücklich den Token aus dem Secret.

| Workflow                                                            | Auslöser                         | Benötigte manuell gesetzte Secrets                                                                                |
| ------------------------------------------------------------------- | -------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| [ci.yml](.github/workflows/ci.yml) — Validate product               | Pull Request und Push auf `main` | Keine. Tests und Docker-Healthcheck verwenden Mock-/Demo-Daten.                                                   |
| [release.yml](.github/workflows/release.yml) — Release npm packages | Push auf `main`                  | `NPM_TOKEN`. Release Please erstellt den Release-PR; nach dessen Merge veröffentlicht der Publish-Job die Pakete. |

## Paketnamen und fehlgeschlagene Veröffentlichungen

Alle acht öffentlichen Pakete müssen mit `@kieksme/csp-` beginnen. Der Scope `@kieksme` ordnet sie der npm-Organisation `kieksme` zu; `publishConfig` legt die öffentliche npm-Registry und `access: public` fest. Die Pakete werden bei der ersten erfolgreichen Veröffentlichung automatisch angelegt. `pnpm check:versions` prüft auch diese Vorgaben für neue Pakete.

Ein fehlgeschlagener Publish-Job kann unter **Actions → Release npm packages → Run workflow** mit `publish_tag=v0.2.0` (oder dem betroffenen bestehenden Release-Tag) erneut ausgeführt werden. Den Workflow aus `main` mit der korrigierten Pipeline starten. Er checkt den angegebenen Tag aus und prüft die Pakete vor der Veröffentlichung. Ein leerer Wert startet nur den normalen Release-Please-Ablauf. Ein erneuter Push allein veröffentlicht einen bereits erstellten Release nicht erneut.

`CHANGELOG.md` wird von Release Please erzeugt und von der allgemeinen Formatierungsprüfung ausgenommen. Für ältere Release-Tags normalisiert der Publish-Job die Datei vor der Prüfung, damit deren Formatierung die Veröffentlichung nicht blockiert.

## GitHub Action im Kundenrepo

Der mitgelieferte [deploy.yml](templates/customer/.github/workflows/deploy.yml) benötigt **keine manuell angelegten Secrets**. GitHub Pages verwendet die von GitHub bereitgestellte Workflow-Authentifizierung mit `pages: write` und `id-token: write`. Unter **Settings → Pages** als Quelle `GitHub Actions` wählen und im Environment `github-pages` gegebenenfalls die Deployment-Regeln für `main` konfigurieren.

Die Personalisierung erfolgt über die in der [README](README.md#kundeninstanz-über-github-personalisieren) beschriebenen Repository-**Variablen**. Der Workflow lädt das API-Image als Artefakt `api-image` hoch; er deployt es nicht und benötigt daher keine API-Hosting- oder Container-Registry-Zugangsdaten.

## Provider-Secrets für den API-Betrieb

Diese Schlüssel werden von den vorhandenen GitHub Actions nicht benötigt. Sie sind abhängig von den installierten Plugins und dem gewählten Chat-Provider direkt als Secrets beziehungsweise Runtime-Umgebungsvariablen beim **API-Host** zu hinterlegen:

| Runtime-Secret            | Wann erforderlich?                                      | Zusätzlich benötigte Runtime-Konfiguration                                                     |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CSP_SIGNL4_API_KEY`      | SIGNL4-Plugin außerhalb der Demo.                       | `CSP_SIGNL4_TEAM_ID`; Schlüssel mit Leserechten für Teamprofile, Schichten, Bilder und Alerts. |
| `CSP_CHAT_OPENAI_API_KEY` | Chat mit `CSP_CHAT_PROVIDER=openai` außerhalb der Demo. | `CSP_CHAT_MODEL`.                                                                              |
| `CSP_CHAT_AZURE_API_KEY`  | Chat mit `CSP_CHAT_PROVIDER=azure` außerhalb der Demo.  | `CSP_CHAT_MODEL` als Deployment-Name und `CSP_CHAT_AZURE_ENDPOINT` als Ressourcen-Origin.      |

Ollama und die öffentlichen Uptime-Kuma-Statusendpunkte benötigen in der vorhandenen Implementierung keine API-Schlüssel. Für Ollama Modell und erreichbare URL konfigurieren; für Kuma `CSP_KUMA_URL` und `CSP_KUMA_SLUG` setzen. Vollständige Provider- und Runtime-Optionen stehen unter [Konfiguration](docs/configuration.md) und [Betrieb](docs/operations.md).

Falls später ein API-Deployment-Schritt ergänzt wird, müssen benötigte Zugangsdaten ausdrücklich über `secrets.*` an diesen Schritt beziehungsweise an den API-Host weitergegeben werden. Das bloße Anlegen eines GitHub-Secrets stellt es dem API-Service nicht bereit. Schlüssel weder committen noch in Frontend-Builds, öffentliche Variablen, `VITE_*`-Werte oder das Docker-Image aufnehmen.
