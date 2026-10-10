# Deployment

Das Frontend wird als statisches `dist/` veröffentlicht. Die API läuft separat als Node-Prozess oder Container. Beide gehören zur selben Kundeninstanz und benötigen passende, aber getrennt gesetzte Konfigurationen.

## GitHub Pages im Kundenrepo

Die CLI liefert einen kurzen `.github/workflows/deploy.yml`, der den gemeinsamen Kundenbuild auf einer festen Commit-SHA aufruft. Pull Requests und Pushes auf `main` erzeugen Frontend und API-Image als Artefakte. `pages: true` aktiviert zusätzlich die Pages-Veröffentlichung bei Pushes. Unter **Settings → Pages → Build and deployment → Source** `GitHub Actions` auswählen und das Environment `github-pages` einrichten.

Branding, Kontakt und öffentliche Standardwerte liegen in `portal.config.json`. Umgebungsabhängige Werte werden ausdrücklich über `public-overrides` als JSON übergeben:

```yaml
with:
  config: portal.config.json
  pages: true
  public-overrides: '{"CSP_API_URL":"https://api.musterkunde.example","CSP_BASE_PATH":"/kundenportal/"}'
```

Ungesetzte Werte werden ausgelassen; leere Overrides werden abgelehnt. Öffentliche Konfiguration ist im Browser sichtbar. Provider-Schlüssel ausschließlich am API-Host setzen. Prozessvariablen haben Vorrang vor Profil und Build-Env-Dateien.

## Custom Domain und andere Frontend-Hosts

Für eine Pages-Domain zusätzlich DNS, die Domain in Pages konfigurieren. `CSP_DOMAIN` setzt nur den Canonical-Link. Bei einer Domain am Webroot `CSP_BASE_PATH=/` verwenden. Unterpfade müssen mit einem Slash beginnen und enden; Logos und Avatar-URLs berücksichtigen diesen Pfad.

Bei anderem statischem Hosting den Inhalt von `dist/` unter dem konfigurierten Basispfad bereitstellen. Frontend und API über HTTPS erreichbar machen; ein HTTPS-Frontend darf keine HTTP-API verwenden.

## API bereitstellen

Der Kundenworkflow stellt das gebaute Docker-Image als Artefakt `api-image` bereit; er deployt die API nicht. Das Image beim gewählten Host laden. Das zentrale Dockerfile stammt aus dem CLI-Paket; die Kundeninstanz benötigt kein eigenes Dockerfile. Runtime-Konfiguration über Hosting-Secrets oder eine nicht eingecheckte Env-Datei übergeben:

```sh
docker load -i api-image.tar
docker run --rm -p 3001:3001 --env-file customer-runtime.env customer-api
```

Das Kundenrepo muss dafür ein Lockfile enthalten. Kontakt und Inhalte stammen aus dem mitgelieferten Profil. Am API-Host die Provider-Konfiguration und `CSP_ALLOWED_ORIGINS=https://portal.musterkunde.example` setzen. Build-Variablen aus GitHub werden nicht automatisch dorthin übertragen. Die Inhaltsdatei muss auch im API-Image vorhanden sein.

TLS am Reverse-Proxy/Host terminieren. `CSP_TRUST_PROXY=true` nur setzen, wenn der vertrauenswürdige Proxy eingehende Forwarded-Header ersetzt. SSE für Chat ohne Response-Buffering weiterleiten und das 60-Sekunden-Zeitlimit berücksichtigen. `/health` und installierte Provider-Routen von außen prüfen.

## Änderungen und Rollback

Branding und Inhalte benötigen einen neuen Frontend-Build; Runtime-/Inhaltsänderungen benötigen einen API-Neustart. Plugin-Änderungen erfordern den Neubau beider Teile. Für Rollbacks das vorherige Kunden-Lockfile, Frontend-Artefakt, API-Image und passende Runtime-Konfiguration gemeinsam verwenden.

Weiter: [Konfiguration](configuration.md), [Betrieb](operations.md), [Fehlerbehebung](troubleshooting.md).

## Gemeinsamer Kundenbuild

`.github/workflows/customer-build.yml` verarbeitet den Kundencheckout: Installation mit Lockfile, produktive Profilvalidierung, Frontend/API-Build und API-Image-Artefakt. Das Dockerfile wird aus dem installierten CLI-Paket bereitgestellt. Der Aufruf im Kundenrepo erhält eine geprüfte Workflow-Commit-SHA, `config`, optional `pages` und `public-overrides` als JSON mit ausdrücklich gesetzten Werten. Provider-Secrets werden nicht an den Build übergeben. Pages benötigt entsprechende Caller-Rechte und das `github-pages`-Environment.

Das API-Image enthält Kundenprofil, Inhalte und referenzierte Assets aus dem Kundencheckout und startet `dist-api/server.js`. Providerwerte kommen beim Start aus der Hosting-Secret-Verwaltung. Der Workflow deployt keine API; Hosting, Provider-Anbindung und Rollback sind im gewählten Staging separat zu prüfen. Frontend und API müssen zusammen mit Kundencommit, Lockfile, Paketversionen und derselben öffentlichen Konfiguration ausgerollt bzw. zurückgesetzt werden. CSP-Pakete und der Workflow müssen vor der Kundenmigration veröffentlicht sein; lokale Tarball-Tests ersetzen keine Registry-Veröffentlichung.

## Optionaler Teams-Support

Entra-/Bot-Registrierung, PostgreSQL, Standard-Channel und Runtime-Secrets sind zusätzlich erforderlich. Ein API-Replikat mit `Recreate`; der PostgreSQL-Lock verhindert parallele Instanzen. `/api/messages` muss per HTTPS für Microsoft erreichbar sein; Gesprächsrouten validieren Entra-API-Tokens. Einrichtung und Live-Abnahme: [Teams-Support](teams-support.md).
