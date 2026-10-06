# Betrieb und Releases

## Eine Instanz pro Kunde

Jedes Kundenrepo enthält seine Plugin-Registrierung, Inhalte, Branding und Lockfile. SDK, Core und Plugins kommen aus derselben npm-Paketfamilie. Die CLI erzeugt `portal.browser.ts` und `portal.server.ts`; kundenspezifische Core-Forks sind nicht erforderlich. Updates laufen über normale Dependency-PRs mit neuem Build.

Das Frontend ist ein statisches `dist/` und läuft auf GitHub Pages, einem Webserver oder Hosting beim Kunden. Für Pages im Repo-Unterpfad `CSP_BASE_PATH=/<repo>/` setzen. Custom Domain über DNS/Hosting konfigurieren; `CSP_DOMAIN` setzt lediglich die Metadaten. Bei Pages mit Custom Domain zusätzlich `public/CNAME` anlegen.

Der API-Service läuft separat als Node-Prozess oder Container. `.env` gehört weder ins Repo noch in das Image. Runtime-Variablen per Hosting-Secrets oder `docker run --env-file …` übergeben.

```sh
# Produktrepo: API-Image der Kunden-Vorlage bauen
# Enthält zunächst contact/content/chat; weitere Plugins in eigener Instanz hinzufügen.
docker build -t customer-service-api .
docker run --rm -p 3001:3001 --env-file customer-runtime.env customer-service-api
```

Die eigenständige Kunden-Vorlage enthält einen eigenen Dockerfile. Nach `pnpm install` das Lockfile committen und das Image im Kundenrepo bauen. Der Workflow liefert ein API-Image als Artefakt; dessen Deployment erfolgt beim gewählten API-Host. Das Frontend wird per GitHub Pages deployt.

`CSP_ALLOWED_ORIGINS` enthält eine kommagetrennte Liste tatsächlicher Frontend-Origins. `CSP_PORT=3001`, `CSP_HOST=0.0.0.0` sind Runtime-Defaults. `CSP_TRUST_PROXY=true` nur hinter einem vertrauenswürdigen Proxy setzen, der eingehende Forwarded-Header ersetzt; standardmäßig sind sie nicht vertrauenswürdig. CORS ist kein Login: das Portal und seine Daten sind wie vereinbart öffentlich.

## API und Monitoring

- `GET /health`: Prozesszustand und registrierte Plugin-IDs. Dies bestätigt **keine** erfolgreiche Provider-Verbindung.
- `GET /api/v1/team`, `/schedule`, `/alerts`, `/status`: JSON mit Datenstand und Veraltet-Markierung.
- `GET /api/v1/team/:id/avatar` und `/vcard`: nur Mitglieder des konfigurierten Teams.
- `POST /api/v1/chat`: `{ "messages": [{ "role": "user", "content": "…" }] }`, Antwort als SSE.

Nur installierte Plugins registrieren die jeweiligen Routen. API-Antworten sind `no-store`. PWA-Caches enthalten statische Hilfe und Assets; API- und Chat-Daten werden nicht vom Service Worker gecacht. Veraltete Statusdaten werden nicht als aktuelle grüne Verfügbarkeit dargestellt. Die Hotline bleibt auch bei Offline-/Provider-Ausfall nutzbar.

Live-Datenfehler sind über `stale`/`error` sichtbar und können von der externen Überwachung der Kundeninstanz geprüft werden. Der In-Memory-Cache und die Chat-Limits gelten je Prozess. Die erste Version betreibt einen API-Prozess pro Kunde; mehrere Replikas benötigen eine zusätzliche gemeinsame Limitierung am Gateway. TLS wird am Hosting/Reverse-Proxy terminiert.

## npm-Releases

1. Paketnamen vor der ersten Veröffentlichung mit `node scripts/check-package-names.mjs` prüfen. Nicht veröffentlicht heißt nicht, dass Publishing-Rechte für `@kieksme` bestätigt sind.
2. npm-Scope-Rechte und `NPM_TOKEN` als GitHub-Secret einrichten; öffentlichen Paketinhalt prüfen. Reale Kundeninhalte bleiben in Kundenrepos.
3. Änderung als Conventional Commit und PR liefern, Release-Notiz mit `pnpm changeset` hinzufügen.
4. Changesets erstellt auf `main` einen Versionierungs-PR und veröffentlicht nach dessen Merge die gebauten Pakete. SDK und Plugin-Pakete werden gemeinsam versioniert.
5. Kundeninstanzen aktualisieren bewusst Paketversionen und Lockfile; Deployment bleibt unabhängig.

CI prüft Typen, Unit-/Integrationstests, alle Builds, gepackte Pakete in einer frischen Instanz, Browserfälle und einen Docker-Healthcheck. Echte Kundenzugänge werden getrennt verifiziert: Team, Schichten, Bilder, Alerts, Kuma-Monitore und eine Chat-Antwort für den gewählten Provider. Ohne diese Zugänge sind ausschließlich Mock-/Demo- und Vertragsprüfungen möglich.

## Thinkport-Konfiguration

`examples/thinkport.env.example` ist ein Branding-Startpunkt. Es enthält keine realen Teamkontakte, Tickets, Alerts oder API-Schlüssel. Die bestehende Site in `circle-zero/docs` wird von diesem Projekt nicht verändert oder umgeschaltet.
