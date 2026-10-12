# Chat bedienen und persönlichen Support anfragen

Das Chat-Plugin stellt dieselbe Eingabe und denselben Verlauf für den KI-Chat und für Gespräche mit einem Support-Transport bereit. Acme bleibt eine offene Webseite mit anonymer Gesprächssitzung.

## Gestaltung

Beide Chat-Modi verwenden einen gemeinsamen Kopf mit Service-Chat, Gesprächsstatus und Hinweisen zur Weiterleitung. Eigene Nachrichten stehen rechts auf einer abgesetzten Fläche; Assistent und Support antworten links mit sichtbarem Absender. Übernommene Support-Antworten haben zusätzlich eine farbige Seitenmarkierung. Statusänderungen bleiben als Text erkennbar.

Eingabe, Senden, Tastenkürzel und optionale Spracheingabe bilden einen zusammenhängenden Bereich. Der Mikrofon-Button zeigt nur das Symbol und steht direkt links neben **Senden** in der Bedienleiste unter dem Textfeld. Der Hinweis zur Texterkennung steht dezent darunter. Alle Eingabebuttons bleiben in einer Zeile und sind 44 px hoch; Mikrofon, Aufnahme stoppen und Abbrechen verwenden zugänglich beschriftete Symbole mit 44 × 44 px Touchfläche. Persönlicher Support und „Problem gelöst“ bleiben als separate Aktionen erreichbar. Die Gestaltung folgt den Kundenfarben und unterstützt helle sowie dunkle Darstellung und schmale Bildschirme.

## Eingabe und Verlauf

`⌘ Enter` auf macOS beziehungsweise `Strg Enter` auf Windows/Linux sendet über denselben Ablauf wie der Senden-Button. Der Hinweis steht innerhalb des Eingabefelds unten rechts, mit reserviertem Platz unter dem bearbeitbaren Text, und ist als Eingabebeschreibung zugänglich. `Enter` allein fügt einen Zeilenumbruch ein. Leere Eingaben, wiederholte Tastendrücke, IME-Komposition und bereits laufende Sendevorgänge lösen keine weitere Nachricht aus.

Der Verlauf ist per Tab-Taste erreichbar und lässt sich mit den Pfeiltasten scrollen. Der Verlauf ist maximal 400 px beziehungsweise 45 Prozent der dynamischen Bildschirmhöhe hoch. Das Eingabefeld bleibt außerhalb des scrollbaren Verlaufs und ist auf 180 px begrenzt. Am Ende folgt der Verlauf neuen Nachrichten und gestreamten Antworten. Wer mehr als 80 px hochscrollt, behält seine Leseposition; **Neue Nachrichten ↓** führt wieder ans Ende. Eigene gesendete Nachrichten und ein neuer oder wiederhergestellter Chat führen ans Ende.

## Diktieren

Bei einem echten OpenAI-Provider und aktivierter Transkription erscheint ein kompakter Mikrofon-Button mit Tooltip und zugänglichem Namen **Nachricht diktieren**, sofern der Browser Mikrofonzugriff und eine unterstützte MediaRecorder-Aufnahme anbietet. Erst der Klick startet die Mikrofonfreigabe. Aufnahme stoppen lädt die Aufnahme zur Texterkennung über die API an OpenAI; Abbrechen verwirft sie. Nach spätestens 60 Sekunden stoppt die Aufnahme automatisch. Mikrofonspuren werden bei Stop, Abbruch, Gesprächsabschluss und Verlassen der Komponente freigegeben.

Das Transkript ergänzt den aktuellen Entwurf. Es erzeugt weder eine Gesprächsnachricht noch eine KI-Anfrage: Der Benutzer prüft, bearbeitet und sendet selbst. Mikrofon-, Upload- und Providerfehler erhalten den bisherigen Entwurf. Ein Transkript, das den Entwurf über 4000 Zeichen verlängern würde, wird mit einem Hinweis abgelehnt. Es gibt keine Audioantwort und keine dauerhafte Speicherung der Audiodatei im Portal.

- `GET /api/v1/chat/capabilities`: `{ transcription, maxRecordingSeconds: 60, maxAudioBytes: 10485760 }`; keine Schlüssel oder Accountdaten.
- `POST /api/v1/chat/transcriptions`: Binärbody mit passendem `Content-Type` (`audio/webm`, `audio/mp4`, `video/mp4`, `audio/ogg`, `audio/wav`, `audio/mpeg`). Erfolgreiche Antwort `{ text }`. Formatkopf wird geprüft; maximal 10 MiB.
- Mit Support-Transport gilt dieselbe Authentifizierung wie für die Gesprächs-API, einschließlich anonymer Sitzung oder vorhandener Portal-Anmeldung. Ohne Transport gilt das öffentliche Chat-Modell. IP und gegebenenfalls Sitzungsidentität teilen die Transkriptionsquote; Parallelität und Timeout entsprechen den dokumentierten Chat-Limits.
- `401` fehlt/ungültige Anmeldung, `404` Transkription deaktiviert, `400` ungültige Aufnahme, `413` zu groß, `415` nicht unterstützter Content-Type, `422` leerer/zu langer Text, `429` Quote/Parallelität, `503` Providerfehler, `504` Zeitlimit. Audiodaten und Providerfehlermeldungen werden nicht geloggt.

## Persönlichen Support anfragen

Mit einem Support-Transport ist **Ich möchte mit einer echten Person sprechen** im KI-Modus sichtbar, auch vor der ersten Nachricht. Ohne Support-Transport bleibt die Hotline der persönliche Kontakt.

`POST /api/v1/conversations/:id/request-support` nimmt nur ein leeres JSON-Objekt an und prüft den Gesprächseigentümer. Fehlende Anmeldung führt zu `401`, fremde Gespräche zu `404`, abgeschlossene Gespräche zu `409`. Wiederholte Anfragen im Warte- oder Supportmodus erzeugen keine zweite Anfrage.

Das Gespräch wechselt atomar von `bot` nach `waiting`. Laufende KI-Ausgabe wird unterbrochen; weitere Besuchernachrichten werden weitergeleitet, ohne neue KI-Generierung. Der Wartezustand und die Anfrage bleiben nach Neuladen und API-Neustart erhalten. Erst eine berechtigte Person kann das Gespräch atomar übernehmen (`support`). Nur ihre Antworten gehen an den Besucher. Rückgabe aktiviert ausdrücklich wieder den Bot; Schließen und **Problem gelöst** bleiben eigenständige Abläufe.

Die gespeicherte Outbox sendet eine hervorgehobene Anfrage samt Übernahme-Button an den zugeordneten Thread bzw. das Telegram-Thema. `supportRequest.notification` ist `pending`, `sent` nach bestätigter Zustellung oder `failed` bei einem Fehler mit weiterlaufender Wiederholung. „Informiert“ bestätigt die Plattformzustellung, nicht das Lesen oder eine Antwortzeit. Eine Übernahme nennt erst danach die tatsächliche Supportperson. Nach Übernahme, Rückgabe oder Abschluss wird auch die zusätzliche Benachrichtigung aktualisiert; ihr Übernahme-Button entfällt. Benachrichtigungsbuttons werden nur aus dem gespeicherten Channel und der gespeicherten Karte akzeptiert. Externe Zustellung bleibt bei verlorenen Bestätigungen mindestens einmal; keine Exactly-once-Zusage.

Echte, aktuelle SIGNL4-Schichten liefern die Dienstidentitäten. Die API ordnet sie über `CSP_SUPPORT_DUTY_USER_MAP` den Accounts des aktiven Transports zu. Demo-Schichten registrieren keinen Dienstresolver. Fehlende, veraltete oder nicht zugeordnete Dienstinformationen verwenden `CSP_SUPPORT_FALLBACK_USER_IDS`; ohne gültigen berechtigten Account wird der Channel ohne Erwähnung informiert. Mitgliedschaft und Supportberechtigung werden vor gezielten Erwähnungen erneut geprüft. Acme verwendet André als feste Vertretung; die Beispielperson Lena ist keine reale Bereitschaft.

Slack zeigt Besuchernachrichten als [Rich-Text-Zitat](https://docs.slack.dev/reference/block-kit/blocks/rich-text-block/) unter **Besucher · Name**. Teams zeigt dieselben Inhalte [kursiv](https://learn.microsoft.com/en-us/microsoftteams/platform/bots/how-to/format-your-bot-messages) unter einem Besucher-Label. Besuchertext wird weder als Erwähnung noch als eigenes Markup interpretiert. KI-Antworten in Slack und Teams beginnen mit **🤖**; echte Support-Antworten tragen weiterhin den Namen. Im Portal bleibt die Kennzeichnung als digitaler Assistent sichtbar.

Konfiguration: [Runtime-Optionen](configuration.md#spracheingabe-und-supportanfragen). Einrichtung: [Slack](slack-support.md), [Teams](teams-support.md), [Telegram](telegram-support.md).
