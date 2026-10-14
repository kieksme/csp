import { mountPortal } from '@kieksme/csp-core/browser';
import '@kieksme/csp-core/style.css';
import type { PublicConfig } from '@kieksme/csp-sdk';
import plugins from './portal.browser';
import datadog from '@kieksme/csp-plugin-datadog/browser';
declare const __CSP_DATADOG_DEMO__: boolean;
declare const __CSP_CONFIG__: PublicConfig;
mountPortal(
  __CSP_DATADOG_DEMO__
    ? { ...__CSP_CONFIG__, demo: true, staticDemo: true }
    : __CSP_CONFIG__,
  __CSP_DATADOG_DEMO__
    ? [
        datadog,
        ...plugins.filter((p) => !['signl4', 'kuma', 'teams'].includes(p.id)),
      ]
    : plugins,
);
