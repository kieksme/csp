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
    <div className="duty-header col-span-full grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.2fr)] items-center gap-8 px-15 pt-10 pb-8 contained:px-11.25 compact:grid-cols-[1fr] compact:gap-3 compact:px-7.5 compact:pt-8 narrow:px-6.25">
      <div className="hero-copy duty-copy min-w-0">
        <p className="eyebrow font-mono text-[0.6875rem] uppercase tracking-[2px] mb-4">
          <span className="signal-mark w-[6px] h-[6px] bg-accent-secondary rounded-full" />{' '}
          Ihr Kundenservice
        </p>
        <h1 className="text-[clamp(30px,3.6vw,48px)] tracking-[-1.5px] leading-[1.1] font-semibold mt-0 mb-5 [overflow-wrap:anywhere]">
          {ctx.config.name}
        </h1>
        <p className="text-[1rem] leading-[1.7] m-0 [color:color-mix(in_srgb,_var(--hero-ink)_85%,_var(--hero))]">
          {ctx.config.tagline}
        </p>
      </div>
      <div
        className="duty-service grid grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] items-center gap-5 min-w-0 narrow:gap-3"
        aria-live="polite"
        aria-atomic="true"
      >
        <div
          className={`duty-message min-w-0 ${person ? '' : 'col-span-full'}`}
        >
          <p className="duty-badge text-[0.6875rem] leading-[1.6] uppercase tracking-[1px] font-semibold mt-0 mb-3">
            {person ? (
              <>
                <span className="dot up inline-block w-[6px] h-[6px] rounded-full bg-accent-secondary" />{' '}
                Jetzt im Dienst · Für Sie zuständig
              </>
            ) : (
              'Ihr Service-Team'
            )}
          </p>
          <p className="duty-greeting text-[1rem] leading-[1.6] mt-0 mb-3">
            {person ? (
              <>
                Hallo, mein Name ist{' '}
                <strong className="duty-name">{person.name}.</strong>
              </>
            ) : live.loading ? (
              'Wir prüfen, wer für Sie da ist …'
            ) : !confirmed ? (
              'Erreichbarkeit derzeit nicht bestätigt.'
            ) : (
              'Derzeit hat niemand Schicht.'
            )}
          </p>
          {person ? (
            <>
              <p className="duty-question text-[1.125rem] leading-[1.45] mt-0 mb-3 font-semibold">
                Wie kann ich Ihnen helfen?
              </p>
              {current.length > 1 && (
                <p className="text-[0.8125rem] leading-[1.6]">
                  Ebenfalls im Dienst:{' '}
                  {current
                    .slice(1)
                    .map((s) => s.name)
                    .join(', ')}
                  .
                </p>
              )}
            </>
          ) : (
            <p className="text-[0.9375rem] leading-[1.7]">
              {confirmed
                ? next
                  ? nextShiftLabel(next.start, now, timezone)
                  : 'Der nächste Schichtbeginn ist noch nicht bekannt. Bitte nutzen Sie unsere Kontaktmöglichkeiten.'
                : 'Bitte nutzen Sie unsere Kontaktmöglichkeiten. Wir können die aktuelle Schicht derzeit nicht bestätigen.'}
            </p>
          )}
          <p className="duty-timezone text-[0.6875rem] leading-[1.6] opacity-[0.85] mt-4 mb-0">
            Schichtzeiten: {timezone}
          </p>
          {(live.stale || live.loading) && <DataState {...live} />}
        </div>
        {person && (
          <div
            className="duty-portrait relative isolate aspect-[1/1.15] w-full max-w-[300px] justify-self-end"
            key={person.userId}
          >
            <div
              aria-hidden="true"
              className="absolute bottom-0 inset-x-0 aspect-square rounded-full border-solid border-[4px] [border-color:color-mix(in_srgb,_var(--hero-ink)_25%,_transparent)] [background:color-mix(in_srgb,_var(--accent)_18%,_var(--hero))]"
            />
            <div className="absolute top-0 bottom-[4px] left-[4px] right-[4px] overflow-hidden [border-radius:0_0_50%_50%/0_0_43.5%_43.5%] [&_.avatar]:w-full [&_.avatar]:h-full [&_.avatar]:max-w-none [&_.avatar]:object-cover [&_.avatar]:object-bottom [&_.avatar]:bg-transparent [&_.avatar]:rounded-none [&_.avatar]:text-[64px] [&_.avatar]:flex [&_.avatar]:items-center [&_.avatar]:justify-center [&_.avatar]:text-hero-ink">
              <Avatar
                config={ctx.config}
                id={person.userId}
                name={person.name}
                provider={profile?.avatar}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
