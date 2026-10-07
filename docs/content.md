# Inhalte

Das Content-Plugin stellt Prozesse, Ticketlinks und FAQ bereit. `CSP_CONTENT_PATH` zeigt auf eine JSON-Datei relativ zum Arbeitsverzeichnis der Kundeninstanz, in der Vorlage `content.json`.

## Dateiformat

```json
{
  "processes": [
    {
      "id": "incident",
      "title": "Störung melden",
      "text": "Bei einer dringenden Störung **Hotline anrufen**.",
      "href": "https://support.example.invalid/process"
    }
  ],
  "tickets": [
    {
      "title": "Support-Ticket",
      "description": "Für nicht dringende Anfragen.",
      "href": "https://support.example.invalid/tickets/new",
      "template": "Betroffener Dienst:\nAuswirkung:\nBeginn:\n"
    }
  ],
  "faq": [
    {
      "id": "availability",
      "category": "Kontakt",
      "question": "Wie erreiche ich das Team?",
      "answer": "Nutzen Sie die im Portal angegebene Hotline."
    }
  ]
}
```

| Bereich     | Pflichtfelder                          | Optionale Felder |
| ----------- | -------------------------------------- | ---------------- |
| `processes` | `id`, `title`, `text`                  | `href`           |
| `tickets`   | `title`, `description`, `href`         | `template`       |
| `faq`       | `id`, `category`, `question`, `answer` | Keine            |

Fehlende Bereiche werden zu leeren Arrays. Vorhandene Einträge müssen das SDK-Schema erfüllen. Prozess- und Ticketlinks benötigen absolute HTTP(S)-URLs ohne Zugangsdaten. Stabile, eindeutige IDs verwenden, damit Quellen und UI-Elemente unterscheidbar bleiben.

## Darstellung und Chat

Prozesstexte und FAQ-Antworten unterstützen Markdown; eingebettetes HTML wird nicht ausgeführt. Ticketvorlagen bleiben einfacher Text und können kopiert werden. Links führen ins externe Ticketsystem; das Portal legt selbst keine Tickets an.

Das Server-Plugin stellt Quellen mit IDs `process:<id>`, `faq:<id>` und `ticket:<index>` bereit. Der Chat kombiniert diese mit den Wissensquellen anderer installierter Plugins. Seine Antworten sind keine Bestätigung einer ausgeführten Aktion.

## Änderungen veröffentlichen

JSON bearbeiten und Frontend neu bauen: Der Build validiert die Datei und bettet die Inhalte in die öffentliche Konfiguration ein. Die API lädt dieselbe Datei beim Start; deshalb deren Kopie im API-Deployment aktualisieren und den Prozess neu starten. Frontend und API sollten denselben Inhaltsstand verwenden.

Inhalte sind öffentlich und können an den konfigurierten KI-Provider übermittelt werden. Interne Zugangsdaten oder vertrauliche Anweisungen gehören nicht in diese Datei.

Weiter: [Konfiguration](configuration.md), [Deployment](deployment.md), [Sicherheit und Daten](security.md).
