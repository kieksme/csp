import { useEffect, useState } from 'react';
import { useLive, DataState } from '@kieksme/csp-sdk/browser';
import {
  safeTimezone,
  type BrowserContext,
  type Schedule,
  type Person,
} from '@kieksme/csp-sdk';
import { Avatar } from './avatar.js';
import { dutyState, nextShiftLabel } from './availability.js';

export function DutyHero(ctx: BrowserContext) {
  const live = useLive<Schedule>(ctx, '/schedule');
  const team = useLive<Person[]>(ctx, '/team');
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const { current, next } = dutyState(live.data?.shifts ?? [], now);
  const confirmed = !live.loading && !live.stale && !!live.data;
  const person = confirmed ? current[0] : undefined;
  const timezone = safeTimezone(live.data?.timezone ?? 'Europe/Berlin');
  const profile = team.data?.find((p) => p.id === person?.userId);
  return (
    <>
      <div className="hero-copy py-13 px-15 z-[1] wide:[animation:arrive_0.6s_ease_both] contained:p-11.25 compact:pt-9 compact:pb-9 compact:pl-7.5 compact:pr-7.5 narrow:pt-7.5 narrow:pb-7.5 narrow:pl-6.25 narrow:pr-6.25 duty-copy">
        <p className="eyebrow font-mono text-[0.6875rem] uppercase tracking-[2px] m-[0_0_calc(var(--spacing)_*_4.25)]">
          <span className="signal-mark w-[6px] h-[6px] bg-accent-secondary rounded-full" />{' '}
          {person
            ? 'Jetzt im Dienst · Für Sie zuständig'
            : confirmed
              ? 'Außerhalb unserer Schichtzeiten'
              : 'Ihr Service-Team'}
        </p>
        <div aria-live="polite" aria-atomic="true">
          <h1 className="text-[clamp(32px,4vw,56px)] tracking-[-2px] leading-[1.08] max-w-[680px] font-semibold my-5.5">
            {person ? (
              <>
                Hallo, mein Name ist{' '}
                <span className="duty-name block">{person.name}.</span>
              </>
            ) : live.loading ? (
              'Wir prüfen, wer für Sie da ist …'
            ) : !confirmed ? (
              'Erreichbarkeit derzeit nicht bestätigt.'
            ) : (
              'Derzeit hat niemand Schicht.'
            )}
          </h1>
          {person ? (
            <>
              <p className="duty-question text-[clamp(22px,2.5vw,32px)] mt-6 mb-3 font-semibold">
                Wie kann ich Ihnen helfen?
              </p>
              <p className="hero-description text-[1rem] leading-[1.8] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] max-w-[475px] narrow:text-[0.875rem]">
                Ich habe gerade Schicht und bin für Sie zuständig.
              </p>
              {current.length > 1 && (
                <p className="hero-description text-[1rem] leading-[1.8] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] max-w-[475px] narrow:text-[0.875rem]">
                  Ebenfalls im Dienst:{' '}
                  {current
                    .slice(1)
                    .map((s) => s.name)
                    .join(', ')}
                  .
                </p>
              )}
            </>
          ) : confirmed ? (
            <p className="hero-description text-[1rem] leading-[1.8] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] max-w-[475px] narrow:text-[0.875rem]">
              {next
                ? nextShiftLabel(next.start, now, timezone)
                : 'Der nächste Schichtbeginn ist noch nicht bekannt. Bitte nutzen Sie unsere Kontaktmöglichkeiten.'}
            </p>
          ) : (
            <p className="hero-description text-[1rem] leading-[1.8] [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))] max-w-[475px] narrow:text-[0.875rem]">
              Bitte nutzen Sie unsere Kontaktmöglichkeiten. Wir können die
              aktuelle Schicht derzeit nicht bestätigen.
            </p>
          )}
        </div>
        <p className="duty-timezone text-[0.75rem] text-hero-ink opacity-[0.85]">
          Schichtzeiten: {timezone}
        </p>
        {(live.stale || live.loading) && <DataState {...live} />}
      </div>
      {person && (
        <div
          className="duty-portrait flex flex-col items-center justify-end pt-8 px-8 min-w-0 [&_.avatar]:w-full [&_.avatar]:h-[360px] [&_.avatar]:max-w-[400px] [&_.avatar]:object-contain [&_.avatar]:object-bottom [&_.avatar]:bg-transparent [&_.avatar]:border-0 [&_.avatar]:rounded-none [&_.avatar]:text-[100px] [&_.avatar]:flex [&_.avatar]:items-center [&_.avatar]:justify-center [&_.avatar]:text-hero-ink compact:pt-0 compact:[&_.avatar]:h-[240px] compact:[&_.avatar]:max-w-[280px]"
          key={person.userId}
        >
          <Avatar
            config={ctx.config}
            id={person.userId}
            name={person.name}
            provider={profile?.avatar}
          />
          <p className="duty-badge text-[0.8125rem] py-3 m-0 text-center">
            <span className="dot up inline-block w-[6px] h-[6px] rounded-full bg-success" />{' '}
            {person.name} · Jetzt im Dienst
          </p>
        </div>
      )}
    </>
  );
}
