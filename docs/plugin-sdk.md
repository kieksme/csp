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

Das fokussierte Chat-Feld verwendet einen dezenten Rahmen von 1 px in der sekundären Textfarbe mit 2 px Abstand. Er folgt dem aktiven Farbschema.

### FAQ-Kategorien

Die Kategorie-Chips sind abgerundete Schaltflächen mit 40 px Mindesthöhe, klarer Schrift und einer geschlossenen Kontur. Die aktive Kategorie trägt die Akzentfarbe; Hover und Tastaturfokus sind gesondert erkennbar. Farben folgen dem hellen bzw. dunklen Design.

Der Porträtkreis verwendet die aktuelle Marken-Akzentfarbe mit 35 % Deckkraft; sein Rahmen verwendet dieselbe Farbe mit 50 %. Design-Schalter und FAQ-Chips teilen dezente, zum Farbschema passende Schatten und verstärken diese beim Hover.

### Dekorativer Header-Hintergrund

Die gesamte `.hero`-Fläche, einschließlich Begrüßung, Porträt und Chat, unterstützt eine austauschbare Hintergrundgrafik über `--hero-background-image` im Kunden-Stylesheet. Ohne Angabe bleibt die Hintergrundfarbe erhalten. Beispiel:

```css
.hero {
  --hero-background-image: url('../public/header-waves.svg');
}
```

Die Grafik wird mittig mit `cover` skaliert und an den abgerundeten Header-Rändern abgeschnitten. SVGs können transparent bleiben; Linien sollten hinter Texten zurückhaltend sein. Als rein dekorativer CSS-Hintergrund benötigt die Grafik keinen Alternativtext. Die lokale Asset-URL wird durch Vite im Entwicklungsserver und Build aufgelöst.

### Persönliche Chat-Antworten

Der konfigurierte Name bezeichnet das Unternehmen. Der Assistent beschreibt die Oberfläche als dessen Serviceportal, beispielsweise „Sie befinden sich auf dem Serviceportal von Thinkport“. Er bezeichnet das Unternehmen selbst nicht als Serviceportal und nennt nur Funktionen, die durch die Portalquellen belegt sind.

Der System-Prompt begrenzt Antworten auf technische Support-Anliegen, Dienststatus, Zugänge, Service-Anfragen, Tickets, Kontakte und die Bedienung des Portals. Eindeutig fachfremde Aufgaben wie Unterhaltung, Rezepte oder allgemeine Text- und Programmieraufträge werden nicht beantwortet; der Assistent verweist kurz auf den Support-Zweck. Bei unklarem Bezug fragt er nach dem betroffenen Dienst oder Problem und behandelt bei gemischten Anliegen nur den Support-Anteil. Die Erwähnung eines Unternehmens- oder Dienstnamens erweitert diesen Aufgabenbereich nicht. Diese modellgestützte Themenbegrenzung ersetzt nicht Authentifizierung, Anfragebegrenzung oder serverseitige Eingabevalidierung.

Der Chat antwortet in Ich-Form als digitaler Assistent der im Header ausgewählten Bereitschaftsperson. Die Antwort zeigt „Digitaler Assistent von …“; ohne bestätigte Person lautet die Beschriftung „Digitaler Assistent des Service-Teams“. Passende Support-Antworten bieten ausschließlich belegte persönliche Kontakte oder den Team-Kontakt an und behaupten keine menschlichen Handlungen; der Hinweis auf automatische Antworten bleibt sichtbar. Ohne bestätigte aktive Schicht antwortet das Service-Team in Wir-Form. Fehlende oder veraltete Schichtdaten bestätigen keine Bereitschaft. Ein nächster Schichtbeginn wird nur aus bestätigten Daten genannt.

Das SDK exportiert `ChatResponder` (`name: string | null`, `role: 'on-duty' | 'service-team'`) sowie `dutyState(shifts, now)` und `nextShiftLabel(start, now, timezone)`. Header und Chat verwenden damit dieselbe Schichtauswahl: frühester aktiver Beginn, dann Benutzer-ID, jeweils nur eine Schicht pro Person. Die Auswahl erfolgt je Antwort; ältere Antworten behalten ihren Absender und ihre Quellen.

Statusauskünfte beziehen sich ausschließlich auf einen zum Problem passenden Monitor. Bei konkreten Dienstproblemen erhält das Modell nur passende Monitorwerte; E-Mail-Fragen werden auf E-Mail-, Gmail-, Outlook-, Exchange-, IMAP- oder SMTP-Monitore begrenzt. Allgemeine Statusfragen dürfen die Gesamtübersicht verwenden. Ein verfügbarer Monitor bestätigt nicht die Funktion beim Benutzer. Bei fehlendem, unbekanntem oder veraltetem Status wird die fehlende Bestätigung ausdrücklich genannt. Passende Ticketquellen erscheinen als direkte Links in der Antwort. Der Chat legt keine Tickets an und behauptet keine persönliche Prüfung. Synthetische und statische Demos bleiben ausdrücklich gekennzeichnet; ihre Daten werden dadurch nicht erweitert.

## Chat-Engine und Support-Plugin

`ServerContext.chat` ist optional und wird vom Chat-Plugin als `ChatEngine` mit `stream(messages, signal)` bereitgestellt. Ereignisse: `responder`, `sources`, `delta`, `done`. Der Core initialisiert `requires` vor dem abhängigen Plugin und lehnt zyklische Abhängigkeiten ab. `PublicConfig.chatSupport` wählt die gespeicherte Support-UI; `ChatResponder` beschreibt weiter nur KI-Absender. Menschliche Absender werden durch Support-Nachrichten getrennt gekennzeichnet. Siehe [Teams-Support](teams-support.md).
