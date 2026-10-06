import { cspPlugin } from '../package.json';
import type { BrowserPlugin, BrowserContext } from '@kieksme/csp-sdk';
function Contact({ config }: BrowserContext) {
  return (
    <div className="contact-grid">
      <div className="contact-card call-card">
        <div>
          <p>{config.phoneLabel}</p>
          <span>{config.phone}</span>
        </div>
        <a href={'tel:' + config.phone.replace(/[^+\d]/g, '')}>
          Jetzt anrufen <span aria-hidden="true">↗</span>
        </a>
      </div>
      <div className="contact-card availability">
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
