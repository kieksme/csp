# CSP Swetrix plugin

Anonymous portal analytics for Swetrix Cloud or a self-hosted Events API.

Install using `csp plugin add @kieksme/csp-plugin-swetrix` and add this public, build-time profile configuration:

```json
{
  "analytics": {
    "swetrix": {
      "projectId": "YOUR_PROJECT_ID",
      "apiUrl": "https://analytics.example.org/log",
      "enabled": true,
      "variant": "main",
      "respectDNT": true
    }
  }
}
```

No API key is required in the portal. Configure the project's allowed origins in Swetrix. Localhost, loopback addresses, disabled tracking and Do Not Track prevent requests. Remove the plugin or set `enabled: false` and rebuild to disable analytics.

The plugin uses a bundled, minimal adapter to the Swetrix Events API. It sends one pageview and `PORTAL_VIEW` per portal variant/path per page load. `SECTION_VIEW` requires 50% visibility for one continuous second. `CHAT_OPEN` records the first focus or click in a chat panel.

Semantic events: `FAQ_OPEN`, `TICKET_CLICK`, `PROCESS_CLICK`, `STATUS_CLICK`, `CONTACT_CLICK`, `CHAT_MESSAGE_SENT`, `CHAT_REPLY_RECEIVED`, `HUMAN_SUPPORT_REQUESTED`, `CONVERSATION_RESOLVED`. Chat success events require confirmed API responses or completed incoming messages. Restored chat history is not counted as new replies.

Only variant, section, FAQ/process IDs, contact channel and chat mode are sent as event metadata. IDs must be non-personal, 1–64 letters, numbers, underscores or hyphens. No message text, search terms, query strings, referrers, contact details, profile IDs, cookies or session replay are sent. Request failures are ignored without affecting portal actions. Direct anonymous tracking starts without an additional consent interface; DNT defaults to respected.

Create projects and funnels administratively through Swetrix MCP. Events appear after real interactions; registering names with fabricated conversions is unnecessary. See [analytics documentation](../../docs/analytics.md) for suggested funnels and verification.

Repeated visits send normal pageviews. Deduplication is scoped to one document load and does not use the API’s cross-visit `unique` flag.
