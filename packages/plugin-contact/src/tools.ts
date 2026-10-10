import { webMcpJson, type WebMcpTool } from '@kieksme/csp-sdk';

export const contactTools: WebMcpTool[] = [
  {
    name: 'contact_get_hotline',
    description:
      'Hotline des Operations-Teams für dringende Störungen: Beschriftung, Nummer und tel:-Link. Das Tool wählt nicht selbst.',
    inputSchema: {
      type: 'object',
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
    execute: (_args, { config }) =>
      webMcpJson({
        label: config.phoneLabel,
        phone: config.phone,
        telUri: 'tel:' + config.phone.replace(/[^+\d]/g, ''),
      }),
  },
];
