import { cspPlugin } from '../package.json';
import type { BrowserPlugin, BrowserContext } from '@kieksme/csp-sdk';
function Contact({ config }: BrowserContext) {
  return (
    <div className="contact-grid grid grid-cols-[1.2fr_1fr] gap-5 compact:grid-cols-[1fr] compact:gap-3.75">
      <div className="contact-card call-card py-7 px-8 rounded-card compact:p-5.75 flex items-center justify-between gap-5 bg-accent text-accent-ink border-0 [&_a]:inline-flex [&_a]:gap-3 [&_a]:items-center [&_a]:no-underline [&_a]:text-[1.25rem] [&_a]:font-extrabold [&_a]:whitespace-nowrap [&_p]:text-[0.75rem] [&_p]:m-[0_0_calc(var(--spacing)_*_2)] [&_p]:opacity-[1] [&_span]:block [&_span]:font-mono [&_span]:text-[0.75rem] compact:flex-wrap compact:[&_a]:text-[1.125rem]">
        <div>
          <p>{config.phoneLabel}</p>
          <span>{config.phone}</span>
        </div>
        <a href={'tel:' + config.phone.replace(/[^+\d]/g, '')}>
          Jetzt anrufen <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="contact-card availability py-7 px-8 bg-card border border-line rounded-card compact:p-5.75 [&_strong]:block [&_strong]:text-[1.1875rem] [&_strong]:mb-2 [&_p]:text-muted [&_p]:m-0 [&_p]:text-[0.8125rem]">
        <strong>Direkter Draht statt Umwege.</strong>
        <p>
          Bei dringenden Störungen erreichen Sie unser Operations-Team über die
          Hotline. Den aktuellen Dienst sehen Sie im Schichtplan.
        </p>
      </div>
    </div>
  );
}
export default {
  id: 'contact',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [
    {
      id: 'contact',
      label: 'Kontakt',
      title: 'Wenn es darauf ankommt.',
      order: 0,
      component: Contact,
    },
  ],
} satisfies BrowserPlugin;
