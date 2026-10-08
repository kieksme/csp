# @kieksme/csp-plugin-signl4

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

The plugin supplies the service header with the confirmed on-duty person and their configured or provider avatar. When no shift is active, it shows the next scheduled start in the schedule timezone; missing or stale data never confirms availability. Overlapping shifts list additional on-duty people. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

The customer portal name appears above the personal greeting, explicitly labeled as a service portal. A large greeting sits on the left, with an unframed transparent portrait on the right and the confirmed duty badge below it. On mobile the portrait follows the greeting.
