import { expect, it } from 'vitest';
import { staticDemoRequest } from '../packages/core/src/demo.js';
import { publicConfig } from '../packages/core/src/config.js';
it('provides browser-only synthetic data and a complete chat stream', async () => {
  const request = staticDemoRequest(publicConfig({ CSP_DEMO: 'true' }));
  expect(
    (await (await request('https://unused/api/v1/team')).json()).data[0].name,
  ).toBe('Lena Demo');
  expect(
    (await (await request('https://unused/api/v1/team')).json()).data,
  ).toHaveLength(5);
  const stream = await (await request('https://unused/api/v1/chat')).text();
  expect(stream).toContain('event: done');
  expect(stream).toContain('event: responder');
  expect(stream).toContain('"name":"Lena Demo","role":"on-duty"');
  expect((await request('https://unused/api/v1/unknown')).status).toBe(404);
});
