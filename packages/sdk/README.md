# @kieksme/csp-sdk

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

Browser plugins may provide `hero: ComponentType<BrowserContext>`. Sections can opt into the header with `placement: 'hero'`; Core passes `surface: 'hero'` when rendering them there. These optional fields preserve existing plugins. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

Chat-Antworten verwenden die aktuelle Bereitschaftsperson in Ich-Form, mit Name und Kennzeichnung als digitaler Assistent. Ohne bestätigte Bereitschaft antwortet das Service-Team. Dienststatus wird nur für passende Monitore bestätigt; Ticketquellen werden als direkte Links angezeigt. Details: [Chat-Vertrag](../../docs/plugin-sdk.md#persönliche-chat-antworten).
