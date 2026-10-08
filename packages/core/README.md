# @kieksme/csp-core

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

Core and bundled plugins declare Tailwind utility classes directly in JSX. Core compiles all package JSX into the distributed CSS; customers do not need Tailwind or a CSS build configuration. Theme tokens remain CSS variables, including quarter-step spacing and responsive layouts. Semantic DOM hooks remain available for tests and integrations.

The service header renders an optional plugin hero and sections marked `placement: 'hero'`. Without a hero plugin it keeps the configured tagline. Header sections stay reachable from navigation and are omitted from the body to prevent duplicate forms. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

The SIGNL4 hero shows the customer portal name above a large greeting and an unframed cutout portrait.
