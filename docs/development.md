# Entwicklung und Tests

## Arbeitsablauf

Node.js 22.12+ und pnpm 12.8.1 verwenden. Nach `pnpm install --frozen-lockfile` zunächst `pnpm build`, damit Workspace-Exporte verfügbar sind. Die Demo dient zur lokalen Produktentwicklung; Kundenanpassungen gehören in eigenständige Kundenrepos.

| Befehl                | Prüfung / Zweck                                                                 |
| --------------------- | ------------------------------------------------------------------------------- |
| `pnpm check:versions` | Gemeinsame Version, Release-Konfiguration, Plugin-Kompatibilität und Paketnamen |
| `pnpm lint`           | Prettier für Quellcode, Workflows und Dokumentation                             |
| `pnpm typecheck`      | TypeScript ohne Ausgabe                                                         |
| `pnpm test`           | Vitest-Unit-/Integrationstests für SDK, Server, Provider, CLI und Releases      |
| `pnpm test:docs`      | Wiki-Abgleich einschließlich Links, Header, Löschungen und Wiederholung         |
| `pnpm build`          | Alle Pakete, Demo, Northstar und Kunden-Vorlage                                 |
| `pnpm check`          | Versionsprüfung, Formatierung, Typen, Tests, Dokumentationsprüfung und Builds   |
| `pnpm test:packages`  | Gepackte npm-Pakete in frischer Kundeninstanz und externes Plugin add/remove    |
| `pnpm test:browser`   | Playwright für Desktop/Mobile, zwei Instanzen, Offline und Fehlerfälle          |

Vor Browsertests `pnpm exec playwright install chromium` ausführen. In CI installiert Playwright zusätzlich die Systemabhängigkeiten. `pnpm format` formatiert die Dateien; generiertes `CHANGELOG.md` ist von der allgemeinen Prüfung ausgenommen.

## Dokumentation bei Feature-Änderungen

Jede Ergänzung, Änderung oder Entfernung eines Features muss im selben PR die betroffene Dokumentation aktualisieren. Die Dokumentationsänderung ist Teil der Fertigstellung und muss vor dem Merge vorhanden sein; sie darf nicht auf einen späteren PR verschoben werden.

Für neue oder geänderte Konfigurationsoptionen in [Konfiguration](configuration.md) Name, Zweck, Pflichtstatus, Standardwert, zulässige Werte und Grenzen sowie Build-/Runtime-Zuordnung dokumentieren. Beispiele, Env-Vorlagen und das Editor-Schema bei Änderungen ihres Vertrags ebenfalls aktualisieren. Bei Änderungen an Verhalten, Plugins, CLI, API oder Deployment die jeweiligen Seiten unter `docs/` und betroffene README-Dateien anpassen; entfernte Funktionen auch aus Beispielen entfernen.

`docs/` ist die Quelle für das GitHub-Wiki. Verwaltete Wiki-Seiten nicht direkt bearbeiten; sie werden aus dem Release-Tag veröffentlicht. Im PR die geänderten Dokumentationsdateien nennen und die Dokumentationsprüfung bestätigen. `pnpm test:docs` sowie die Formatierungsprüfung müssen erfolgreich sein. Die Linkprüfung ersetzt nicht den inhaltlichen Abgleich mit dem implementierten Verhalten.

## CI

`.github/workflows/ci.yml` läuft bei Pull Requests und Pushes auf `main`. Der Prüfjob führt `pnpm check`, den Paket-Smoke-Test und Browsertests aus und lädt Browser-Belege als Artefakt hoch. Ein separater Job baut das API-Image und prüft `/health` im Demo-Modus.

Tests verwenden Mocks und synthetische Daten. Produktionszugänge separat prüfen: Team, Schichten, Bilder, Alerts, Kuma-Monitore und eine Chat-Antwort mit dem gewählten Provider. `/health` allein deckt diese Integration nicht ab.

## Änderungen an Paketen und Vorlage

Neue Plugins müssen Browser-/Server-Exporte, deklarierte SDK-Kompatibilität, veröffentlichte Typen und konsistente Metadaten bereitstellen. Neue Workspace-Pakete in `release-please-config.json` aufnehmen. Eigene Versionen nicht unabhängig erhöhen; Release Please verwaltet die gemeinsame Produktversion.

Die CLI-Vorlage stammt aus `templates/customer`. Änderungen dort vornehmen und mit Paket-Smoke-Tests prüfen. Kundeninstanzen erhalten spätere Vorlagenänderungen nicht automatisch; bestehende Repos müssen die betroffenen Konfigurations-/Workflow-Dateien bewusst aktualisieren.

Änderungen als Conventional Commits liefern, einschließlich des Squash-Merge-Titels. `fix:` löst Patch-, `feat:` Minor- und `feat!:`/`BREAKING CHANGE:` inkompatible Releases aus. Dokumentation im selben PR wie die betroffene Funktion aktualisieren. Secrets und reale Kundendaten nicht in Testfixtures aufnehmen.

Weiter: [Plugin-SDK](plugin-sdk.md), [Betrieb und Releases](operations.md), [Dokumentation und Wiki](wiki.md).
