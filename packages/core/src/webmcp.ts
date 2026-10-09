import { useEffect } from 'react';
import {
  findModelContext,
  registerWebMcpTools,
  webMcpJson,
  type BrowserContext,
  type BrowserPlugin,
  type PublicConfig,
  type WebMcpTool,
} from '@kieksme/csp-sdk';

/** Portal-level tool; plugin tools come from `BrowserPlugin.tools`. */
export function coreTools(
  config: PublicConfig,
  plugins: BrowserPlugin[],
): WebMcpTool[] {
  return [
    {
      name: 'portal_get_info',
      description:
        'Beschreibt dieses Customer Service Portal: Name, Beschreibung, Demo-Modus und die verfügbaren Bereiche (Plugins).',
      inputSchema: {
        type: 'object',
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute: () =>
        webMcpJson({
          name: config.name,
          tagline: config.tagline,
          description: config.description,
          demo: config.demo,
          plugins: plugins.map((p) => p.id),
          sections: plugins.flatMap((p) =>
            p.sections.map((s) => ({ id: s.id, label: s.label })),
          ),
          tools: [
            'portal_get_info',
            ...plugins.flatMap((p) => (p.tools ?? []).map((t) => t.name)),
          ],
        }),
    },
  ];
}

/**
 * Registers the portal and plugin tools with WebMCP. Opt-out via
 * `config.webmcp === false`; a no-op in browsers without WebMCP.
 */
export function useWebMcp(
  config: PublicConfig,
  plugins: BrowserPlugin[],
  ctx: BrowserContext,
) {
  const { api, request } = ctx;
  useEffect(() => {
    if (config.webmcp === false) return;
    const modelContext = findModelContext();
    if (!modelContext) return;
    return registerWebMcpTools(
      modelContext,
      [...coreTools(config, plugins), ...plugins.flatMap((p) => p.tools ?? [])],
      { config, api, request },
    );
  }, [config, plugins, api, request]);
}
