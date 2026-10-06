import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
export default {
  id: 'contact',
  sdkVersion: '^0.1.0',
  configSchema: z.object({ CSP_CONTACT_PHONE: z.string().min(3) }),
  setup() {},
} satisfies ServerPlugin;
