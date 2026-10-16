import { useEffect } from 'react';
import type { BrowserPlugin, BrowserContext } from '@kieksme/csp-sdk';
import { cspPlugin } from '../package.json';
import { startTracking, trackingAllowed, createTracker } from './tracker.js';
function Integration({ config }: BrowserContext) {
  const settings = config.analytics?.swetrix;
  useEffect(() => {
    if (!trackingAllowed(settings, location.hostname, navigator.doNotTrack))
      return;
    return startTracking(settings!, createTracker(settings!));
  }, [settings]);
  return null;
}
export default {
  id: 'swetrix',
  sdkVersion: cspPlugin.sdkVersion,
  sections: [],
  integration: Integration,
} satisfies BrowserPlugin;
