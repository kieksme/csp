import { mountPortal } from '@kieksme/csp-core/browser';
import '@kieksme/csp-core/style.css';
import type { PublicConfig } from '@kieksme/csp-sdk';
import plugins from './portal.browser';
declare const __CSP_CONFIG__: PublicConfig;
mountPortal(__CSP_CONFIG__, plugins);
