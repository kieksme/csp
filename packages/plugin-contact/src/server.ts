import { cspPlugin } from '../package.json';
import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
export default {
  id: 'contact',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema: z.object({ CSP_CONTACT_PHONE: z.string().min(3) }),
  setup() {},
} satisfies ServerPlugin;
