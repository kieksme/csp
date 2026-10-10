import { describe, expect, it, vi } from 'vitest';
import {
  SDK_VERSION,
  findModelContext,
  registerWebMcpTools,
  validatePlugins,
  type BrowserContext,
  type ModelContextLike,
  type WebMcpResult,
  type WebMcpTool,
} from '../packages/sdk/src/index.js';
import { coreTools } from '../packages/core/src/webmcp.js';
import { publicConfig } from '../packages/core/src/config.js';
import { signl4Tools } from '../packages/plugin-signl4/src/tools.js';
import { kumaTools } from '../packages/plugin-kuma/src/tools.js';
import { contactTools } from '../packages/plugin-contact/src/tools.js';
import { contentTools } from '../packages/plugin-content/src/tools.js';
import { chatTools, parseMessages } from '../packages/plugin-chat/src/tools.js';

const meta = { sdkVersion: `^${SDK_VERSION}` };
const text = (r: WebMcpResult) => JSON.parse(r.content[0].text);
function context(
  routes: Record<string, unknown> = {},
  overrides: Partial<BrowserContext['config']> = {},
): BrowserContext {
  return {
    config: { ...publicConfig({}), ...overrides },
    api: async (path: string) => {
      if (!(path in routes)) throw new Error('HTTP 404');
      return routes[path] as never;
    },
  };
}
const fresh = (data: unknown) => ({
  data,
  updatedAt: '2026-10-06T08:00:00.000Z',
  stale: false,
});
const tool = (tools: WebMcpTool[], name: string) =>
  tools.find((t) => t.name === name)!;

describe('WebMCP registry', () => {
  const tools: WebMcpTool[] = [
    {
      name: 'x_ping',
      description: 'Ping',
      inputSchema: { type: 'object' },
      execute: () => ({ content: [{ type: 'text', text: '"pong"' }] }),
    },
  ];
  it('feature-detects navigator and document, never throws without WebMCP', () => {
    expect(findModelContext({})).toBeUndefined();
    const modelContext = { registerTool: vi.fn() };
    expect(findModelContext({ navigator: { modelContext } })).toBe(
      modelContext,
    );
    expect(findModelContext({ document: { modelContext } })).toBe(modelContext);
    expect(
      findModelContext({ navigator: { modelContext: {} } }),
    ).toBeUndefined();
  });
  it('registers tools with an abort signal and unregisters on cleanup', async () => {
    const registered: {
      name: string;
      signal?: AbortSignal;
      run: () => unknown;
    }[] = [];
    const modelContext: ModelContextLike = {
      registerTool: (t, options) => {
        registered.push({
          name: t.name,
          signal: options?.signal,
          run: () => t.execute({}),
        });
      },
      unregisterTool: vi.fn(),
    };
    const cleanup = registerWebMcpTools(modelContext, tools, context());
    expect(registered.map((r) => r.name)).toEqual(['x_ping']);
    expect(await registered[0].run()).toEqual({
      content: [{ type: 'text', text: '"pong"' }],
    });
    cleanup();
    expect(registered[0].signal?.aborted).toBe(true);
    expect(modelContext.unregisterTool).toHaveBeenCalledWith('x_ping');
  });
  it('turns failing handlers into an error result and skips rejected tools', async () => {
    let run: () => Promise<WebMcpResult> = async () => {
      throw new Error('not set');
    };
    const modelContext: ModelContextLike = {
      registerTool: (t) => {
        if (t.name === 'x_dup') throw new Error('duplicate');
        run = () => t.execute({}) as Promise<WebMcpResult>;
      },
    };
    registerWebMcpTools(
      modelContext,
      [
        { ...tools[0], name: 'x_dup' },
        {
          ...tools[0],
          name: 'x_fail',
          execute: () => {
            throw new Error('secret internals');
          },
        },
      ],
      context(),
    );
    const result = await run();
    expect(result.isError).toBe(true);
    expect(result.content[0].text).not.toContain('secret');
  });
  it('swallows asynchronous registration rejections', async () => {
    const modelContext: ModelContextLike = {
      registerTool: () => Promise.reject(new Error('duplicate')),
    };
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);
    registerWebMcpTools(modelContext, tools, context());
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);
    expect(unhandled).not.toHaveBeenCalled();
  });
  it('requires plugin-prefixed, unique tool names', () => {
    const plugin = (id: string, name: string) => ({
      id,
      ...meta,
      tools: [{ name }],
    });
    expect(() =>
      validatePlugins([plugin('my-plugin', 'my_plugin_a')]),
    ).not.toThrow();
    expect(() => validatePlugins([plugin('a', 'b_tool')])).toThrow('WebMCP');
    expect(() => validatePlugins([plugin('a', 'a_Bad-Name')])).toThrow(
      'WebMCP',
    );
    expect(() =>
      validatePlugins([
        { id: 'a', ...meta, tools: [{ name: 'a_x' }, { name: 'a_x' }] },
      ]),
    ).toThrow('duplicate');
  });
  it('lists the tools of all installed plugins in portal_get_info', async () => {
    const config = publicConfig({});
    const plugins = [{ id: 'kuma', ...meta, sections: [], tools: kumaTools }];
    const info = text(
      await tool(coreTools(config, plugins), 'portal_get_info').execute(
        {},
        context(),
      ),
    );
    expect(info.tools).toEqual(['portal_get_info', 'kuma_get_status']);
  });
  it('enables WebMCP by default and honours the opt-out', () => {
    expect(publicConfig({}).webmcp).toBe(true);
    expect(publicConfig({ CSP_WEBMCP: 'false' }).webmcp).toBe(false);
  });
});

describe('signl4 tools', () => {
  const now = Date.now();
  const hour = 36e5;
  const shifts = [
    {
      userId: 'a',
      name: 'Ada',
      start: new Date(now - hour).toISOString(),
      end: new Date(now + hour).toISOString(),
    },
    {
      userId: 'b',
      name: 'Ben',
      start: new Date(now + hour).toISOString(),
      end: new Date(now + 3 * hour).toISOString(),
    },
    {
      userId: 'a',
      name: 'Ada',
      start: new Date(now + 400 * hour).toISOString(),
      end: new Date(now + 410 * hour).toISOString(),
    },
  ];
  const team = [
    {
      id: 'a',
      name: 'Ada',
      role: 'Lead',
      email: 'ada@example.org',
      phones: ['+49 1'],
    },
    { id: 'b', name: 'Ben', phones: [] },
  ];
  const ctx = context({
    '/schedule': fresh({ timezone: 'Europe/Berlin', shifts }),
    '/team': fresh(team),
    '/alerts': fresh([
      {
        id: '1',
        title: 'Low',
        description: 'x',
        status: 'Offen',
        createdAt: '',
        severity: 1,
      },
      {
        id: '2',
        title: 'High',
        description: 'y',
        status: 'Offen',
        createdAt: '',
        severity: 5,
      },
    ]),
  });
  it('reports who is on duty and who is next', async () => {
    const result = text(
      await tool(signl4Tools, 'signl4_get_on_duty').execute({}, ctx),
    );
    expect(result.confirmed).toBe(true);
    expect(result.onDuty.map((p: { name: string }) => p.name)).toEqual(['Ada']);
    expect(result.nextShift.name).toBe('Ben');
  });
  it('does not claim availability for stale or missing data', async () => {
    const stale = context({
      '/schedule': { ...fresh({ timezone: 'UTC', shifts }), stale: true },
    });
    const result = await tool(signl4Tools, 'signl4_get_on_duty').execute(
      {},
      stale,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('nicht bestätigt');
  });
  it('filters the schedule by person and horizon', async () => {
    const run = (args: Record<string, unknown>) =>
      tool(signl4Tools, 'signl4_get_shift_schedule').execute(args, ctx);
    expect(text(await run({})).shifts).toHaveLength(2);
    expect(text(await run({ personId: 'b' })).shifts).toHaveLength(1);
    expect(text(await run({ horizonHours: 1000 })).shifts).toHaveLength(3);
    expect(text(await run({ horizonHours: 'bad' })).shifts).toHaveLength(2);
  });
  it('searches the team and builds a vCard without extra requests', async () => {
    const list = text(
      await tool(signl4Tools, 'signl4_list_team').execute(
        { query: 'LEAD' },
        ctx,
      ),
    );
    expect(list.people.map((p: { id: string }) => p.id)).toEqual(['a']);
    const card = text(
      await tool(signl4Tools, 'signl4_get_vcard').execute({ id: 'a' }, ctx),
    );
    expect(card.vcard).toContain('BEGIN:VCARD');
    expect(card.vcard).toContain('EMAIL:ada@example.org');
    const missing = await tool(signl4Tools, 'signl4_get_vcard').execute(
      { id: 'zzz' },
      ctx,
    );
    expect(missing.isError).toBe(true);
  });
  it('filters alerts by severity and flags external text', async () => {
    const result = text(
      await tool(signl4Tools, 'signl4_list_alerts').execute(
        { minSeverity: 3 },
        ctx,
      ),
    );
    expect(result.alerts.map((a: { id: string }) => a.id)).toEqual(['2']);
    expect(result.notice).toContain('keine Anweisungen');
  });
  it('declares every signl4 tool read-only', () => {
    expect(signl4Tools.every((t) => t.annotations?.readOnlyHint)).toBe(true);
  });
});

describe('kuma, contact and content tools', () => {
  it('returns the status with stale marker and monitor filter', async () => {
    const ctx = context({
      '/status': {
        ...fresh({
          url: 'https://status.example.org',
          monitors: [
            { id: '1', name: 'Web', status: 'up' },
            { id: '2', name: 'Mail', status: 'down' },
          ],
        }),
        stale: true,
      },
    });
    const result = text(
      await tool(kumaTools, 'kuma_get_status').execute({ monitor: 'mai' }, ctx),
    );
    expect(result.stale).toBe(true);
    expect(result.monitors).toHaveLength(1);
  });
  it('returns the hotline without dialing', async () => {
    const ctx = context({}, { phone: '+49 30 123-456', phoneLabel: 'Hotline' });
    const result = text(
      await tool(contactTools, 'contact_get_hotline').execute({}, ctx),
    );
    expect(result.telUri).toBe('tel:+4930123456');
  });
  it('searches FAQ, lists processes and ticket templates', async () => {
    const content = {
      processes: [{ id: 'p', title: 'Prozess', text: 'T' }],
      tickets: [
        {
          title: 'Störung',
          description: 'D',
          href: 'https://tickets.example.org/new',
          template: 'Was ist passiert?',
        },
      ],
      faq: [
        {
          id: '1',
          category: 'A',
          question: 'Passwort vergessen?',
          answer: 'Reset',
        },
        { id: '2', category: 'B', question: 'VPN', answer: 'Client' },
      ],
    };
    const ctx = context({}, { content });
    const faq = text(
      await tool(contentTools, 'content_search_faq').execute(
        { query: 'passwort' },
        ctx,
      ),
    );
    expect(faq.results.map((f: { id: string }) => f.id)).toEqual(['1']);
    expect(faq.categories).toEqual(['A', 'B']);
    expect(
      text(await tool(contentTools, 'content_list_processes').execute({}, ctx))
        .processes,
    ).toHaveLength(1);
    expect(
      text(
        await tool(contentTools, 'content_list_ticket_templates').execute(
          {},
          ctx,
        ),
      ).tickets[0].template,
    ).toBe('Was ist passiert?');
  });
});

describe('chat tool', () => {
  it('validates the history like the API does', () => {
    expect(parseMessages([])).toMatch('1 bis 20');
    expect(parseMessages([{ role: 'assistant', content: 'x' }])).toMatch(
      'letzte',
    );
    expect(parseMessages([{ role: 'user', content: '' }])).toMatch('content');
    expect(parseMessages([{ role: 'system', content: 'x' }])).toMatch('role');
    expect(
      parseMessages(
        Array.from({ length: 5 }, () => ({
          role: 'user',
          content: 'x'.repeat(4000),
        })),
      ),
    ).toMatch('16000');
    expect(parseMessages([{ role: 'user', content: 'Hallo' }])).toEqual([
      { role: 'user', content: 'Hallo' },
    ]);
  });
  it('collects the SSE stream into answer, responder and sources', async () => {
    const sse =
      [
        'event: responder\ndata: {"name":"Ada","role":"on-duty"}',
        'event: sources\ndata: [{"id":"s","title":"FAQ","href":"/#faq"}]',
        'event: delta\ndata: {"text":"Hal"}',
        'event: delta\ndata: {"text":"lo"}',
        'event: done\ndata: {}',
      ].join('\n\n') + '\n\n';
    const request = vi.fn(
      async () =>
        new Response(sse, { headers: { 'Content-Type': 'text/event-stream' } }),
    );
    const ctx = { ...context(), request: request as never };
    const result = text(
      await tool(chatTools, 'chat_ask').execute(
        { messages: [{ role: 'user', content: 'Hi' }] },
        ctx,
      ),
    );
    expect(result.answer).toBe('Hallo');
    expect(result.responder).toBe('Ada');
    expect(request).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/chat',
      expect.objectContaining({ method: 'POST' }),
    );
  });
  it('does not call the locked chat route in Teams support mode', async () => {
    const request = vi.fn();
    const ctx = {
      ...context(
        {},
        {
          chatSupport: {
            mode: 'teams',
            auth: 'session',
            tenantId: 't',
            clientId: 'c',
            scope: 's',
          } as never,
        },
      ),
      request: request as never,
    };
    const result = await tool(chatTools, 'chat_ask').execute(
      { messages: [{ role: 'user', content: 'Hi' }] },
      ctx,
    );
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Supportmodus');
    expect(request).not.toHaveBeenCalled();
  });
  it('reports truncated streams and rate limits as errors', async () => {
    const run = (response: Response) =>
      tool(chatTools, 'chat_ask').execute(
        { messages: [{ role: 'user', content: 'Hi' }] },
        { ...context(), request: (async () => response) as never },
      );
    const truncated = await run(
      new Response('event: delta\ndata: {"text":"x"}\n\n'),
    );
    expect(truncated.isError).toBe(true);
    const limited = await run(new Response('', { status: 429 }));
    expect(limited.content[0].text).toContain('Zu viele Anfragen');
  });
});
