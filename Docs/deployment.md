# Deployment

Das Frontend wird als statisches `dist/` veröffentlicht. Die API läuft separat als Node-Prozess oder Container. Beide gehören zur selben Kundeninstanz und benötigen passende, aber getrennt gesetzte Konfigurationen.

## GitHub Pages im Kundenrepo

Die CLI liefert `.github/workflows/deploy.yml`. Pull Requests bauen Frontend und API-Image; Pushes auf `main` deployen zusätzlich das Frontend nach GitHub Pages. Unter **Settings → Pages → Build and deployment → Source** `GitHub Actions` auswählen. Im Environment `github-pages` gegebenenfalls Deployment-Regeln für `main` konfigurieren.

Unter **Settings → Secrets and variables → Actions → Variables** folgende Repository-Variablen setzen:

| Variable            | Beispiel / Bedeutung                                                  |
| ------------------- | --------------------------------------------------------------------- |
| `CSP_NAME`          | `Musterkunde Service Portal`; erforderlich                            |
| `CSP_API_URL`       | `https://api.musterkunde.example`; erforderlich, ohne `/api/v1`       |
| `CSP_CONTACT_PHONE` | `+49 30 123456`; erforderlich                                         |
| `CSP_BASE_PATH`     | `/<repo>/` bei Pages im Repo-Unterpfad, sonst `/`                     |
| `CSP_DOMAIN`        | Optional `https://portal.musterkunde.example` für Canonical-Metadaten |

Die drei Pflichtwerte werden direkt als Prozessvariablen übergeben. Fehlende GitHub-Variablen überschreiben lokale Standards mit leeren Werten und lassen den Build scheitern. Der Build-Job hat kein Environment `github-pages`; diese Werte müssen als Repository-Variablen verfügbar sein.

Weitere Branding-Werte wie Farben oder Logo werden vom vorhandenen Workflow nicht automatisch übernommen. Sie können in `.env.production` gepflegt oder im `env`-Block des Build-Schritts ausdrücklich zugeordnet werden:

```yaml
CSP_COLOR: ${{ vars.CSP_COLOR || '#176b58' }}
CSP_TAGLINE: ${{ vars.CSP_TAGLINE || 'Wir sind für Sie da.' }}
CSP_LOGO_URL: ${{ vars.CSP_LOGO_URL }}
```

Prozessvariablen haben Vorrang vor Vites `.env`-Dateien. Öffentliche Konfiguration ist im Browser sichtbar. Provider-Schlüssel ausschließlich am API-Host setzen.

## Custom Domain und andere Frontend-Hosts

Für eine Pages-Domain zusätzlich DNS, die Domain in Pages und `public/CNAME` im Kundenrepo konfigurieren. `CSP_DOMAIN` setzt nur den Canonical-Link. Bei einer Domain am Webroot `CSP_BASE_PATH=/` verwenden. Unterpfade müssen mit einem Slash beginnen und enden; Logos und Avatar-URLs berücksichtigen diesen Pfad.

Bei anderem statischem Hosting den Inhalt von `dist/` unter dem konfigurierten Basispfad bereitstellen. Frontend und API über HTTPS erreichbar machen; ein HTTPS-Frontend darf keine HTTP-API verwenden.

## API bereitstellen

Der Kundenworkflow stellt das gebaute Docker-Image als Artefakt `api-image` bereit; er deployt die API nicht. Das Image beim gewählten Host laden beziehungsweise dort aus dem Kunden-Dockerfile bauen. Runtime-Konfiguration über Hosting-Secrets oder eine nicht eingecheckte Env-Datei übergeben:

```sh
docker build -t customer-api .
docker run --rm -p 3001:3001 --env-file customer-runtime.env customer-api
```

Das Kundenrepo muss dafür ein Lockfile enthalten. Am API-Host mindestens `CSP_CONTACT_PHONE`, `CSP_CONTENT_PATH=content.json`, die Provider-Konfiguration und `CSP_ALLOWED_ORIGINS=https://portal.musterkunde.example` setzen. Build-Variablen aus GitHub werden nicht automatisch dorthin übertragen. Die Inhaltsdatei muss auch im API-Image vorhanden sein.

TLS am Reverse-Proxy/Host terminieren. `CSP_TRUST_PROXY=true` nur setzen, wenn der vertrauenswürdige Proxy eingehende Forwarded-Header ersetzt. SSE für Chat ohne Response-Buffering weiterleiten und das 60-Sekunden-Zeitlimit berücksichtigen. `/health` und installierte Provider-Routen von außen prüfen.

## Änderungen und Rollback

Branding und Inhalte benötigen einen neuen Frontend-Build; Runtime-/Inhaltsänderungen benötigen einen API-Neustart. Plugin-Änderungen erfordern den Neubau beider Teile. Für Rollbacks das vorherige Kunden-Lockfile, Frontend-Artefakt, API-Image und passende Runtime-Konfiguration gemeinsam verwenden.

Weiter: [Konfiguration](configuration.md), [Betrieb](operations.md), [Fehlerbehebung](troubleshooting.md).

## Gemeinsamer Kundenbuild

`.github/workflows/customer-build.yml` verarbeitet den Kundencheckout: Installation mit Lockfile, produktive Profilvalidierung, Frontend/API-Build und API-Image-Artefakt. Das Dockerfile wird aus dem installierten CLI-Paket bereitgestellt. Der Aufruf im Kundenrepo erhält eine geprüfte Workflow-Commit-SHA, `config`, optional `pages` und `public-overrides` als JSON mit ausdrücklich gesetzten Werten. Provider-Secrets werden nicht an den Build übergeben. Pages benötigt entsprechende Caller-Rechte und das `github-pages`-Environment.

Das API-Image enthält Kundenprofil, Inhalte und referenzierte Assets aus dem Kundencheckout und startet `dist-api/server.js`. Providerwerte kommen beim Start aus der Hosting-Secret-Verwaltung. Der Workflow deployt keine API; Hosting, Provider-Anbindung und Rollback sind im gewählten Staging separat zu prüfen. Frontend und API müssen zusammen mit Kundencommit, Lockfile, Paketversionen und derselben öffentlichen Konfiguration ausgerollt bzw. zurückgesetzt werden. CSP-Pakete und der Workflow müssen vor der Kundenmigration veröffentlicht sein; lokale Tarball-Tests ersetzen keine Registry-Veröffentlichung.
