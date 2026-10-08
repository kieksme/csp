import type { PublicConfig } from '@kieksme/csp-sdk';
// Explicit browser-only demo. No provider requests or production data.
export function staticDemoRequest(config: PublicConfig): typeof fetch {
  return async (input, init) => {
    if (init?.signal?.aborted) throw new DOMException('Aborted', 'AbortError');
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    const route = url.split('/api/v1')[1] ?? '';
    const now = Date.now(),
      updatedAt = new Date(now).toISOString();
    const team = [
      {
        id: 'demo-lena',
        name: 'Lena Demo',
        phones: ['+49 000 000000'],
        role: 'Service',
      },
      { id: 'demo-noah', name: 'Noah Demo', phones: [], role: 'Operations' },
      { id: 'demo-mila', name: 'Mila Demo', phones: [], role: 'Service' },
      { id: 'demo-sara', name: 'Sara Demo', phones: [], role: 'Support' },
      { id: 'demo-jonas', name: 'Jonas Demo', phones: [], role: 'Support' },
    ];
    let data: unknown;
    if (route === '/team') data = team;
    else if (route === '/schedule')
      data = {
        timezone: 'Europe/Berlin',
        shifts: [
          {
            userId: team[0].id,
            name: team[0].name,
            start: new Date(now - 3600000).toISOString(),
            end: new Date(now + 3600000).toISOString(),
          },
        ],
      };
    else if (route === '/alerts') data = [];
    else if (route === '/status')
      data = {
        monitors: [
          { id: 'demo', name: 'Demo-System', status: 'up', uptime: 1 },
        ],
        url: 'https://status.example.invalid',
      };
    else if (route === '/chat') {
      const sources = config.content.faq
        .slice(0, 3)
        .map((f) => ({ id: f.id, title: f.question, href: '#faq' }));
      const text =
        'Dies ist eine statische Demo. ' +
        (config.content.faq[0]?.answer ??
          'Für echte Auskünfte wenden Sie sich an das Service-Team.');
      return new Response(
        `event: sources\ndata: ${JSON.stringify(sources)}\n\nevent: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {}\n\n`,
        { headers: { 'Content-Type': 'text/event-stream' } },
      );
    } else
      return new Response(
        JSON.stringify({ error: 'Unavailable in static demo' }),
        { status: 404 },
      );
    return Response.json({ data, updatedAt, stale: false });
  };
}
