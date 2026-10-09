import { expect, it } from 'vitest';
import {
  chatContext,
  servicePrompt,
  relevantStatus,
} from '../packages/plugin-chat/src/context.js';
import { answerParts } from '../packages/plugin-chat/src/answer.js';
import { selectSources } from '../packages/plugin-chat/src/server.js';
import { dutyState, type Source } from '../packages/sdk/src/index.js';
const now = Date.parse('2026-10-09T10:00:00Z');
const shift = (
  userId: string,
  name: string,
  start = '2026-10-09T09:00:00Z',
  end = '2026-10-09T11:00:00Z',
) => ({ userId, name, start, end });
const schedule = (
  shifts = [shift('lena', 'Lena Beispiel')],
  stale = false,
): Source => ({
  id: 'schedule',
  title: 'Schichtplan',
  text: JSON.stringify({ timezone: 'Europe/Berlin', shifts }),
  stale,
});
it('uses the same deterministic primary shift as the header and changes at the boundary', () => {
  const shifts = [shift('z', 'Jonas'), shift('a', 'Lena'), shift('a', 'Lena')];
  expect(chatContext([schedule(shifts)], now).responder.name).toBe(
    dutyState(shifts, now).current[0].name,
  );
  expect(
    chatContext([schedule(shifts)], Date.parse('2026-10-09T11:00:00Z'))
      .responder,
  ).toEqual({ name: null, role: 'service-team' });
  expect(
    chatContext(
      [
        schedule([
          shift('noah', 'Noah', '2026-10-09T11:00:00Z', '2026-10-09T12:00:00Z'),
        ]),
      ],
      Date.parse('2026-10-09T11:00:00Z'),
    ).responder.name,
  ).toBe('Noah');
});
it.each([
  undefined,
  schedule([], true),
  { ...schedule(), text: 'invalid' },
  schedule([shift('x', 'X', 'bad')]),
  schedule([shift('x', 'X', '2026-10-09T11:00:00Z', '2026-10-09T09:00:00Z')]),
])('does not confirm an unavailable, stale or invalid schedule', (source) => {
  const context = chatContext(source ? [source] : [], now);
  expect(context.responder).toEqual({ name: null, role: 'service-team' });
  expect(context.availability).toBe('unconfirmed');
  expect(context.nextShift).toBeNull();
});
it('uses service-team voice and a confirmed future shift', () => {
  const context = chatContext(
    [
      schedule([
        shift('lena', 'Lena', '2026-10-10T06:00:00Z', '2026-10-10T14:00:00Z'),
      ]),
    ],
    now,
  );
  expect(context.availability).toBe('off-duty');
  expect(context.nextShift).toContain('morgen um 8 Uhr');
  expect(servicePrompt('Acme', '+49000', context)).toContain('Wir-Form');
});
it.each(['up', 'down', 'maintenance', 'unknown'])(
  'provides exact monitor facts for %s without inventing an email monitor',
  (status) => {
    const context = chatContext(
      [
        schedule(),
        {
          id: 'status',
          title: 'Systemstatus',
          text: JSON.stringify({
            monitors: [{ id: '1', name: 'Kundenportal', status }],
          }),
        },
      ],
      now,
    );
    expect(context.status?.monitors).toEqual([
      { id: '1', name: 'Kundenportal', status },
    ]);
    expect(JSON.stringify(context.status)).not.toContain('E-Mail');
    const prompt = servicePrompt('Acme', '+49000', context);
    expect(prompt).toContain('Andere verfügbare Dienste belegen keinen Status');
    expect(prompt).toContain('Ich-Form');
  },
);
it.each([true, false])(
  'does not use stale or malformed monitor facts (%s)',
  (stale) => {
    expect(
      chatContext(
        [
          {
            id: 'status',
            title: 'Status',
            text: stale
              ? '{"monitors":[]}'
              : '{"monitors":[{"status":"great"}]}',
            stale,
          },
        ],
        now,
      ).status,
    ).toBeNull();
  },
);
const tickets: Source[] = [
  {
    id: 'ticket:0',
    title: 'Acme Support-Anfrage',
    text: 'Problem melden',
    href: 'https://tickets.acme.example/support',
  },
];
it('keeps ticket actions even when many FAQ entries rank above them', () => {
  const faq = Array.from({ length: 30 }, (_, i) => ({
    id: `faq:${i}`,
    title: 'E-Mails',
    text: 'E-Mails '.repeat(500),
  }));
  expect(selectSources([...faq, ...tickets], 'E-Mails', 1000)[0].id).toBe(
    'ticket:0',
  );
});
it('turns only known source markers into safe readable links', () => {
  expect(answerParts('Bitte [ticket:0]. [invented:1]', tickets)).toEqual([
    { text: 'Bitte ' },
    { text: 'Support-Ticket erstellen', href: tickets[0].href },
    { text: '. ' },
  ]);
  expect(
    answerParts('[ticket:0]', [
      { ...tickets[0], href: 'javascript:alert(1)' },
    ])[0].href,
  ).toBeUndefined();
  expect(
    answerParts('[ticket:0]', [{ ...tickets[0], href: '//evil.invalid' }])[0]
      .href,
  ).toBeUndefined();
  expect(
    answerParts('[status]', [
      { id: 'status', title: 'Systemstatus', href: '#status', stale: true },
    ]),
  ).toEqual([{ text: 'Systemstatus (veraltet)', href: '#status' }]);
  expect(answerParts('Bitte [ticket:', tickets, true)).toEqual([
    { text: 'Bitte ' },
  ]);
  expect(answerParts('<script>alert(1)</script>', tickets)).toEqual([
    { text: '<script>alert(1)</script>' },
  ]);
});

it('isolates email monitor facts from unrelated portal and cloud availability', () => {
  const unrelated = {
    monitors: [
      { id: 'portal', name: 'Kundenportal', status: 'up' as const },
      { id: 'cloud', name: 'Cloud-Infrastruktur', status: 'up' as const },
    ],
  };
  expect(
    relevantStatus(unrelated, 'Ich kann meine E-Mails nicht lesen'),
  ).toEqual({ monitors: [] });
  for (const status of ['up', 'down', 'maintenance', 'unknown'] as const) {
    const email = { id: 'email', name: 'Exchange Online', status };
    expect(
      relevantStatus(
        { monitors: [...unrelated.monitors, email] },
        'Meine Emails funktionieren nicht',
      )?.monitors,
    ).toEqual([email]);
  }
  expect(
    relevantStatus(unrelated, 'Wie ist der Systemstatus?')?.monitors,
  ).toHaveLength(2);
  expect(
    relevantStatus(unrelated, 'Das Kundenportal ist langsam')?.monitors,
  ).toEqual([unrelated.monitors[0]]);
});
