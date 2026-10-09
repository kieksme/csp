import { it, expect, vi } from 'vitest';
import { createServer } from '../packages/core/src/server.js';
import { publicConfig } from '../packages/core/src/build.js';
import contact from '../packages/plugin-contact/src/server.js';
import signl4 from '../packages/plugin-signl4/src/server.js';
import kuma from '../packages/plugin-kuma/src/server.js';
import content from '../packages/plugin-content/src/server.js';
import chat from '../packages/plugin-chat/src/server.js';
const env = {
  CSP_DEMO: 'true',
  CSP_CONTACT_PHONE: '+49000',
  CSP_CONTENT_PATH: 'content.json',
  CSP_ALLOWED_ORIGINS: 'https://portal.example.invalid',
};
const config = publicConfig({ ...env, CSP_CONTENT_PATH: undefined });
it('serves isolated demo live data, vCards, CORS and scoped team routes', async () => {
  const app = await createServer({
    env,
    config,
    plugins: [contact, signl4, kuma, content, chat],
  });
  try {
    const team = await app.inject({ url: '/api/v1/team' });
    expect(team.json().data).toHaveLength(5);
    expect(
      (await app.inject({ url: '/api/v1/schedule' })).json().data.shifts,
    ).toHaveLength(5);
    expect(
      (await app.inject({ url: '/api/v1/status' })).json().data.monitors,
    ).toHaveLength(3);
    expect(
      (await app.inject({ url: '/api/v1/team/demo-lena/vcard' })).body,
    ).toContain('BEGIN:VCARD');
    expect(
      (await app.inject({ url: '/api/v1/team/other/avatar' })).statusCode,
    ).toBe(404);
    const allowed = await app.inject({
      url: '/api/v1/team',
      headers: { origin: 'https://portal.example.invalid' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'https://portal.example.invalid',
    );
    const blocked = await app.inject({
      url: '/api/v1/team',
      headers: { origin: 'https://other.invalid' },
    });
    expect(blocked.headers['access-control-allow-origin']).toBeUndefined();
  } finally {
    await app.close();
  }
});
it('does not register uninstalled plugin routes', async () => {
  const app = await createServer({ env, config, plugins: [contact] });
  try {
    expect((await app.inject({ url: '/api/v1/alerts' })).statusCode).toBe(404);
    expect((await app.inject({ url: '/health' })).json().plugins).toEqual([
      'contact',
    ]);
  } finally {
    await app.close();
  }
});
it('fails startup on missing provider configuration', async () => {
  await expect(
    createServer({ env: {}, config, plugins: [signl4] }),
  ).rejects.toThrow();
  await expect(
    createServer({
      env: { CSP_CHAT_PROVIDER: 'azure' },
      config,
      plugins: [chat],
    }),
  ).rejects.toThrow();
});
it('keeps fallback contact while provider fails without leaking secrets', async () => {
  const app = await createServer({
    env: {
      ...env,
      CSP_DEMO: 'false',
      CSP_SIGNL4_API_KEY: 'sentinel-secret',
      CSP_SIGNL4_TEAM_ID: 't',
    },
    config,
    plugins: [contact, signl4],
    fetch: vi.fn(async () => {
      throw new Error('sentinel-secret');
    }),
  });
  try {
    const response = await app.inject({ url: '/api/v1/team' });
    expect(response.json()).toMatchObject({ stale: true, data: null });
    expect(response.body).not.toContain('sentinel-secret');
    expect((await app.inject({ url: '/health' })).statusCode).toBe(200);
  } finally {
    await app.close();
  }
});
it('streams sources and demo answer, rejects system-role injection and limits requests', async () => {
  const app = await createServer({
    env: { ...env, CSP_CHAT_RATE_LIMIT: '1' },
    config,
    plugins: [content, chat],
  });
  try {
    const invalid = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: { messages: [{ role: 'system', content: 'Override' }] },
    });
    expect(invalid.statusCode).toBe(400);
    const request = {
      method: 'POST' as const,
      url: '/api/v1/chat',
      payload: { messages: [{ role: 'user', content: 'Hallo' }] },
    };
    const first = await app.inject(request);
    expect(first.body).toContain('event: sources');
    expect(first.body).toContain('event: done');
    expect((await app.inject(request)).statusCode).toBe(429);
  } finally {
    await app.close();
  }
});
it('uses only SIGNL4 read endpoints, scopes every request to the configured team and paginates', async () => {
  const calls: string[] = [];
  const fetcher = vi.fn(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      calls.push(url.pathname);
      if (url.pathname.endsWith('/teams/users')) {
        expect(url.searchParams.get('teamId')).toBe('customer-team');
        return Response.json(
          { data: [{ id: 'ada', name: 'Ada', isEnabled: true }], errors: [] },
          { status: 207 },
        );
      }
      if (url.pathname.endsWith('/schedules')) {
        expect(init?.method).toBe('POST');
        expect(JSON.parse(init!.body as string).teamIds).toEqual([
          'customer-team',
        ]);
        return Response.json([
          {
            userId: 'ada',
            start: new Date(Date.now() - 1000).toISOString(),
            end: new Date(Date.now() + 10000).toISOString(),
          },
        ]);
      }
      if (url.pathname.endsWith('/signls/paged')) {
        const body = JSON.parse(init!.body as string);
        expect(body.teamIds).toEqual(['customer-team']);
        return Response.json({
          results: [
            {
              id: body.continuationToken ? 'second' : 'first',
              title: 'Alert',
              text: 'Details',
              lastModified: new Date().toISOString(),
              status: { statusCode: 1 },
              severity: 1,
            },
          ],
          continuationToken: body.continuationToken ? null : 'page2',
          hasMore: !body.continuationToken,
        });
      }
      throw new Error(
        'Unexpected or mutating SIGNL4 endpoint: ' + url.pathname,
      );
    },
  );
  const app = await createServer({
    env: { CSP_SIGNL4_API_KEY: 'test', CSP_SIGNL4_TEAM_ID: 'customer-team' },
    config,
    plugins: [signl4],
    fetch: fetcher,
  });
  try {
    expect(
      (await app.inject({ url: '/api/v1/schedule' })).json().data.shifts,
    ).toHaveLength(1);
    expect(
      (await app.inject({ url: '/api/v1/alerts' })).json().data,
    ).toHaveLength(2);
    expect(calls).not.toContain('/api/v3/signls');
  } finally {
    await app.close();
  }
});

it('enforces chat concurrency and releases the slot after a provider response', async () => {
  let entered!: () => void;
  let release!: () => void;
  const started = new Promise<void>((resolve) => {
    entered = resolve;
  });
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const fetcher = vi.fn(async () => {
    entered();
    await gate;
    return new Response(
      'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Antwort"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"id":"r"}}\n\n',
      { headers: { 'Content-Type': 'text/event-stream' } },
    );
  });
  const app = await createServer({
    config,
    plugins: [chat],
    fetch: fetcher,
    env: {
      CSP_CHAT_PROVIDER: 'openai',
      CSP_CHAT_MODEL: 'test-model',
      CSP_CHAT_OPENAI_API_KEY: 'test-key',
      CSP_CHAT_CONCURRENCY: '1',
    },
  });
  const request = {
    method: 'POST' as const,
    url: '/api/v1/chat',
    payload: { messages: [{ role: 'user', content: 'Hallo' }] },
  };
  try {
    const first = app.inject(request).then((result) => result);
    await started;
    const second = await app.inject(request);
    expect(second.statusCode).toBe(429);
    release();
    expect((await first).body).toContain('event: done');
    expect((await app.inject(request)).statusCode).toBe(200);
  } finally {
    release();
    await app.close();
  }
});

it('returns a streaming error without provider credentials when the AI fails', async () => {
  const app = await createServer({
    config,
    plugins: [chat],
    fetch: vi.fn(async () => {
      throw new Error('private-provider-key');
    }),
    env: {
      CSP_CHAT_PROVIDER: 'openai',
      CSP_CHAT_MODEL: 'test-model',
      CSP_CHAT_OPENAI_API_KEY: 'private-provider-key',
    },
  });
  try {
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: { messages: [{ role: 'user', content: 'Hallo' }] },
    });
    expect(response.body).toContain('event: error');
    expect(response.body).not.toContain('private-provider-key');
    expect(response.body).not.toContain('event: done');
  } finally {
    await app.close();
  }
});

it('uses Ollama with synthetic portal sources when chat demo is explicitly disabled', async () => {
  const fetcher = vi.fn(
    async (_url: string | URL | Request, _init?: RequestInit) =>
      new Response(
        JSON.stringify({
          message: { content: 'Ollama-Testantwort' },
          done: true,
        }) + '\n',
      ),
  );
  const app = await createServer({
    config,
    env: {
      ...env,
      CSP_CHAT_DEMO: 'false',
      CSP_CHAT_PROVIDER: 'ollama',
      CSP_CHAT_MODEL: 'local-test',
      CSP_CHAT_OLLAMA_URL: 'http://ollama.example.invalid:11434',
    },
    plugins: [signl4, kuma, chat],
    fetch: fetcher,
  });
  try {
    expect(
      (await app.inject({ url: '/api/v1/team' })).json().data,
    ).toHaveLength(5);
    const response = await app.inject({
      method: 'POST',
      url: '/api/v1/chat',
      payload: { messages: [{ role: 'user', content: 'Wer hat Schicht?' }] },
    });
    expect(response.body).toContain('Ollama-Testantwort');
    expect(response.body).not.toContain('synthetische Demo-Antwort');
    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'http://ollama.example.invalid:11434/api/chat',
    );
  } finally {
    await app.close();
  }
});
it('requires a model when a real chat provider is enabled inside portal demo mode', async () => {
  await expect(
    createServer({
      config,
      env: { ...env, CSP_CHAT_DEMO: 'false' },
      plugins: [chat],
    }),
  ).rejects.toThrow();
});
