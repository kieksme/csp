# Projektregeln für CSP

## Dokumentation ist Teil jeder Feature-Änderung

Bei jeder Ergänzung, Änderung oder Entfernung eines Features muss die betroffene Dokumentation im selben Änderungssatz und PR aktualisiert werden. Das gilt auch für Fehlerkorrekturen, die dokumentiertes Verhalten ändern. Die Arbeit ist erst abgeschlossen, wenn Code und Dokumentation übereinstimmen; Dokumentation nicht auf später verschieben.

- Die passende Seite unter `Docs/` sowie betroffene README-Dateien aktualisieren.
- Bei Konfigurationsänderungen `Docs/configuration.md` um Zweck, Pflichtstatus, Standardwerte, zulässige Werte/Grenzen und Build-/Runtime-Zuordnung ergänzen; betroffene Beispiele, Env-Vorlagen und Editor-Schemas mitführen.
- Bei Änderungen an Plugins, CLI, API oder Deployment deren Anleitung anpassen; entfernte Optionen und veraltete Beispiele entfernen.
- `Docs/` ist die Quelle des GitHub-Wikis. Keine direkten Änderungen an verwalteten Wiki-Seiten vornehmen; Veröffentlichung erfolgt über den bestehenden Release-Abgleich.
- Dokumentationsdateien und ausgeführte Prüfungen im PR nennen. `pnpm test:docs` und die Formatierungsprüfung ausführen; zusätzlich die zur Implementierungsänderung erforderlichen Prüfungen gemäß `Contribute.md`.

Reine interne Änderungen ohne Auswirkung auf dokumentiertes Verhalten benötigen keine erfundene fachliche Doku-Änderung; die fehlende Auswirkung im PR begründen. Diese Ausnahme gilt nicht für neue, geänderte oder entfernte Features.
