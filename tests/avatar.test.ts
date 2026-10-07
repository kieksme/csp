import { expect, it } from 'vitest';
import { avatarUrl } from '../packages/plugin-signl4/src/avatar.js';
import { publicConfig } from '../packages/core/src/config.js';
it('prefers provider IDs, normalizes names and falls back to the API avatar', () => {
  const config = {
    ...publicConfig({}),
    avatarOverrides: { id: '/id.webp' },
    avatarNames: { 'lena demo': '/name.webp' },
  };
  expect(avatarUrl(config, 'id', ' Lena Demo ')).toBe('/id.webp');
  expect(avatarUrl(config, 'other', ' LENA DEMO ')).toBe('/name.webp');
  expect(avatarUrl(config, 'other', 'Unknown', '/team/other/avatar')).toBe(
    'http://localhost:3001/api/v1/team/other/avatar',
  );
});
