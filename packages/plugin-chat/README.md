# @kieksme/csp-plugin-chat

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

The question field and session history appear once in the service header. Automatic replies are labelled as a digital assistant; the hotline remains the route for personal contact. The assistant stays available between shifts. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

For local provider testing, set `CSP_DEMO=true` and `CSP_CHAT_DEMO=false`: portal sources remain synthetic while the configured provider streams real answers. Without `CSP_CHAT_DEMO`, the chat inherits the global demo mode. Model/provider configuration is required for real chat. See [configuration](../../docs/configuration.md#ki-provider).

Langsame lokale Modelle können mit der Runtime-Variable `CSP_CHAT_TIMEOUT_MS` mehr Antwortzeit erhalten (Standard `60000`, Bereich `1000`–`300000` ms).

Send a message with Cmd + Enter on macOS, Ctrl + Enter on other systems, or the send button. The hint displays the system-specific shortcut. Plain Enter inserts a line break. A subtle shortcut hint appears at the bottom right inside the text field; blank messages and shortcuts during an active reply do not send.

The input starts with one text row and automatically grows with wrapped text or line breaks. It shrinks when text is removed or sent and adjusts when its width changes.

The chat input receives focus automatically when the page loads.

Chat-Antworten sprechen in Ich-Form als digitaler Assistent der aktuellen Bereitschaftsperson; die Beschriftung lautet „Digitaler Assistent von …“. Passende Support-Antworten bieten belegte Kontakte zur Person oder zum Support-Team an, ohne persönliche Handlungen zu behaupten. Ohne bestätigte Bereitschaft antwortet das Service-Team. Dienststatus wird nur für passende Monitore bestätigt; Ticketquellen werden als direkte Links angezeigt. Details: [Chat-Vertrag](../../docs/plugin-sdk.md#persönliche-chat-antworten).

Der Assistent unterscheidet das Unternehmen von seinem Serviceportal: „Serviceportal von Thinkport“ statt „Thinkport ist ein Serviceportal“. Aussagen über Funktionen stammen ausschließlich aus den vorhandenen Portalquellen.

Der System-Prompt begrenzt den Chat auf Support und Portalbedienung. Fachfremde Aufgaben werden kurz zum Support-Zweck zurückgeführt; unklare Anliegen werden durch eine Rückfrage eingeordnet.

Optional persisted conversations and real human support are available through the Teams plugin. The UI uses `chatSupport` from the public profile and identifies real support separately from the digital assistant. See [Teams support](../../docs/teams-support.md).

For portals with an existing same-origin authenticated gateway, set `chatSupport.auth` to `session` to reuse the login without browser tokens. The API still requires a validated delegated access token supplied by the internal gateway. See [Teams support](../../docs/teams-support.md#vorhandene-portal-anmeldung-verwenden).

WebMCP tool: `chat_ask` streams one answer from `POST /api/v1/chat` and returns text, responder and sources. It changes no data but uses the chat rate limit and provider quota, so it is not marked read-only. See [WebMCP](../../docs/webmcp.md).
