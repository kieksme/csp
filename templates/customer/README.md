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

Das gemeinsame Core-Paket kompiliert Tailwind CSS beim Paket-Build. Kundeninstanzen benötigen weder Tailwind-Abhängigkeiten noch eine eigene CSS-/Build-Konfiguration. Die bestehende Oberfläche und die semantischen Plugin-Klassen bleiben verfügbar.

`theme.mode` unterstützt `light`, `dark` und `system` als Anfangsauswahl. `theme.tokens` definiert semantische Farben und die Schriftfamilie; `darkTokens` ergänzt dunkle Varianten. Weitere Tokens in `theme.tokens` (alle optional):

| Tokens                                          | Funktion / Standard                                                   |
| ----------------------------------------------- | --------------------------------------------------------------------- |
| `accent`, `accentSecondary`, `hero`             | Marken-, Signal- und Hero-Farbe                                       |
| `paper`, `card`, `ink`, `muted`, `line`, `soft` | Hintergrund, Karten, Text, Nebeninformationen, Rahmen, weiche Flächen |
| `success`, `danger`, `warning`, `neutral`       | Statusfarben                                                          |
| `warningSurface`, `warningInk`, `heroLine`      | Offline-Hinweis und Hero-Dekoration                                   |
| `fontFamily`, `fontMono`                        | Fließtext / technische Beschriftungen                                 |
| `fontSize`                                      | Basis-Schriftgröße, `16px`                                            |
| `spacing`                                       | Gemeinsame Abstandseinheit, `4px`                                     |
| `radius`                                        | Karten, Eingabefelder und Chat, `4px`                                 |
| `contentWidth`, `heroWidth`                     | Maximale Inhalts-/Hero-Breite, `1144px` / `1264px`                    |

Farben werden als sechsstellige Hexwerte angegeben. Größen akzeptieren `px`, `rem` oder `em`; `radius` erlaubt auch `0`, die übrigen Größen müssen positiv sein. Fehlende Tokens verwenden die Core-Defaults. `darkTokens` überschreibt beim Dunkelmodus nur die angegebenen Werte und erbt den Rest aus `tokens`. Der Theme-Wechsel entfernt vorherige Overrides, sodass dunkle Tokens nicht im Hellmodus zurückbleiben. Die Textfarben auf Marken-/Hero-Flächen werden automatisch kontrastreich gewählt. Responsive Breakpoints bleiben im Core festgelegt.

Eigene Fonts müssen vom Betreiber rechtlich und technisch verfügbar gemacht werden.

Eine synthetische API-Demo aktiviert `public.demo: true`. Zusätzlich aktiviert `public.staticDemo: true` die browserseitige Demo ohne API für statische Hosts. Diese Demo verwendet ausschließlich synthetische Daten und benötigt keine Provider-Secrets.

Plugins verwalten: `pnpm exec csp plugin add @kieksme/csp-plugin-signl4`, `remove <name>`, `list`. Versionen werden im Paketmanifest und Lockfile verwaltet. Ein Plugin muss installiert, in `dependencies` deklariert und SDK-kompatibel sein.

Die CI-Vorlage ruft den gemeinsamen Workflow auf. Der Workflow ist auf eine konkrete CSP-Commit-SHA fixiert. `pages: true` aktiviert GitHub Pages; sonst werden nur Artefakte erzeugt. Öffentliche Overrides werden als JSON übergeben, ohne leere GitHub-Variablen. Das API-Image ist ein Build-Artefakt; der API-Host und dessen Deployment müssen separat eingerichtet werden.
