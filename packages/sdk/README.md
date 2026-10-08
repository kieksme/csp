# @kieksme/csp-sdk

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

Browser plugins may provide `hero: ComponentType<BrowserContext>`. Sections can opt into the header with `placement: 'hero'`; Core passes `surface: 'hero'` when rendering them there. These optional fields preserve existing plugins. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).
