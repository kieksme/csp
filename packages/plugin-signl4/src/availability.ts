import { activeShifts, safeTimezone, type Shift } from '@kieksme/csp-sdk';

export function dutyState(shifts: Shift[], now: number) {
  const valid = shifts.filter((s) => Date.parse(s.end) > Date.parse(s.start));
  const current = activeShifts(valid, now)
    .sort(
      (a, b) =>
        Date.parse(a.start) - Date.parse(b.start) ||
        a.userId.localeCompare(b.userId),
    )
    .filter(
      (s, i, all) => all.findIndex((other) => other.userId === s.userId) === i,
    );
  const next = valid
    .filter((s) => Date.parse(s.start) > now)
    .sort((a, b) => Date.parse(a.start) - Date.parse(b.start))[0];
  return { current, next };
}

export function nextShiftLabel(start: string, now: number, timezone: string) {
  const timeZone = safeTimezone(timezone);
  const date = new Date(start);
  const dayNumber = (value: Date) => {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    }).formatToParts(value);
    const part = (name: string) =>
      Number(parts.find((p) => p.type === name)!.value);
    return Date.UTC(part('year'), part('month') - 1, part('day')) / 86400000;
  };
  const days = dayNumber(date) - dayNumber(new Date(now));
  const time = date
    .toLocaleTimeString('de-DE', {
      timeZone,
      hour: 'numeric',
      minute: '2-digit',
    })
    .replace(':00', '');
  const day =
    days === 0
      ? 'heute'
      : days === 1
        ? 'morgen'
        : days === 2
          ? 'übermorgen'
          : date.toLocaleDateString('de-DE', {
              timeZone,
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            });
  return `Ab ${day} um ${time} Uhr sind wir wieder für Sie da.`;
}
