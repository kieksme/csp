# @kieksme/csp-plugin-signl4

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

The plugin supplies the service header with the confirmed on-duty person and their configured or provider avatar. When no shift is active, it shows the next scheduled start in the schedule timezone; missing or stale data never confirms availability. Overlapping shifts list additional on-duty people. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

A large personal greeting is the main heading on the left. The portrait on the right always uses a circular lower crop and frame, with the transparent head extending above it. There are no additional service-portal headings; customer branding remains in navigation and footer. On mobile the portrait follows the greeting.

WebMCP tools (read-only): `signl4_get_on_duty`, `signl4_get_shift_schedule`, `signl4_list_team`, `signl4_get_vcard`, `signl4_list_alerts`. Stale schedule or team data is never reported as confirmed availability. See [WebMCP](../../docs/webmcp.md).
