# @kieksme/csp-plugin-chat

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

The question field and session history appear once in the service header. Automatic replies are labelled as a digital assistant; the hotline remains the route for personal contact. The assistant stays available between shifts. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

For local provider testing, set `CSP_DEMO=true` and `CSP_CHAT_DEMO=false`: portal sources remain synthetic while the configured provider streams real answers. Without `CSP_CHAT_DEMO`, the chat inherits the global demo mode. Model/provider configuration is required for real chat. See [configuration](../../docs/configuration.md#ki-provider).

Langsame lokale Modelle können mit der Runtime-Variable `CSP_CHAT_TIMEOUT_MS` mehr Antwortzeit erhalten (Standard `60000`, Bereich `1000`–`300000` ms).
