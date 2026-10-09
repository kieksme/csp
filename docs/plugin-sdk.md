# Plugin-SDK

Ein Plugin ist ein öffentlich installierbares ESM-npm-Paket mit getrennten Exporten `./browser` und `./server`. Browser-Dateien dürfen keine Servermodule oder Schlüssel importieren. `dist` und Typdeklarationen gehören ins veröffentlichte Paket.

```json
{
  "name": "my-csp-plugin",
  "type": "module",
  "exports": {
    "./browser": {
      "types": "./dist/browser.d.ts",
      "import": "./dist/browser.js"
    },
    "./server": { "types": "./dist/server.d.ts", "import": "./dist/server.js" }
  },
  "cspPlugin": {
    "id": "my-service",
    "sdkVersion": "^<sdk-version>",
    "requires": [],
    "browser": "./browser",
    "server": "./server"
  }
}
```

`<sdk-version>` im Manifest durch die installierte Version von `@kieksme/csp-sdk` ersetzen. Browser und Server lesen denselben Wert aus dem Plugin-Manifest; das vermeidet auseinanderlaufende Versionsangaben.

Die ID, SDK-Version und optionalen `requires` müssen in Manifest und beiden Exporten übereinstimmen. Abhängigkeiten im Manifest beziehen sich auf Plugin-IDs, nicht npm-Paketnamen. Core prüft ID-Eindeutigkeit, SDK-Kompatibilität und Abhängigkeiten beim Start; CLI prüft vor dem Schreiben der Registrierung.

```tsx
// browser.tsx
import { cspPlugin } from '../package.json';
import type { BrowserPlugin, BrowserContext } from '@kieksme/csp-sdk';
import { useLive, DataState } from '@kieksme/csp-sdk/browser';
function MyService(ctx: BrowserContext) {
  const state = useLive<{ label: string }>(ctx, '/my-service');
  return (
    <>
      <p>{state.data?.label}</p>
      <DataState {...state} />
    </>
  );
}
export default {
  id: 'my-service',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'my-service',
      label: 'Mein Dienst',
      title: 'Mein Dienst',
      order: 80,
      component: MyService,
    },
  ],
} satisfies BrowserPlugin;
```

```ts
// server.ts
import { cspPlugin } from '../package.json';
import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
export default {
  id: 'my-service',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema: z.object({ CSP_MY_SERVICE_ENDPOINT: z.string().url() }),
  setup(ctx) {
    const load = () =>
      ctx.cache.get('my-service', async () => ({ label: 'Available' }));
    ctx.app.get('/api/v1/my-service', load);
    ctx.knowledge.set('my-service', async () => {
      const result = await load();
      return [
        {
          id: 'my-service',
          title: 'Mein Dienst',
          text: JSON.stringify(result.data),
          href: '#my-service',
          stale: result.stale,
        },
      ];
    });
  },
} satisfies ServerPlugin;
```

Server-Konfiguration wird für alle Plugins validiert, bevor Routen registriert werden. Jede Wissensquelle gehört zur aktuellen Instanz. Quelleninhalte sind Daten, keine privilegierten Chat-Anweisungen. Plugin-Code wird beim Build eingebunden; es gibt keinen Download/Code-Loader im Browser.

`LiveData<T>` enthält `data`, `updatedAt`, `stale` und optional `error`. Der Cache bündelt parallele Abfragen, hält erfolgreiche Daten 30 Sekunden und liefert bei Ausfällen den letzten Erfolg als veraltet. Die UI lädt standardmäßig alle 60 Sekunden; Schichtgrenzen werden alle 15 Sekunden lokal neu ausgewertet.

CLI-Mutationen sind für eigenständige Kundenrepos vorgesehen. Ein `pnpm-workspace.yaml` mit reinen Einstellungen ist erlaubt; ein übergeordnetes Monorepo wird abgelehnt, damit nicht dessen Lockfile verändert wird. Fehlgeschlagene Installationen stellen Paketdatei, Lockfile, pnpm-Konfiguration und Registrierungen wieder her und versuchen, den ursprünglichen Dependency-Baum erneut zu installieren.

## Veröffentlichen und einbinden

Browser und Server als ESM mit Typdeklarationen bauen, `dist/` in den npm-Paketinhalt aufnehmen und das SDK als kompatible Abhängigkeit deklarieren. Browsercode darf keine Node-/Provider-Secrets importieren. Paket-Tarball in einer frischen Kundeninstanz installieren und über die CLI registrieren; beide Anwendungsteile neu bauen. Inkompatible SDK-Versionen und fehlende `requires` gezielt prüfen.

Weiter: [Plugins und CLI](plugins.md), [Entwicklung und Tests](development.md), [API](api.md).

## Persönlicher Header

`BrowserPlugin.hero` kann eine Komponente für den persönlichen Einstieg liefern. Ohne Hero-Plugin zeigt Core weiterhin den konfigurierten Slogan. `Section.placement: 'hero'` platziert eine Sektion unter der Begrüßung im Header; sie erhält `BrowserContext.surface: 'hero'`. Die Sektion erscheint dort genau einmal und bleibt über ihre ID in der Navigation erreichbar.

Der persönliche Header zeigt links die große Begrüßung als Hauptüberschrift und den bestätigten Dienststatus, rechts das freigestellte Porträt. Das Porträt hat immer einen runden unteren Ausschnitt mit einem Kreisrahmen in den Kundenfarben; der Kopf ragt darüber hinaus. Unter dem Porträt stehen Name und Diensthinweis. Zusätzliche Serviceportal-Überschriften entfallen; die Kundenidentität bleibt über das Logo und den Namen in Navigation und Fußzeile sichtbar. Auf kleinen Bildschirmen folgt das Porträt auf die Begrüßung. Fehlende Bilder zeigen Initialen.

SIGNL4 stellt die aktuelle Schichtperson aus `/schedule` dar, mit Bild aus den Avatar-Zuordnungen oder `/team`. Überlappende Schichten nennen weitere zuständige Personen. Schichtwechsel werden jede Sekunde geprüft; Daten werden im konfigurierten Intervall neu geladen. Bei veralteten oder fehlenden Schichtdaten wird keine Zuständigkeit bestätigt.

Ohne aktive Schicht nennt der Header den frühesten gültigen zukünftigen Beginn. Heute, morgen und übermorgen werden nach dem Kalendertag der Schicht-Zeitzone berechnet, auch beim Wechsel der Sommerzeit. Für spätere Schichten erscheint ein Datum. Ohne geplanten Beginn wird keine Rückkehrzeit erfunden.

Das Chat-Plugin zeigt im Header das Eingabefeld und den Sitzungsverlauf. Es kennzeichnet automatische Antworten als digitalen Assistenten; persönlicher Kontakt bleibt über die Hotline möglich. Ohne Chat-Plugin entsteht kein Eingabefeld. Die Demo enthält fünf synthetische Personen und freigestellte Beispielbilder unter `apps/demo/public/team`.

### Chat-Eingabe

Im Chat-Textfeld sendet `⌘ + Enter` auf macOS bzw. `Strg + Enter` auf anderen Systemen die Nachricht über denselben Ablauf wie die Senden-Schaltfläche. `Enter` allein fügt einen Zeilenumbruch ein. Der dezente Hinweis zeigt das passende Tastenkürzel des Systems und steht unten rechts innerhalb des Textfelds und ist als Eingabebeschreibung zugänglich. Leere Nachrichten und Tastenkürzel während einer laufenden Antwort werden nicht gesendet.

Das Eingabefeld beginnt mit einer Textzeile und wächst automatisch bei Zeilenumbrüchen oder umgebrochenem Text. Nach dem Kürzen oder Absenden schrumpft es wieder; Breitenänderungen werden ebenfalls berücksichtigt.

Beim Laden der Seite erhält das Chat-Textfeld automatisch den Fokus, sodass direkt geschrieben werden kann.
