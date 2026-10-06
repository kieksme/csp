# Sicherheit und Daten

## Öffentliche Oberfläche

Das Portal und seine API haben keine Anmeldung. Hotline, Teamkontakte, E-Mail-Adressen, Schichten, Alert-Beschreibungen, Status und statische Inhalte sind öffentlich, sobald die betreffenden Plugins aktiviert sind. Inhalte und Kontakte deshalb vor einem produktiven Deployment auf ihre Eignung zur Veröffentlichung prüfen.

`CSP_ALLOWED_ORIGINS` begrenzt Browser-CORS-Zugriffe und ist keine Authentifizierung. Auch vCards und Team-Avatare sind öffentlich; die API beschränkt deren IDs auf das konfigurierte Team.

## Provider-Schlüssel und Build

Die Vite-Konfiguration lädt Umgebungswerte, aber `publicConfig` exportiert nur explizit ausgewählte öffentliche Felder. Provider-Schlüssel gehören in Runtime-Secrets des API-Hosts. Sie dürfen nicht in `VITE_*`, öffentliche GitHub-Variablen, Kundeninhalte oder Bild-/Frontend-Artefakte aufgenommen werden.

Öffentliche URL-Konfiguration akzeptiert HTTP(S) oder erlaubte absolute URL-Pfade und lehnt eingebettete Zugangsdaten ab. Inhaltstexte unterstützen Markdown ohne HTML-Ausführung. Kunden-`.env`-Dateien bleiben außerhalb von Git und Docker-Images.

## Providerzugriffe und Chat

SIGNL4 wird lesend verwendet: Team und Bilder über GET, Schichten und Alerts über lesende POST-Abfragen. Das Portal bestätigt keine Signls und verändert keine Schichten. Kuma verwendet veröffentlichte Statusseiten-Endpunkte.

Der Chat lädt Wissensquellen ausschließlich aus der eigenen Instanz. Ausgewählte statische und Live-Daten sowie der übergebene Gesprächsverlauf werden an OpenAI, Azure OpenAI oder Ollama übertragen. OpenAI/Azure erhalten `store: false`; daraus folgt keine allgemeine Zusicherung über die Aufbewahrung beim Provider. Dessen Betrieb und Datenverarbeitung separat passend zur Kundeninstanz konfigurieren.

Quellen und Benutzertexte werden als Daten behandelt. Die Systemanweisung beschränkt Antworten auf den Quellkontext, kennzeichnet fehlende/veraltete Daten und verbietet behauptete Aktionen. Es gibt keine ausführenden Tools oder Ticket-/Alert-Mutationen. KI-Antworten können dennoch fehlerhaft sein; für dringende Störungen den direkten Kontakt verwenden.

## Speicherung und Betriebsgrenzen

Live-Caches und Chat-Limits liegen im Speicher des API-Prozesses. Das Portal speichert Gesprächsverläufe weder in einer Datenbank noch im Browser-Storage. Das Frontend hält den aktuellen Verlauf im Arbeitsspeicher und speichert lediglich die Designpräferenz unter `csp-theme`. Statische PWA-Inhalte/Assets werden gecacht; API-/Chat-Antworten nicht.

TLS am Host/Reverse-Proxy bereitstellen. `CSP_TRUST_PROXY` bleibt standardmäßig aus; nur für einen vertrauenswürdigen Proxy einschalten. Chat besitzt IP- und Parallelitätslimits je Prozess. Bei mehreren API-Replikas ist zusätzlich eine gemeinsame Limitierung am Gateway erforderlich. Der API-Body ist auf 64 KiB begrenzt; Providerabfragen und Streams besitzen Zeitlimits.

Weiter: [Konfiguration](configuration.md), [API](api.md), [Betrieb](operations.md).
