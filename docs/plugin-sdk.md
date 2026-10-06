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
    "sdkVersion": "^0.1.0",
    "requires": [],
    "browser": "./browser",
    "server": "./server"
  }
}
```

Die ID, SDK-Version und optionalen `requires` müssen in Manifest und beiden Exporten übereinstimmen. Abhängigkeiten im Manifest beziehen sich auf Plugin-IDs, nicht npm-Paketnamen. Core prüft ID-Eindeutigkeit, SDK-Kompatibilität und Abhängigkeiten beim Start; CLI prüft vor dem Schreiben der Registrierung.

```tsx
// browser.tsx
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
  sdkVersion: '^0.1.0',
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
import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
export default {
  id: 'my-service',
  sdkVersion: '^0.1.0',
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
