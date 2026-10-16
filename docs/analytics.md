# Swetrix analytics

Install `@kieksme/csp-plugin-swetrix` through the CSP CLI, add `analytics.swetrix` to the customer profile, allow the public portal hostname in Swetrix, and rebuild. The plugin is an invisible browser integration and adds no API routes or UI sections. Other customers remain untracked unless they install and configure it.

The public project ID and ingestion endpoint belong in the profile; administrative API keys belong only in the Swetrix MCP configuration. See [configuration](configuration.md) and the [plugin README](https://github.com/kieksme/csp/blob/main/packages/plugin-swetrix/README.md).

## Events and funnels

The portal emits typed semantic events through `emitAnalytics` from `@kieksme/csp-sdk/browser`. The optional `BrowserPlugin.integration` component receives `BrowserContext`, is mounted with the portal and owns its effect cleanup. Without an analytics integration, emitted events have no transport.

| Funnel                  | Ordered event steps                                                       |
| ----------------------- | ------------------------------------------------------------------------- |
| Self-help before ticket | `PORTAL_VIEW` → `FAQ_OPEN` → `TICKET_CLICK`                               |
| FAQ to contact          | `FAQ_OPEN` → `CONTACT_CLICK`                                              |
| Status to contact       | `STATUS_CLICK` → `CONTACT_CLICK`                                          |
| Chat to answer          | `CHAT_OPEN` → `CHAT_MESSAGE_SENT` → `CHAT_REPLY_RECEIVED`                 |
| Support to resolution   | `CHAT_MESSAGE_SENT` → `HUMAN_SUPPORT_REQUESTED` → `CONVERSATION_RESOLVED` |

Use Swetrix MCP to create a project, configure private dashboard visibility and allowed origins, and create these funnels. The installed self-hosted version accepts event names as funnel steps. The support funnel applies to human support chat; bot-only chat does not produce human handovers. A ticket click measures opening the external ticket tool, not successful ticket creation.

## Data and verification

The adapter calls the official Swetrix Events API directly, avoiding the general-purpose SDK's automatic query/UTM collection. It sends only pathname, locale, timezone and bounded semantic metadata. No profile identifiers, chat/search contents, contact details, query parameters, referrers, cookies, automatic errors or replays. Local development and DNT are suppressed by default. There is no offline replay queue, retry or automatic heartbeat; blocked analytics does not interrupt the portal.

For deployment verification, perform actual FAQ, ticket, contact and chat actions in the published portal. Inspect browser requests and read back custom events and metadata through Swetrix MCP. Project/funnel readback verifies configuration only; event counts verify delivery; metadata readback verifies persistence; funnel conversions require matching ordered activity from the same visitor. Keep these claims distinct.

Pageview deduplication is local to a document load. Repeated visits send normal pageviews without the Events API `unique` flag, so Swetrix can count revisits instead of rejecting them with HTTP 403.
