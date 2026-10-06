import { expect, it } from 'vitest';
import { SDK_VERSION, validatePlugins } from '../packages/sdk/src/index.js';
import { version } from '../packages/sdk/package.json';

it('uses the published SDK package version at runtime', () => {
  expect(SDK_VERSION).toBe(version);
});

it.each(['chat', 'contact', 'content', 'kuma', 'signl4'])(
  'keeps %s plugin metadata and both entry points compatible with the release',
  async (id) => {
    const { default: pkg } = await import(
      `../packages/plugin-${id}/package.json`
    );
    const { default: browser } = await import(
      `../packages/plugin-${id}/src/browser.tsx`
    );
    const { default: server } = await import(
      `../packages/plugin-${id}/src/server.ts`
    );
    expect(pkg.version).toBe(version);
    expect(pkg.cspPlugin.sdkVersion).toBe(`^${version}`);
    expect(browser.sdkVersion).toBe(pkg.cspPlugin.sdkVersion);
    expect(server.sdkVersion).toBe(pkg.cspPlugin.sdkVersion);
    expect(() => validatePlugins([browser])).not.toThrow();
    expect(() => validatePlugins([server])).not.toThrow();
  },
);
