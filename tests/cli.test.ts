import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { it, expect } from 'vitest';
import { managePlugin } from '../packages/cli/src/index.js';
it('installs, registers and removes an external plugin, updating package and lock', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'csp-cli-test-'));
  const pkg = join(cwd, 'package.json');
  await writeFile(pkg, JSON.stringify({ dependencies: {} }));
  await writeFile(join(cwd, 'portal.plugins.json'), '[]');
  const runner = async (args: string[]) => {
    const value = JSON.parse(await readFile(pkg, 'utf8'));
    if (args[0] === 'add') {
      value.dependencies['fixture-plugin'] = 'file:fixture.tgz';
      await mkdir(join(cwd, 'node_modules/fixture-plugin'), {
        recursive: true,
      });
      await writeFile(
        join(cwd, 'node_modules/fixture-plugin/package.json'),
        JSON.stringify({
          cspPlugin: {
            id: 'fixture',
            sdkVersion: '^0.1.0',
            browser: './browser',
            server: './server',
          },
        }),
      );
    }
    if (args[0] === 'remove') delete value.dependencies['fixture-plugin'];
    await writeFile(pkg, JSON.stringify(value));
    await writeFile(join(cwd, 'pnpm-lock.yaml'), JSON.stringify(value));
  };
  try {
    expect(await managePlugin('add', './fixture.tgz', cwd, runner)).toEqual([
      'fixture-plugin',
    ]);
    expect(await readFile(join(cwd, 'portal.browser.ts'), 'utf8')).toContain(
      'fixture-plugin/browser',
    );
    expect(await managePlugin('list', undefined, cwd, runner)).toEqual([
      'fixture-plugin',
    ]);
    expect(await managePlugin('remove', 'fixture-plugin', cwd, runner)).toEqual(
      [],
    );
    expect(await readFile(join(cwd, 'portal.server.ts'), 'utf8')).not.toContain(
      'fixture-plugin',
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
it('rolls back package, lock and registry when compatibility validation fails', async () => {
  const cwd = await mkdtemp(join(tmpdir(), 'csp-cli-rollback-'));
  const pkg = join(cwd, 'package.json');
  await writeFile(pkg, '{"dependencies":{}}');
  await writeFile(join(cwd, 'portal.plugins.json'), '[]');
  await writeFile(join(cwd, 'pnpm-lock.yaml'), 'original');
  const runner = async (args: string[]) => {
    if (args[0] === 'add') {
      await writeFile(pkg, '{"dependencies":{"bad-plugin":"1.0.0"}}');
      await mkdir(join(cwd, 'node_modules/bad-plugin'), { recursive: true });
      await writeFile(
        join(cwd, 'node_modules/bad-plugin/package.json'),
        JSON.stringify({
          cspPlugin: {
            id: 'bad',
            sdkVersion: '^99.0.0',
            browser: './browser',
            server: './server',
          },
        }),
      );
    }
  };
  try {
    await expect(
      managePlugin('add', 'bad-plugin', cwd, runner),
    ).rejects.toThrow('needs SDK');
    expect(await readFile(pkg, 'utf8')).toBe('{"dependencies":{}}');
    expect(await readFile(join(cwd, 'pnpm-lock.yaml'), 'utf8')).toBe(
      'original',
    );
  } finally {
    await rm(cwd, { recursive: true, force: true });
  }
});
