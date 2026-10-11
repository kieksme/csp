import type { BrowserPlugin } from '@kieksme/csp-sdk';
import { cspPlugin } from '../package.json';
// The installed chat plugin owns the UI; no second chat section.
export default {
  id: 'slack',
  sdkVersion: cspPlugin.sdkVersion,
  requires: ['chat'],
  sections: [],
} satisfies BrowserPlugin;
