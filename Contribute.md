# Mitwirken und GitHub Actions einrichten

Für die lokale Entwicklung und Prüfung gelten die Schritte in der [README](README.md). Vor einem PR `pnpm check` und `pnpm test:packages` ausführen; für Browserprüfungen zusätzlich Chromium installieren und `pnpm test:browser` ausführen. Änderungen als Conventional Commits liefern; Release Please erstellt daraus automatisch den Release-PR und Changelog. Weitere Details: [Betrieb und Releases](Docs/operations.md).

## Dokumentation bei Feature-Änderungen

Jede Ergänzung, Änderung oder Entfernung eines Features muss im selben PR die betroffene Dokumentation aktualisieren. Die Dokumentationsänderung ist Teil der Fertigstellung und muss vor dem Merge vorhanden sein; sie darf nicht auf einen späteren PR verschoben werden.

Für neue oder geänderte Konfigurationsoptionen in `Docs/configuration.md` Name, Zweck, Pflichtstatus, Standardwert, zulässige Werte und Grenzen sowie Build-/Runtime-Zuordnung dokumentieren. Beispiele, Env-Vorlagen und das Editor-Schema bei Änderungen ihres Vertrags ebenfalls aktualisieren. Bei Änderungen an Verhalten, Plugins, CLI, API oder Deployment die jeweiligen Seiten unter `Docs/` und betroffene README-Dateien anpassen; entfernte Funktionen auch aus Beispielen entfernen.

`Docs/` ist die Quelle für das GitHub-Wiki. Verwaltete Wiki-Seiten nicht direkt bearbeiten; sie werden aus dem Release-Tag veröffentlicht. Im PR die geänderten Dokumentationsdateien nennen und die Dokumentationsprüfung bestätigen. `pnpm test:docs` sowie die Formatierungsprüfung müssen erfolgreich sein. Die Linkprüfung ersetzt nicht den inhaltlichen Abgleich mit dem implementierten Verhalten.

## Secrets im Produktrepo

Secrets unter **Settings → Secrets and variables → Actions → Secrets → New repository secret** anlegen. `NPM_AUTH_TOKEN` muss ein Actions-Secret sein; eine Repository-Variable unter **Variables** oder ein Environment ohne diesen Secret-Wert wird von `${{ secrets.NPM_AUTH_TOKEN }}` nicht gelesen. Die vorhandenen Workflows benötigen:

Alternativ `NPM_AUTH_TOKEN` als Organisationssecret unter **kieksme → Settings → Secrets and variables → Actions** hinterlegen und den Repository-Zugriff für `kieksme/csp` freigeben. Auch bei einem Organisationssecret bleibt die Referenz im Workflow `${{ secrets.NPM_AUTH_TOKEN }}`. `NODE_AUTH_TOKEN` ist lediglich der Name der von npm gelesenen Umgebungsvariable im Publish-Schritt.

| Secret           | Manuell anlegen?                                             | Verwendung                                                                                                                                                                                                                                                                                                                                    |
| ---------------- | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `NPM_AUTH_TOKEN` | Ja, für npm-Releases.                                        | npm-Token mit Schreibrechten für die zu veröffentlichenden öffentlichen `@kieksme/csp-*`-Pakete. Der Publish-Job reicht den Wert als `NODE_AUTH_TOKEN` an npm weiter.                                                                                                                                                                         |
| `GITHUB_TOKEN`   | Nein. GitHub stellt es pro Workflow-Lauf automatisch bereit. | Release Please erstellt damit den Release-PR, Tag und GitHub-Release. Es veröffentlicht außerdem bei GitHub Packages; dafür fordert der Publish-Job `packages: write` an. Der Release-Job fordert `contents: write` und `pull-requests: write` an. Der Wiki-Job verwendet denselben automatisch bereitgestellten Token mit `contents: write`. |

Für `NPM_AUTH_TOKEN` einen npm-Token mit Zugriff auf den Scope `@kieksme` und die betroffenen Pakete verwenden. Für automatisiertes Publishing muss der Token gemäß der npm-Konfiguration des Accounts ohne interaktive 2FA-Abfrage veröffentlichen dürfen. Für die Erstveröffentlichung muss der Token auch neue Pakete im npm-Scope `@kieksme` anlegen dürfen; Zugriff nur auf bereits bestehende Pakete reicht nicht. Der npm-Benutzer des Tokens benötigt entsprechende Rechte in der Organisation `kieksme`. Ablaufdatum und Rotation berücksichtigen und den erneuerten Wert im GitHub-Secret hinterlegen. `NODE_AUTH_TOKEN` ist kein zusätzlich anzulegendes GitHub-Secret.

Unter **Settings → Actions → General → Workflow permissions** muss **Allow GitHub Actions to create and approve pull requests** für den Release-PR erlaubt sein; Organisationsrichtlinien können diese Einstellung einschränken. Die Schreibrechte sind im Release-Job bereits deklariert. `id-token: write` allein ersetzt den verwendeten `NPM_AUTH_TOKEN` nicht: Der aktuelle Publish-Job übergibt ausdrücklich den Token aus dem Secret.

| Workflow                                                        | Auslöser                         | Benötigte manuell gesetzte Secrets                                                                                                                                                 |
| --------------------------------------------------------------- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ci.yml](.github/workflows/ci.yml) — Validate product           | Pull Request und Push auf `main` | Keine. Tests und Docker-Healthcheck verwenden Mock-/Demo-Daten.                                                                                                                    |
| [release.yml](.github/workflows/release.yml) — Release packages | Push auf `main`                  | `NPM_AUTH_TOKEN` für npmjs; der Wiki-Job verwendet den automatischen `GITHUB_TOKEN`. Nach Merge des Release-PRs werden Pakete veröffentlicht und Release-Dokumentation gespiegelt. |

Der Wiki-Abgleich läuft über [sync-wiki.yml](.github/workflows/sync-wiki.yml), direkt nach Release-Erstellung und bei manuell veröffentlichten Releases. Er kann separat mit `tag` erneut gestartet werden. Änderungen an Dokumentation unter `Docs/` pflegen; `pnpm test:docs` prüft den Abgleich. [Einrichtung und Ablauf](Docs/wiki.md).

## Paketnamen und fehlgeschlagene Veröffentlichungen

Alle acht Produktpakete werden mit derselben Version bei **npmjs** (`https://registry.npmjs.org`) und **GitHub Packages** (`https://npm.pkg.github.com`) veröffentlicht. Die beiden Publish-Jobs laufen unabhängig voneinander: Ein fehlendes `NPM_AUTH_TOKEN` blockiert GitHub Packages nicht. Für GitHub Packages wird das automatische `GITHUB_TOKEN` verwendet; ein zusätzliches manuelles Secret ist nicht erforderlich.

Alle acht öffentlichen Pakete müssen mit `@kieksme/csp-` beginnen. Der Scope `@kieksme` ordnet sie der npm-Organisation `kieksme` zu; `publishConfig` legt die öffentliche npm-Registry und `access: public` fest. Für GitHub Packages setzt der Publish-Job die Registry im Paketmanifest vorübergehend auf `https://npm.pkg.github.com` und verknüpft das Paket über seine Repository-Metadaten mit `kieksme/csp`. Diese Anpassung erfolgt erst nach den Prüfungen; die Manifeste im Repository behalten npmjs als Standard. Die Pakete werden je Registry bei der ersten erfolgreichen Veröffentlichung automatisch angelegt. `pnpm check:versions` prüft auch diese Vorgaben für neue Pakete.

Bereits veröffentlichte Versionen werden von `pnpm -r publish` in der jeweiligen Registry übersprungen. Bei einem Teilerfolg kann unter **Re-run failed jobs** nur das fehlgeschlagene Registry-Deployment wiederholt werden.

Ein fehlgeschlagener Publish-Job kann unter **Actions → Release packages → Run workflow** mit `publish_tag=v0.2.0` (oder dem betroffenen bestehenden Release-Tag) erneut ausgeführt werden. Den Workflow aus `main` mit der korrigierten Pipeline starten. Er checkt den angegebenen Tag aus und prüft die Pakete vor der Veröffentlichung. Ein leerer Wert startet nur den normalen Release-Please-Ablauf. Ein erneuter Push allein veröffentlicht einen bereits erstellten Release nicht erneut.

`CHANGELOG.md` wird von Release Please erzeugt und von der allgemeinen Formatierungsprüfung ausgenommen. Für ältere Release-Tags normalisiert der Publish-Job die Datei vor der Prüfung, damit deren Formatierung die Veröffentlichung nicht blockiert.

## GitHub Packages: Zugriff und Installation

Unter **kieksme → Settings → Packages** muss die Erstellung von Paketen für die gewünschte Sichtbarkeit erlaubt sein. Bereits vorhandene Pakete müssen dem Repository `kieksme/csp` unter **Package settings → Manage Actions access** Schreibzugriff gewähren, sofern dieser nicht über die Repository-Verknüpfung geerbt wird. `packages: write` ist im Workflow gesetzt.

Neue GitHub-Packages-Pakete sind zunächst privat. Falls sie wie bei npmjs öffentlich installierbar sein sollen, die Sichtbarkeit je Paket unter **Package settings → Change visibility → Public** setzen. `--access public` allein ändert die GitHub-Paketsichtbarkeit nicht.

Für die Installation aus GitHub Packages im Kundenrepo eine `.npmrc` mit dieser Scope-Zuordnung anlegen:

```ini
@kieksme:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${NODE_AUTH_TOKEN}
```

Der lesende Token wird als Umgebungsvariable übergeben und gehört nicht in die Datei. Für lokale Installation verwendet GitHub Packages einen klassischen PAT mit `read:packages` sowie Zugriff auf die privaten Pakete. Auch öffentliche npm-Pakete auf GitHub Packages benötigen eine Authentifizierung. In GitHub Actions kann `GITHUB_TOKEN` mit `packages: read` verwendet werden, wenn das jeweilige Paket dem Kundenrepo Leserechte gewährt. Ohne diese `.npmrc`-Zuordnung werden die Pakete standardmäßig von npmjs installiert.

## GitHub Action im Kundenrepo

Der mitgelieferte [deploy.yml](templates/customer/.github/workflows/deploy.yml) benötigt **keine manuell angelegten Secrets**. GitHub Pages verwendet die von GitHub bereitgestellte Workflow-Authentifizierung mit `pages: write` und `id-token: write`. Unter **Settings → Pages** als Quelle `GitHub Actions` wählen und im Environment `github-pages` gegebenenfalls die Deployment-Regeln für `main` konfigurieren.

Die Personalisierung erfolgt über `portal.config.json` und ausdrücklich gesetzte öffentliche Overrides im gemeinsamen Workflow; Details stehen in der [README](README.md#deklaratives-kundenprofil-und-deployment). Der Workflow lädt das API-Image als Artefakt `api-image` hoch; er deployt es nicht und benötigt daher keine API-Hosting- oder Container-Registry-Zugangsdaten.

## Provider-Secrets für den API-Betrieb

Diese Schlüssel werden von den vorhandenen GitHub Actions nicht benötigt. Sie sind abhängig von den installierten Plugins und dem gewählten Chat-Provider direkt als Secrets beziehungsweise Runtime-Umgebungsvariablen beim **API-Host** zu hinterlegen:

| Runtime-Secret            | Wann erforderlich?                                      | Zusätzlich benötigte Runtime-Konfiguration                                                     |
| ------------------------- | ------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `CSP_SIGNL4_API_KEY`      | SIGNL4-Plugin außerhalb der Demo.                       | `CSP_SIGNL4_TEAM_ID`; Schlüssel mit Leserechten für Teamprofile, Schichten, Bilder und Alerts. |
| `CSP_CHAT_OPENAI_API_KEY` | Chat mit `CSP_CHAT_PROVIDER=openai` außerhalb der Demo. | `CSP_CHAT_MODEL`.                                                                              |
| `CSP_CHAT_AZURE_API_KEY`  | Chat mit `CSP_CHAT_PROVIDER=azure` außerhalb der Demo.  | `CSP_CHAT_MODEL` als Deployment-Name und `CSP_CHAT_AZURE_ENDPOINT` als Ressourcen-Origin.      |

Ollama und die öffentlichen Uptime-Kuma-Statusendpunkte benötigen in der vorhandenen Implementierung keine API-Schlüssel. Für Ollama Modell und erreichbare URL konfigurieren; für Kuma `CSP_KUMA_URL` und `CSP_KUMA_SLUG` setzen. Vollständige Provider- und Runtime-Optionen stehen unter [Konfiguration](Docs/configuration.md) und [Betrieb](Docs/operations.md).

Falls später ein API-Deployment-Schritt ergänzt wird, müssen benötigte Zugangsdaten ausdrücklich über `secrets.*` an diesen Schritt beziehungsweise an den API-Host weitergegeben werden. Das bloße Anlegen eines GitHub-Secrets stellt es dem API-Service nicht bereit. Schlüssel weder committen noch in Frontend-Builds, öffentliche Variablen, `VITE_*`-Werte oder das Docker-Image aufnehmen.
