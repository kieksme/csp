import { expect, it, vi } from 'vitest';
import { createServer } from '../packages/core/src/server.js';
import { LiveCache, type ServerContext } from '@kieksme/csp-sdk';
import { publicConfig } from '../packages/core/src/config.js';
import plugin, {
  configSchema,
  datadogClient,
} from '../packages/plugin-datadog/src/server.js';
import {
  normalizeCases,
  normalizeMonitor,
  normalizeSlo,
  normalizeResponders,
  loadSchedule,
} from '../packages/plugin-datadog/src/provider.js';
import { demoSchedule } from '../packages/plugin-datadog/src/demo.js';
import browser from '../packages/plugin-datadog/src/browser.js';
import { staticDemoRequest } from '../packages/core/src/demo.js';
const project = 'e555e290-ed65-49bd-ae18-8acbfcf18db7';
const app = 'https://app.datadoghq.eu';
const liveEnv = {
  CSP_DATADOG_API_KEY: 'server-key',
  CSP_DATADOG_APP_KEY: 'server-app-key',
  CSP_DATADOG_CASE_PROJECT_ID: project,
  CSP_DATADOG_MONITOR_IDS: '1,2',
  CSP_DATADOG_SLO_IDS: 'abc',
  CSP_DATADOG_SCHEDULE_IDS: 'ops',
};
function responders(start: string, end: string, name = 'Ada') {
  return {
    data: { relationships: { responders: { data: [{ id: 'current' }] } } },
    included: [
      {
        type: 'schedules',
        id: 'ops',
        attributes: { name: 'Operations', time_zone: 'Europe/Berlin' },
      },
      {
        type: 'schedule_oncall_responder',
        id: 'current',
        attributes: { position: 'current' },
        relationships: { shifts: { data: [{ id: 'shift' }] } },
      },
      {
        type: 'shifts',
        id: 'shift',
        attributes: { start, end },
        relationships: { user: { data: { id: 'ada' } } },
      },
      {
        type: 'users',
        id: 'ada',
        attributes: { name, email: 'private@example.invalid' },
      },
    ],
  };
}
it('requires explicit live scope and credentials, but none for demos', () => {
  expect(configSchema.safeParse({}).success).toBe(false);
  expect(configSchema.safeParse({ CSP_DEMO: 'true' }).success).toBe(true);
  expect(configSchema.parse(liveEnv).CSP_DATADOG_MONITOR_IDS).toEqual([
    '1',
    '2',
  ]);
  expect(
    configSchema.safeParse({ ...liveEnv, CSP_DATADOG_SITE: 'evil.invalid' })
      .success,
  ).toBe(false);
  expect(
    configSchema.safeParse({ ...liveEnv, CSP_DATADOG_MONITOR_IDS: '' }).success,
  ).toBe(false);
});
it('retains case status groups and pagination while excluding other projects and private fields', () => {
  const item = {
    id: 'c',
    attributes: {
      key: 'CASE-1',
      title: 'Failure',
      priority: 'P1',
      status: 'OPEN',
      status_name: 'Waiting',
      status_group: 'SG_OPEN',
      description: 'private',
    },
    relationships: {
      project: { data: { id: project } },
      assignee: { data: { id: 'ada' } },
    },
  };
  const result = normalizeCases(
    {
      data: [
        item,
        {
          ...item,
          id: 'other',
          relationships: { project: { data: { id: 'other' } } },
        },
      ],
      meta: { page: { total: 2 } },
    },
    project,
    app,
    0,
  );
  expect(result.items).toHaveLength(1);
  expect(result).toMatchObject({
    page: 0,
    hasMore: true,
    items: [{ status: 'Waiting', statusGroup: 'SG_OPEN', assignee: 'ID: ada' }],
  });
  expect(JSON.stringify(result)).not.toContain('private');
  expect(
    normalizeCases({ data: [], meta: { page: { total: 0 } } }, project, app, 0)
      .hasMore,
  ).toBe(false);
});
it.each([
  ['OK', 'ok'],
  ['Warn', 'warning'],
  ['Alert', 'alert'],
  ['No Data', 'no-data'],
  ['new-state', 'unknown'],
])('maps monitor %s without optimistic defaults', (state, expected) => {
  expect(
    normalizeMonitor({ id: 1, name: 'API', overall_state: state }, app).status,
  ).toBe(expected);
});
it('shows maintenance for monitors with active downtimes', () => {
  expect(
    normalizeMonitor(
      { id: 1, name: 'API', overall_state: 'Alert', matching_downtimes: [{}] },
      app,
    ).status,
  ).toBe('maintenance');
});
it('preserves exhausted error budgets and treats partial SLO errors as unavailable', () => {
  const detail = {
    data: {
      id: 's',
      name: 'API',
      thresholds: [{ timeframe: '30d', target: 99.9 }],
    },
  };
  expect(
    normalizeSlo(
      detail,
      {
        data: {
          overall: { sli_value: 99.8, error_budget_remaining: { '30d': -100 } },
        },
      },
      app,
    ),
  ).toMatchObject({
    target: 99.9,
    sli: 99.8,
    errorBudget: -100,
    unavailable: false,
  });
  expect(
    normalizeSlo(
      detail,
      { data: { overall: { sli_value: 100 }, errors: [{}] } },
      app,
    ),
  ).toMatchObject({ sli: undefined, unavailable: true });
  expect(normalizeSlo(detail, { data: {} }, app).sli).toBeUndefined();
});
it('resolves JSON:API relationships, DST offsets and rejects missing or invalid shifts', () => {
  const raw = responders(
    '2026-10-25T02:00:00+02:00',
    '2026-10-25T02:00:00+01:00',
  );
  const schedule = normalizeResponders(raw, 'ops', app);
  expect(schedule.shifts[0]).toMatchObject({
    name: 'Ada',
    timezone: 'Europe/Berlin',
  });
  expect(JSON.stringify(schedule)).not.toContain('private@');
  expect(() =>
    normalizeResponders(
      responders('2026-10-25T02:00:00Z', '2026-10-25T01:00:00Z'),
      'ops',
      app,
    ),
  ).toThrow();
  expect(() =>
    normalizeResponders(
      { ...raw, included: raw.included.filter((x) => x.type !== 'users') },
      'ops',
      app,
    ),
  ).toThrow();
});
it('walks actual shift boundaries for seven days including short overrides', async () => {
  const start = Date.parse('2026-10-14T12:00:00Z');
  const get = vi.fn(async (path: string) => {
    const at = Date.parse(
      new URL(path, app).searchParams.get('filter[at_ts]')!,
    );
    const day = Math.floor((at - start) / 86400000);
    return responders(
      new Date(start + day * 86400000).toISOString(),
      new Date(start + (day + 1) * 86400000).toISOString(),
    );
  });
  expect((await loadSchedule(get, 'ops', app, start)).shifts).toHaveLength(7);
  expect(get).toHaveBeenCalledTimes(7);
  expect(get.mock.calls[0][0]).toContain('responders.shifts.user');
});
it('honors Retry-After without returning response bodies or making more calls', async () => {
  const fetcher = vi.fn(
    async () =>
      new Response('private provider details', {
        status: 429,
        headers: { 'Retry-After': '300' },
      }),
  );
  const get = datadogClient(
    configSchema.parse(liveEnv),
    fetcher as typeof fetch,
  );
  await expect(get('/api/v1/monitor/1')).rejects.toThrow('HTTP 429');
  await expect(get('/api/v1/monitor/1')).rejects.toThrow('rate limited');
  expect(fetcher).toHaveBeenCalledTimes(1);
});
it('registers demo routes and chat sources without any provider traffic', async () => {
  const server = await createServer({
    env: { CSP_DEMO: 'true' },
    config: publicConfig({ CSP_DEMO: 'true' }),
    plugins: [],
  });
  const fetcher = vi.fn();
  const ctx: ServerContext = {
    app: server,
    env: { CSP_DEMO: 'true' },
    config: publicConfig({ CSP_DEMO: 'true' }),
    fetch: fetcher,
    demo: true,
    cache: new LiveCache(),
    knowledge: new Map(),
  };
  await plugin.setup(ctx);
  for (const path of ['cases', 'monitors', 'slos', 'schedule', 'team']) {
    const response = await server.inject('/api/v1/datadog/' + path);
    expect(response.statusCode).toBe(200);
    expect(response.json().stale).toBe(false);
  }
  expect(
    (await server.inject('/api/v1/datadog/cases?page=1')).json().data.items,
  ).toHaveLength(4);
  expect(
    (await server.inject('/api/v1/datadog/cases?status=CLOSED')).json().data
      .items,
  ).toHaveLength(8);
  expect(
    (await server.inject('/api/v1/datadog/cases?page=-1')).statusCode,
  ).toBe(400);
  expect(
    (await server.inject({ method: 'POST', url: '/api/v1/datadog/cases' }))
      .statusCode,
  ).toBe(404);
  expect((await ctx.knowledge.get('datadog-health')!())[0].text).toContain(
    '\"demo\":true',
  );
  expect(fetcher).not.toHaveBeenCalled();
  await server.close();
});
it('isolates failing providers and preserves last successful data as stale', async () => {
  const server = await createServer({
    env: { CSP_DEMO: 'true' },
    config: publicConfig({ CSP_DEMO: 'true' }),
    plugins: [],
  });
  let now = Date.now(),
    fail = false;
  const fetcher = vi.fn(async (url: RequestInfo | URL) => {
    if (String(url).includes('/monitor/') && !fail)
      return Response.json({ id: 1, name: 'API', overall_state: 'OK' });
    return new Response('private', { status: 403 });
  });
  await plugin.setup({
    app: server,
    env: liveEnv,
    config: publicConfig({}),
    fetch: fetcher as typeof fetch,
    demo: false,
    cache: new LiveCache(30, () => now),
    knowledge: new Map(),
  });
  expect((await server.inject('/api/v1/datadog/monitors')).json().stale).toBe(
    false,
  );
  expect((await server.inject('/api/v1/datadog/slos')).json().stale).toBe(true);
  fail = true;
  now += 31;
  const stale = (await server.inject('/api/v1/datadog/monitors')).json();
  expect(stale).toMatchObject({
    stale: true,
    data: [{ name: 'API' }, { name: 'API' }],
  });
  expect(JSON.stringify(stale)).not.toContain('private');
  await server.close();
});
it('serves plugin-owned static demo routes, pagination and chat knowledge', async () => {
  const request = staticDemoRequest(publicConfig({ CSP_DEMO: 'true' }), [
    browser,
  ]);
  expect(
    (await (await request(app + '/api/v1/datadog/cases?page=1')).json()).data
      .items,
  ).toHaveLength(4);
  const chat = await (await request(app + '/api/v1/chat')).text();
  expect(chat).toContain('datadog-health');
  expect(chat).toContain('Error Budget');
  expect(chat).toContain('event: done');
  const now = Date.now();
  expect(
    demoSchedule(now).shifts.at(-1)!.end >
      new Date(now + 7 * 86400000).toISOString(),
  ).toBe(true);
});

it('accepts blank env-template placeholders only when live requirements are not needed', () => {
  const placeholders = Object.fromEntries(
    Object.keys(liveEnv).map((key) => [key, '   ']),
  );
  expect(
    configSchema.safeParse({ ...placeholders, CSP_DEMO: 'true' }).success,
  ).toBe(true);
  expect(
    configSchema.safeParse({ ...placeholders, CSP_DEMO: 'false' }).success,
  ).toBe(false);
});

it('accepts monitor timestamps as strings without changing the health status', () => {
  expect(
    normalizeMonitor(
      {
        id: 1,
        name: 'API',
        overall_state: 'OK',
        overall_state_modified: '2026-10-16T08:00:00Z',
      },
      app,
    ).status,
  ).toBe('ok');
});
it('accepts null SLO error arrays without hiding valid measurements', () => {
  expect(
    normalizeSlo(
      {
        data: {
          id: 's',
          name: 'API',
          thresholds: [{ timeframe: '30d', target: 99.9 }],
        },
      },
      { data: { overall: { sli_value: 100, errors: null }, errors: null } },
      app,
    ),
  ).toMatchObject({ sli: 100, unavailable: false });
});
it.each(['', '   ', null, undefined])(
  'uses a responder ID for an unset display name (%s) without exposing email',
  (name) => {
    const raw = responders('2026-10-16T08:00:00Z', '2026-10-16T18:00:00Z');
    const user = raw.included.find((x) => x.type === 'users')!;
    user.attributes = { ...user.attributes, name } as typeof user.attributes;
    const result = normalizeResponders(raw, 'ops', app);
    expect(result.shifts[0].name).toBe('ID: ada');
    expect(JSON.stringify(result)).not.toContain('private@example.invalid');
  },
);
it('translates zero-based portal pages to one-based Datadog pages', async () => {
  const fetcher = vi.fn(async (_url: RequestInfo | URL) =>
    Response.json({ data: [], meta: { page: { total: 3 } } }),
  );
  const server = await createServer({
    env: liveEnv,
    config: publicConfig({}),
    plugins: [plugin],
    fetch: fetcher as typeof fetch,
  });
  for (const page of [0, 1]) {
    const response = await server.inject('/api/v1/datadog/cases?page=' + page);
    expect(response.json()).toMatchObject({
      stale: false,
      data: { page, hasMore: true },
    });
    const url = new URL(String(fetcher.mock.calls.at(-1)![0]));
    expect(url.searchParams.get('page[number]')).toBe(String(page + 1));
    expect(url.searchParams.get('filter')).toBe('project_id:' + project);
  }
  await server.close();
});
