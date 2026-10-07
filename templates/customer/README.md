# Kundeninstanz

Kundenwerte liegen in `portal.config.json`, Inhalte in `content.json`. Die CSP-Pakete enthalten die gemeinsame Anwendung; TypeScript-, Vite- und Docker-Einstiegsdateien sind nicht erforderlich.

```sh
pnpm install
pnpm exec csp validate
pnpm dev
pnpm build
pnpm start
```

`dev` startet Frontend und API. Änderungen am Profil und an Plugins benötigen einen Neustart von `dev`; API-Code ist paketiert. `build` erzeugt `dist/` und `dist-api/`, `start` startet die gebaute API. Das statische Frontend wird separat ausgeliefert. Das Lockfile nach der ersten Installation einchecken; CI installiert mit `--frozen-lockfile`.

Öffentliche Overrides und Provider-Konfiguration stehen in `.env`/`.env.local`; `.env.example` dokumentiert den Vertrag. Geheimnisse gehören ausschließlich in die API-Umgebung. `pnpm exec csp inspect` zeigt aufgelöste öffentliche Werte und ihre Herkunft. Produktive Beispielwerte prüft `pnpm exec csp validate --production`.

Alle Pfade beziehen sich auf das Profilverzeichnis. Logo und Icon werden mit `branding.logoFile` und `branding.iconFile` referenziert. Nur referenzierte Webassets werden ausgeliefert. Optional verweist `avatarsFile` auf `{ "ids": { "provider-id": "public/avatar.webp" }, "names": { "Lena Demo": "public/avatar.webp" } }`; IDs haben Vorrang. Die Kundenpaketversion erscheint im Footer.

`theme.mode` unterstützt `light`, `dark` und `system` als Anfangsauswahl. `theme.tokens` definiert semantische Farben und die Schriftfamilie; `darkTokens` ergänzt dunkle Varianten. Eigene Fonts müssen vom Betreiber rechtlich und technisch verfügbar gemacht werden.

Eine synthetische API-Demo aktiviert `public.demo: true`. Zusätzlich aktiviert `public.staticDemo: true` die browserseitige Demo ohne API für statische Hosts. Diese Demo verwendet ausschließlich synthetische Daten und benötigt keine Provider-Secrets.

Plugins verwalten: `pnpm exec csp plugin add @kieksme/csp-plugin-signl4`, `remove <name>`, `list`. Versionen werden im Paketmanifest und Lockfile verwaltet. Ein Plugin muss installiert, in `dependencies` deklariert und SDK-kompatibel sein.

Die CI-Vorlage ruft den gemeinsamen Workflow auf. Der Workflow ist auf eine konkrete CSP-Commit-SHA fixiert. `pages: true` aktiviert GitHub Pages; sonst werden nur Artefakte erzeugt. Öffentliche Overrides werden als JSON übergeben, ohne leere GitHub-Variablen. Das API-Image ist ein Build-Artefakt; der API-Host und dessen Deployment müssen separat eingerichtet werden.
