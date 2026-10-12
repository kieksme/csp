# @kieksme/csp-plugin-teams

Optional Teams support for the CSP chat: authenticated persisted conversations, one channel thread per conversation, explicit human takeover, direct replies from the assigned support person, release and closure.

Requires the chat plugin, single-tenant Entra registrations, PostgreSQL and a Teams app installed in a standard channel. Disabled by default. See [installation, configuration, API and demo](../../docs/teams-support.md) and [runtime configuration](../../docs/configuration.md#teams-support).

Local synthetic support demo works without Microsoft credentials. Live Microsoft connectivity must be verified separately before activation.

Set `CSP_TEAMS_SUPPORT_AUTH=team` when support uses the team Microsoft 365 group. Membership can then be checked with team-scoped `TeamMember.Read.Group` RSC instead of tenant-wide directory read permissions. Arbitrary Entra groups retain the default `group` mode.

Conversation state, Entra portal authentication and persistence are shared through the server-only `@kieksme/csp-core/support` export with the optional Slack transport. Install exactly one support transport per instance.

The app is named **Support**. `teams-app/color.png` (192×192) and `outline.png` (32×32, white on transparent) provide the shared headset assistant avatar; editable SVG sources are included. Include the PNGs at the root of the Teams installation ZIP. Existing Developer Portal apps need both icons updated and saved; organization approval/installation remains a separate step. The Slack variant is `packages/plugin-slack/slack-app/avatar.png` (512×512).
