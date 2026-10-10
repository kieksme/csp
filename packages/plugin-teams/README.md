# @kieksme/csp-plugin-teams

Optional Teams support for the CSP chat: authenticated persisted conversations, one channel thread per conversation, explicit human takeover, direct replies from the assigned support person, release and closure.

Requires the chat plugin, single-tenant Entra registrations, PostgreSQL and a Teams app installed in a standard channel. Disabled by default. See [installation, configuration, API and demo](../../docs/teams-support.md) and [runtime configuration](../../docs/configuration.md#teams-support).

Local synthetic support demo works without Microsoft credentials. Live Microsoft connectivity must be verified separately before activation.

Set `CSP_TEAMS_SUPPORT_AUTH=team` when support uses the team Microsoft 365 group. Membership can then be checked with team-scoped `TeamMember.Read.Group` RSC instead of tenant-wide directory read permissions. Arbitrary Entra groups retain the default `group` mode.
