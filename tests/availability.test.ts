import { expect, it } from 'vitest';
import {
  dutyState,
  nextShiftLabel,
} from '../packages/plugin-signl4/src/availability.js';

it('uses inclusive starts, exclusive ends and the earliest valid future shift', () => {
  const shift = (userId: string, start: number, end: number) => ({
    userId,
    name: userId,
    start: new Date(start).toISOString(),
    end: new Date(end).toISOString(),
  });
  const result = dutyState(
    [
      shift('finished', 0, 1000),
      shift('later', 3000, 4000),
      shift('active', 1000, 2000),
      shift('next', 2000, 3000),
      shift('invalid', 2000, 1000),
      shift('active', 1000, 2000),
    ],
    1000,
  );
  expect(result.current.map((s) => s.userId)).toEqual(['active']);
  expect(result.next?.userId).toBe('next');
  expect(dutyState([], 1000)).toEqual({ current: [], next: undefined });
});

it('labels local calendar days across midnight and daylight saving changes', () => {
  const now = Date.parse('2026-10-08T21:30:00Z');
  expect(nextShiftLabel('2026-10-08T21:45:00Z', now, 'Europe/Berlin')).toBe(
    'Ab heute um 23:45 Uhr sind wir wieder für Sie da.',
  );
  expect(nextShiftLabel('2026-10-09T06:00:00Z', now, 'Europe/Berlin')).toBe(
    'Ab morgen um 8 Uhr sind wir wieder für Sie da.',
  );
  expect(nextShiftLabel('2026-10-10T06:00:00Z', now, 'Europe/Berlin')).toBe(
    'Ab übermorgen um 8 Uhr sind wir wieder für Sie da.',
  );
  expect(nextShiftLabel('2026-10-12T06:00:00Z', now, 'Europe/Berlin')).toBe(
    'Ab Montag, 12. Oktober 2026 um 8 Uhr sind wir wieder für Sie da.',
  );
  expect(
    nextShiftLabel(
      '2026-10-26T07:00:00Z',
      Date.parse('2026-10-24T22:30:00Z'),
      'Europe/Berlin',
    ),
  ).toBe('Ab morgen um 8 Uhr sind wir wieder für Sie da.');
  expect(nextShiftLabel('2026-10-09T06:00:00Z', now, 'America/New_York')).toBe(
    'Ab morgen um 2 Uhr sind wir wieder für Sie da.',
  );
});
