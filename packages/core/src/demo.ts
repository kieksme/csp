import type { PublicConfig, BrowserPlugin } from '@kieksme/csp-sdk';
// Explicit browser-only demo. No provider requests or production data.
export function staticDemoRequest(
  config: PublicConfig,
  plugins: BrowserPlugin[] = [],
): typeof fetch {
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
    for (const plugin of plugins) {
      const data = plugin.demoData?.(route);
      if (data !== undefined)
        return Response.json({ data, updatedAt, stale: false });
    }
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
      const extra = plugins.flatMap((plugin) => plugin.demoSources?.() ?? []);
      const sources = [
        ...extra,
        ...config.content.faq
          .slice(0, 3)
          .map((f) => ({ id: f.id, title: f.question, href: '#faq' })),
      ];
      const text =
        'Dies ist eine statische Demo. ' +
        (extra.length ? extra.map((s) => s.text).join('\n\n') + '\n\n' : '') +
        (config.content.faq[0]?.answer ??
          'Für echte Auskünfte wenden Sie sich an das Service-Team.');
      return new Response(
        `event: responder\ndata: ${JSON.stringify({ name: extra.length ? null : team[0].name, role: extra.length ? 'service-team' : 'on-duty' })}\n\nevent: sources\ndata: ${JSON.stringify(sources)}\n\nevent: delta\ndata: ${JSON.stringify({ text })}\n\nevent: done\ndata: {}\n\n`,
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
