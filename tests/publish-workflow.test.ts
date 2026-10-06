import { execFileSync } from 'node:child_process';
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { parse } from 'yaml';

const root = new URL('../', import.meta.url);
const workflow = parse(
  await readFile(new URL('.github/workflows/release.yml', root), 'utf8'),
);
const publish = workflow.jobs.publish;
const selectRegistry = publish.steps.find(
  (step: { name?: string }) => step.name === 'Select publishing registry',
);

it('publishes independently with credentials for each registry', () => {
  expect(publish.strategy['fail-fast']).toBe(false);
  expect(publish.strategy.matrix.include).toEqual([
    { target: 'npmjs', registry: 'https://registry.npmjs.org' },
    { target: 'GitHub Packages', registry: 'https://npm.pkg.github.com' },
  ]);
  expect(publish.permissions.packages).toBe('write');
  const npm = publish.steps.find(
    (step: { name?: string }) => step.name === 'Publish to npmjs',
  );
  const github = publish.steps.find(
    (step: { name?: string }) => step.name === 'Publish to GitHub Packages',
  );
  expect(npm.if).toBe("matrix.target == 'npmjs'");
  expect(npm.env.NODE_AUTH_TOKEN).toBe('${{ secrets.NPM_AUTH_TOKEN }}');
  expect(github.if).toBe("matrix.target == 'GitHub Packages'");
  expect(github.env.NODE_AUTH_TOKEN).toBe('${{ secrets.GITHUB_TOKEN }}');
  const credentialCheck = publish.steps.find(
    (step: { name?: string }) =>
      step.name === 'Check npm publishing credentials',
  );
  expect(credentialCheck.if).toBe(npm.if);
});

it.each(['https://registry.npmjs.org', 'https://npm.pkg.github.com'])(
  'packs the selected registry %s without changing names or versions',
  async (registry) => {
    const temp = await mkdtemp(join(tmpdir(), 'csp-registry-test-'));
    try {
      const originals = new Map();
      for (const directory of await readdir(new URL('packages/', root))) {
        const relative = `packages/${directory}/package.json`;
        const contents = await readFile(new URL(relative, root), 'utf8');
        originals.set(directory, JSON.parse(contents));
        await mkdir(join(temp, 'packages', directory), { recursive: true });
        await writeFile(join(temp, relative), contents);
      }
      // Execute the actual workflow step against copied manifests.
      execFileSync('bash', ['-e', '-c', selectRegistry.run], {
        cwd: temp,
        env: {
          ...process.env,
          PUBLISH_REGISTRY: registry,
          GITHUB_REPOSITORY: 'kieksme/csp',
        },
      });
      for (const [directory, original] of originals) {
        const pkg = JSON.parse(
          await readFile(
            join(temp, 'packages', directory, 'package.json'),
            'utf8',
          ),
        );
        expect(pkg.name).toBe(original.name);
        expect(pkg.version).toBe(original.version);
        expect(pkg.dependencies).toEqual(original.dependencies);
        expect(pkg.publishConfig).toEqual({ access: 'public', registry });
        expect(pkg.repository.url).toBe(
          'git+https://github.com/kieksme/csp.git',
        );
        expect(pkg.repository.directory).toBe(original.repository.directory);
      }
      const cwd = join(temp, 'packages/sdk');
      const [archive] = JSON.parse(
        execFileSync('npm', ['pack', '--ignore-scripts', '--json'], {
          cwd,
          encoding: 'utf8',
        }),
      );
      const packed = JSON.parse(
        execFileSync(
          'tar',
          ['-xOf', archive.filename, 'package/package.json'],
          {
            cwd,
            encoding: 'utf8',
          },
        ),
      );
      expect(packed.publishConfig.registry).toBe(registry);
      expect(packed.name).toBe('@kieksme/csp-sdk');
      expect(packed.version).toBe(originals.get('sdk').version);
    } finally {
      await rm(temp, { recursive: true, force: true });
    }
  },
);
