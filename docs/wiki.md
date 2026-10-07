# Dokumentation und Wiki

## Quelle und Layout

`docs/` im Produktrepo ist die Quelle der Projekt-Dokumentation. Das zugehörige GitHub-Wiki ist [kieksme/csp/wiki](https://github.com/kieksme/csp/wiki); sein Git-Repository heißt `https://github.com/kieksme/csp.wiki.git`.

Alle Seiten liegen als Markdown-Dateien direkt unter `docs/`. Dateinamen verwenden ASCII-Buchstaben, Ziffern, Bindestriche oder Unterstriche. Relative Seitenlinks schreiben wir als `[Konfiguration](configuration.md)`; sie funktionieren beim Browsen des Produktrepos und werden beim Abgleich zu Wiki-Seitenlinks ohne `.md` umgeschrieben. Anker bleiben erhalten. Links in Codebeispielen sowie externe URLs bleiben unverändert. Für Quellcode-Dateien absolute GitHub-Links verwenden.

| Datei         | Verwendung                                                                         |
| ------------- | ---------------------------------------------------------------------------------- |
| `Home.md`     | Startseite des Wikis und Übersicht der Projektdokumentation                        |
| `_Header.md`  | Gemeinsame Navigation; der Abgleich fügt sie oben in jede normale Inhaltsseite ein |
| `_Footer.md`  | GitHub-Wiki-Footer                                                                 |
| `_Sidebar.md` | GitHub-Wiki-Seitenleiste                                                           |

GitHub rendert `_Sidebar.md` und `_Footer.md` automatisch. `_Header.md` ist keine native GitHub-Layoutfunktion; deshalb übernimmt das Skript die Einfügung. Die Header-Datei selbst wird ebenfalls gespiegelt. Die Quellen in `docs/` erhalten keinen eingefügten Header.

## Einmalige Einrichtung

1. Im Produktrepo unter **Settings → General → Features** das **Wiki** aktivieren.
2. Im Wiki die erste Seite speichern. Erst dadurch steht das separate Wiki-Git-Repository zum Klonen bereit. `Home` darf anschließend vom automatischen Abgleich ersetzt werden.

Der Wiki-Abgleich verwendet den von GitHub automatisch bereitgestellten `GITHUB_TOKEN`. Ein zusätzliches Secret oder ein persönlicher Token ist nicht erforderlich. Für das Wiki desselben Repositorys genügt `contents: write`; diese Berechtigung ist sowohl am aufrufenden Wiki-Job in `release.yml` als auch am Abgleichjob in `sync-wiki.yml` gesetzt. Organisationsrichtlinien müssen diese Schreibrechte erlauben.

Der Token wird nur dem Abgleichschritt als Umgebungsvariable übergeben und nicht in Remote-URLs oder im Wiki gespeichert. Ein anderes Zielrepository würde separate Zugangsdaten benötigen; dieser Workflow spiegelt ausschließlich ins Wiki des eigenen Repositorys.

## Automatischer Ablauf

`.github/workflows/release.yml` ruft nach Erstellung eines Release-Tags den wiederverwendbaren Workflow `.github/workflows/sync-wiki.yml` direkt auf. Das ist notwendig, weil ein mit `GITHUB_TOKEN` erzeugter Release keinen weiteren Workflow über das Release-Ereignis startet.

Der Wiki-Job läuft unabhängig vom npm-Publish-Job: Sobald der GitHub-Release erstellt wurde, wird dessen Dokumentation gespiegelt, auch wenn die npm-Veröffentlichung separat scheitert. Zusätzlich reagiert der Wiki-Workflow auf `release: published`, etwa bei manuell veröffentlichten Releases einschließlich Pre-Releases. Entwürfe werden nicht gespiegelt.

Der Workflow lädt das Abgleichskript aus dem Standardbranch und die Dokumentation ausschließlich aus `refs/tags/<release-tag>`. Spätere Änderungen auf `main` gelangen dadurch nicht in die Dokumentation eines älteren Releases. Der Workflow verwendet `docs/`; bei älteren Release-Tags wird das frühere `Docs/` weiterhin gelesen. Fehlen beide Verzeichnisse, wird der Tag mit einer klaren Fehlermeldung abgelehnt.

`scripts/sync-wiki.mjs` prüft die Pflichtseiten und internen Markdown-Seitenlinks, fügt den Header ein und kopiert die Seiten in das geklonte Wiki. `.csp-wiki-manifest.json` im Wiki hält Repository, Release-Tag und die verwalteten Dateinamen fest. Beim nächsten Abgleich werden Seiten gelöscht, die im vorherigen Manifest stehen und im neuen `docs/` fehlen. Andere Wiki-Dateien bleiben erhalten; Dateien mit demselben Namen wie eine Dokumentationsseite werden übernommen und künftig verwaltet.

Ein unveränderter Wiederholungslauf erzeugt keinen neuen Commit. Ein anderer Tag aktualisiert die Herkunft im Manifest. Alle Wiki-Läufe werden durch eine gemeinsame Concurrency-Gruppe serialisiert. Der Workflow pusht regulär, ohne Force-Push. Bei Konflikten oder fehlenden Rechten scheitert der Lauf sichtbar; nach Behebung erneut starten.

## Wiederholen und überprüfen

Unter **Actions → Sync release documentation to wiki → Run workflow** den Workflow auf dem Standardbranch mit `tag=v<version>` starten. Das spiegelt den angegebenen vorhandenen Tag erneut. Ein bewusst gewählter älterer Tag setzt die verwaltete Dokumentation auf diesen Stand zurück.

Auch **Release packages → Run workflow** mit `publish_tag` wiederholt den Wiki-Abgleich, versucht aber zusätzlich den npm-Publish. Für reine Wiki-Korrekturen daher den eigenen Wiki-Workflow verwenden.

Lokale Vorschau ohne Netzwerk oder Git-Push:

```sh
node scripts/sync-wiki.mjs docs /tmp/csp-wiki-preview v<version> https://github.com/kieksme/csp
pnpm test:docs
```

`v<version>` im Befehl ersetzen. Das Skript schreibt nur in das angegebene Zielverzeichnis. Für die Vorschau ein separates Verzeichnis außerhalb des Produktrepos verwenden. Die Tests prüfen auch, dass die vorhandenen Dokumentationsseiten untereinander erreichbar sind.

Nach einem Release den Wiki-Job, den Commit `docs: sync <tag>`, die Herkunft im Manifest sowie Home, Header, Sidebar und Footer prüfen. Direkte Änderungen an verwalteten Wiki-Seiten werden beim nächsten Abgleich überschrieben; Änderungen an der Dokumentation deshalb als PR im Produktrepo vornehmen.

Weiter: [Entwicklung und Tests](development.md), [Betrieb und Releases](operations.md), [Fehlerbehebung](troubleshooting.md).
