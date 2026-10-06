import { it, expect, vi } from 'vitest';
import {
  normalizeTeam,
  normalizeShifts,
  normalizeAlerts,
} from '../packages/plugin-signl4/src/server.js';
import { normalizeStatus } from '../packages/plugin-kuma/src/server.js';
import {
  createProvider,
  readNDJSON,
} from '../packages/plugin-chat/src/providers.js';
const person = { id: 'a', name: 'Ada', phones: [] };
it('normalizes real SIGNL4 v3 shapes and rejects partial team errors', () => {
  expect(
    normalizeTeam({
      data: [
        {
          id: 'a',
          name: 'Ada',
          mail: 'ada@example.invalid',
          contactAddresses: [{ address: '12345', countryCode: '+49' }],
        },
      ],
    })[0].phones,
  ).toEqual(['+4912345']);
  expect(() =>
    normalizeTeam({ data: [], errors: [{ errorCode: 403 }] }),
  ).toThrow();
  expect(
    normalizeAlerts([
      {
        id: 'i',
        title: 'Incident',
        text: 'Details',
        lastModified: '2026-10-06T10:00:00Z',
        severity: 2,
        status: { statusCode: 2 },
      },
    ])[0],
  ).toMatchObject({ status: 'Bestätigt', description: 'Details' });
});
it('merges touching shifts and drops invalid durations and unknown members', () => {
  const shifts = [
    { userId: 'a', start: '2026-10-06T08:00:00Z', end: '2026-10-06T10:00:00Z' },
    { userId: 'a', start: '2026-10-06T10:00:00Z', end: '2026-10-06T12:00:00Z' },
    {
      userId: 'other',
      start: '2026-10-06T08:00:00Z',
      end: '2026-10-06T12:00:00Z',
    },
  ];
  expect(
    normalizeShifts(shifts, [person], Date.parse('2026-10-06T09:00:00Z')),
  ).toEqual([{ ...shifts[0], name: 'Ada', end: shifts[1].end }]);
});
it('uses the latest Kuma heartbeat independent of response order', () => {
  const status = normalizeStatus(
    {
      publicGroupList: [
        {
          monitorList: [
            { id: 1, name: 'Portal' },
            { id: 2, name: 'API' },
          ],
        },
      ],
      incident: { title: 'Wartung' },
    },
    {
      heartbeatList: {
        1: [
          { status: 0, time: '2026-10-06 10:00:00' },
          { status: 1, time: '2026-10-06 09:00:00' },
        ],
      },
      uptimeList: { '1_24': 0.95 },
    },
    'https://status.example.invalid',
  );
  expect(status.monitors.map((m) => m.status)).toEqual(['down', 'unknown']);
  expect(status.incident).toBe('Wartung');
});
it('decodes NDJSON across byte boundaries and without trailing newline', async () => {
  const bytes = new TextEncoder().encode(
    '{"message":{"content":"für"}}\n{"done":true}',
  );
  const stream = new ReadableStream({
    start(c) {
      for (const byte of bytes) c.enqueue(new Uint8Array([byte]));
      c.close();
    },
  });
  const values = [];
  for await (const value of readNDJSON(new Response(stream)))
    values.push(value);
  expect(values).toEqual([{ message: { content: 'für' } }, { done: true }]);
});
for (const provider of ['openai', 'azure', 'ollama'])
  it(`streams ${provider} and propagates model and output limits`, async () => {
    const fetcher = vi.fn(
      async (request: RequestInfo | URL, init?: RequestInit) => {
        const url = request instanceof Request ? request.url : String(request);
        const body =
          request instanceof Request
            ? await request.text()
            : (init?.body as string);
        expect(JSON.parse(body).model).toBe('test-model');
        if (provider === 'ollama') {
          expect(url).toBe('http://localhost:11434/api/chat');
          expect(JSON.parse(body).options.num_predict).toBe(128);
          return new Response(
            '{"message":{"content":"Hallo"}}\n{"done":true}\n',
          );
        }
        expect(url).toContain('/responses');
        expect(JSON.parse(body)).toMatchObject({
          max_output_tokens: 128,
          store: false,
        });
        if (provider === 'azure')
          expect(
            new Headers(
              request instanceof Request ? request.headers : init?.headers,
            ).get('api-key'),
          ).toBe('test-azure');
        return new Response(
          'event: response.output_text.delta\ndata: {"type":"response.output_text.delta","delta":"Hallo"}\n\nevent: response.completed\ndata: {"type":"response.completed","response":{"id":"r"}}\n\n',
          { headers: { 'Content-Type': 'text/event-stream' } },
        );
      },
    );
    const adapter = createProvider(
      {
        CSP_CHAT_PROVIDER: provider,
        CSP_CHAT_MODEL: 'test-model',
        CSP_CHAT_OPENAI_API_KEY: 'test-openai',
        CSP_CHAT_AZURE_API_KEY: 'test-azure',
        CSP_CHAT_AZURE_ENDPOINT: 'https://test.openai.azure.com',
      },
      fetcher as typeof fetch,
    );
    let output = '';
    for await (const text of adapter.stream({
      messages: [{ role: 'user', content: 'Hallo' }],
      maxTokens: 128,
      signal: new AbortController().signal,
    }))
      output += text;
    expect(output).toBe('Hallo');
  });

it('aborts stalled knowledge loading without waiting for provider completion', async () => {
  const { withAbort } = await import('../packages/plugin-chat/src/server.js');
  const controller = new AbortController();
  const waiting = withAbort(
    new Promise<never>(() => undefined),
    controller.signal,
  );
  controller.abort();
  await expect(waiting).rejects.toThrow('aborted');
});
