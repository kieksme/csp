# @kieksme/csp-core

Part of the Customer Service Portal. See the product README and docs/plugin-sdk.md for configuration and usage.

Core and bundled plugins declare Tailwind utility classes directly in JSX. Core compiles all package JSX into the distributed CSS; customers do not need Tailwind or a CSS build configuration. Theme tokens remain CSS variables, including quarter-step spacing and responsive layouts. Semantic DOM hooks remain available for tests and integrations.

The service header renders an optional plugin hero and sections marked `placement: 'hero'`. Without a hero plugin it keeps the configured tagline. Header sections stay reachable from navigation and are omitted from the body to prevent duplicate forms. See [the header contract](../../docs/plugin-sdk.md#persönlicher-header).

The SIGNL4 hero shows a large personal greeting beside a portrait with a circular lower crop and frame, without additional service-portal headings.

The chat input has a subtle 1px focus outline in the theme-muted text color, offset by 2px.

FAQ category chips use rounded, theme-aware surfaces with distinct selected, hover and keyboard-focus states and a 40px minimum height.

Duty portrait circles use the customer accent at 35% opacity with a 50% accent border. Theme buttons and FAQ chips share subtle theme-aware shadows and hover elevation.

Set `--hero-background-image` in the customer stylesheet to add a decorative image across the entire service header. It defaults to `none`; local SVG/image URLs are resolved by the frontend build. See docs/plugin-sdk.md and docs/configuration.md.
