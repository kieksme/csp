# CSP Slack plugin

Optional Slack support for authenticated portal conversations: one channel thread per chat, explicit human takeover, assigned-person replies, bot return and close. Requires the CSP chat plugin, Entra portal identity and PostgreSQL. Slack support authorization uses an explicit user allowlist plus current channel membership.

In a standalone customer repository, after package publication:

```sh
pnpm dlx @kieksme/csp-cli plugin add @kieksme/csp-plugin-slack
```

Set `chatSupport.mode` to `slack`, configure the API-only values in `templates/customer/.env.slack.example`, install the **Support** Slack app from `slack-app/manifest.example.json`, invite its bot to the configured channel, and rebuild frontend/API. Configure Events `/api/slack/events` and Interactivity `/api/slack/actions` on the public HTTPS API host. Keep all credentials in the API secret store. Use exactly one support transport and one API replica per database.

[Complete setup, permissions, limits and live acceptance](../../docs/slack-support.md). The Slack workspace integration is **not yet live-tested**. Synthetic demo and automated tests do not establish real workspace connectivity.
