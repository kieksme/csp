import { z } from 'zod';
import type { ServerPlugin } from '@kieksme/csp-sdk';
import { cspPlugin } from '../package.json';
export default {
  id: 'swetrix',
  sdkVersion: cspPlugin.sdkVersion,
  configSchema: z.object({}),
  setup() {},
} satisfies ServerPlugin;
