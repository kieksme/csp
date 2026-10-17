import { expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/config.js';
import contact from '../packages/plugin-contact/src/server.js';
import content from '../packages/plugin-content/src/server.js';
import signl4 from '../packages/plugin-signl4/src/server.js';
import kuma from '../packages/plugin-kuma/src/server.js';
import datadog from '../packages/plugin-datadog/src/server.js';
const env = {
  CSP_MCP_ENABLED: 'true',
  CSP_DEMO: 'true',
  CSP_CONTACT_PHONE: '+49000',
  CSP_CONTENT_PATH: 'content.json',
};
const config = publicConfig({ ...env, CSP_CONTENT_PATH: undefined });
const headers = {
  'content-type': 'application/json',
  accept: 'application/json, text/event-stream',
};

it('supports an official MCP client with installed public plugin tools', async () => {
  const app = await createServer({
    env,
    config,
    plugins: [contact, content, signl4, kuma, datadog],
  });
  const client = new Client({ name: 'test-agent', version: '1.0.0' });
  try {
    await client.connect(
      new StreamableHTTPClientTransport(new URL('http://localhost/mcp'), {
        fetch: async (url, init) => {
          const response = await app.inject({
            method: (init?.method ?? 'GET') as 'GET' | 'POST' | 'DELETE',
            url: new URL(String(url)).pathname,
            headers: Object.fromEntries(new Headers(init?.headers).entries()),
            payload: init?.body as string | undefined,
          });
          return new Response(
            [202, 204].includes(response.statusCode) ? null : response.body,
            {
              status: response.statusCode,
              headers: response.headers as Record<string, string>,
            },
          );
        },
      }),
    );
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name)).toContain('datadog_get_cases');
    expect(tools.every((tool) => tool.annotations?.readOnlyHint)).toBe(true);
    const team = await client.callTool({
      name: 'signl4_get_team',
      arguments: {},
    });
    expect(
      JSON.parse((team.content as { text: string }[])[0].text).data,
    ).toHaveLength(5);
    expect(
      (
        await client.callTool({
          name: 'datadog_get_cases',
          arguments: { page: -1 },
        })
      ).isError,
    ).toBe(true);
  } finally {
    await client.close();
    await app.close();
  }
});

it('is opt-in and checks bearer tokens and origins', async () => {
  const off = await createServer({
    env: { ...env, CSP_MCP_ENABLED: 'false' },
    config,
    plugins: [],
  });
  const token = 'test-token-012345678901234567890123456789';
  const app = await createServer({
    env: {
      ...env,
      CSP_MCP_TOKEN: token,
      CSP_ALLOWED_ORIGINS: 'https://portal.example.com',
    },
    config,
    plugins: [contact],
  });
  try {
    expect(
      (await off.inject({ method: 'POST', url: '/mcp', payload: {} }))
        .statusCode,
    ).toBe(404);
    const req = {
      method: 'POST' as const,
      url: '/mcp',
      payload: { jsonrpc: '2.0', id: 1, method: 'tools/list' },
    };
    expect((await app.inject({ ...req, headers })).statusCode).toBe(401);
    expect(
      (
        await app.inject({
          ...req,
          headers: {
            ...headers,
            authorization: 'Bearer ' + token,
            origin: 'https://evil.example',
          },
        })
      ).statusCode,
    ).toBe(403);
    const response = await app.inject({
      ...req,
      headers: { ...headers, authorization: 'Bearer ' + token },
    });
    expect(
      response.json().result.tools.map((tool: { name: string }) => tool.name),
    ).toEqual(['portal_get_info', 'contact_get_hotline']);
    expect(
      (
        await app.inject({
          url: '/mcp',
          headers: { authorization: 'Bearer ' + token },
        })
      ).statusCode,
    ).toBe(405);
  } finally {
    await off.close();
    await app.close();
  }
});

it('rejects invalid MCP runtime settings and preserves sanitized provider fallbacks', async () => {
  await expect(
    createServer({ env: { CSP_MCP_ENABLED: 'yes' }, config, plugins: [] }),
  ).rejects.toThrow('CSP_MCP_ENABLED');
  await expect(
    createServer({
      env: { ...env, CSP_MCP_TOKEN: 'short' },
      config,
      plugins: [],
    }),
  ).rejects.toThrow('CSP_MCP_TOKEN');
  const app = await createServer({
    env: {
      CSP_MCP_ENABLED: 'true',
      CSP_SIGNL4_TEAM_ID: 'team',
      CSP_SIGNL4_API_KEY: 'private-key',
    },
    config,
    plugins: [signl4],
    fetch: async () => {
      throw new Error('private-key');
    },
  });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/mcp',
      headers,
      payload: {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'signl4_get_team', arguments: {} },
      },
    });
    expect(response.body).not.toContain('private-key');
    expect(JSON.parse(response.json().result.content[0].text)).toMatchObject({
      stale: true,
      data: null,
    });
  } finally {
    await app.close();
  }
});
