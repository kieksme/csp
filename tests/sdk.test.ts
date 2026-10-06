import { SDK_VERSION } from '../packages/sdk/src/index.js';
import { describe, it, expect, vi } from 'vitest';
import {
  LiveCache,
  activeShifts,
  safeTimezone,
  vCard,
  validatePlugins,
  safeUrl,
} from '../packages/sdk/src/index.js';
import { publicConfig } from '../packages/core/src/build.js';
describe('SDK contracts', () => {
  it('rejects duplicates, incompatible SDKs and missing dependencies', () => {
    expect(() =>
      validatePlugins([
        { id: 'x', sdkVersion: `^${SDK_VERSION}` },
        { id: 'x', sdkVersion: `^${SDK_VERSION}` },
      ]),
    ).toThrow('duplicate');
    expect(() => validatePlugins([{ id: 'x', sdkVersion: '<0.0.0' }])).toThrow(
      'needs SDK',
    );
    expect(() =>
      validatePlugins([
        { id: 'x', sdkVersion: `^${SDK_VERSION}`, requires: ['missing'] },
      ]),
    ).toThrow('requires');
  });
  it('handles exact shift boundaries, overlap and invalid timestamps', () => {
    const shifts = [
      {
        userId: 'a',
        name: 'Ada',
        start: '2026-10-06T08:00:00Z',
        end: '2026-10-06T10:00:00Z',
      },
      {
        userId: 'b',
        name: 'Ben',
        start: '2026-10-06T10:00:00Z',
        end: '2026-10-06T12:00:00Z',
      },
    ];
    expect(
      activeShifts(shifts, Date.parse('2026-10-06T10:00:00Z')).map(
        (s) => s.name,
      ),
    ).toEqual(['Ben']);
    expect(activeShifts([{ ...shifts[0], start: 'invalid' }])).toEqual([]);
    expect(safeTimezone('W. Europe Standard Time')).toBe('Europe/Berlin');
    expect(safeTimezone('invalid')).toBe('Europe/Berlin');
  });
  it('escapes and folds vCards without allowing field injection', () => {
    const card = vCard(
      {
        id: 'a',
        name: 'Ä'.repeat(80) + ';,\nEMAIL:evil',
        email: 'test@example.invalid',
        phones: ['+49000'],
      },
      'Demo',
    );
    expect(card).toContain('\\;\\,\\nEMAIL:evil');
    expect(card).not.toContain('\r\nEMAIL:evil');
    for (const line of card.trim().split('\r\n'))
      expect(Buffer.byteLength(line)).toBeLessThanOrEqual(75);
  });
  it('exports only allowlisted public configuration', () => {
    const cfg = publicConfig({
      CSP_NAME: 'Demo',
      CSP_CHAT_OPENAI_API_KEY: 'sentinel-secret',
      CSP_SIGNL4_API_KEY: 'sentinel-secret',
    });
    expect(JSON.stringify(cfg)).not.toContain('sentinel-secret');
    expect(() => safeUrl('javascript:alert(1)')).toThrow();
    expect(() => publicConfig({ CSP_BASE_PATH: 'bad' })).toThrow();
  });
  it('deduplicates requests, caches results and preserves last success on failure', async () => {
    let now = 100000;
    const cache = new LiveCache(30000, () => now);
    const loader = vi.fn(async () => ['a']);
    const results = await Promise.all([
      cache.get('x', loader),
      cache.get('x', loader),
    ]);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(results[0].stale).toBe(false);
    now += 31000;
    const fail = vi.fn(async () => {
      throw new Error('secret-key');
    });
    const stale = await cache.get('x', fail);
    expect(stale.data).toEqual(['a']);
    expect(stale.stale).toBe(true);
    expect(stale.error).not.toContain('secret');
    await cache.get('x', fail);
    expect(fail).toHaveBeenCalledTimes(1);
  });
});
