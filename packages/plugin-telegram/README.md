# @kieksme/csp-plugin-telegram

Eigenständiges CSP-Support-Plugin: ein Telegram-Forum-Thema je Portal-Chat, menschliche Übernahme, Antworten der zuständigen Person und manuelle Rückgabe oder Abschluss. Benötigt `chat`, PostgreSQL, einen Bot mit Themenrechten und eine private Forum-Supergruppe.

Installation nach Veröffentlichung:

```sh
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-telegram
```

Offene Webseiten verwenden `chatSupport: { "mode": "telegram", "auth": "anonymous" }`; alternativ Entra-Login. Bot-Token und Webhook-Secret gehören ausschließlich auf den API-Host. Genau ein Supporttransport je Instanz.

[Einrichtung, Rechte, Architektur und Grenzen](https://github.com/kieksme/csp/wiki/telegram-support). Reale Telegram-Verbindung **noch ungetestet**; automatisierte Prüfungen verwenden synthetische Antworten.

Explicit human requests use the shared persistent waiting state and directed notifications, with current support membership checks. See [shared chat behaviour](../../docs/chat.md).
