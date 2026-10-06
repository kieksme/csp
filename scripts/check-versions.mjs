import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const readJSON = async (path) =>
  JSON.parse(await readFile(new URL(path, root), 'utf8'));
const { version } = await readJSON('package.json');
const manifest = await readJSON('.release-please-manifest.json');
assert.equal(manifest['.'], version, 'Release manifest version differs');
const config = await readJSON('release-please-config.json');
const extraFiles = config.packages['.']['extra-files'];

for (const group of ['packages', 'apps', 'templates']) {
  for (const entry of await readdir(new URL(`${group}/`, root), {
    withFileTypes: true,
  })) {
    if (!entry.isDirectory()) continue;
    const path = `${group}/${entry.name}/package.json`;
    const pkg = await readJSON(path);
    if (group === 'packages') {
      assert.match(
        pkg.name,
        /^@kieksme\/csp-[a-z0-9]+(?:-[a-z0-9]+)*$/,
        `${path}: published packages must start with @kieksme/csp-`,
      );
      assert.notEqual(pkg.private, true, `${pkg.name}: must be publishable`);
      assert.equal(
        pkg.publishConfig?.access,
        'public',
        `${pkg.name}: must be public`,
      );
      assert.equal(
        pkg.publishConfig?.registry,
        'https://registry.npmjs.org',
        `${pkg.name}: must publish to npm`,
      );
    }
    assert.equal(pkg.version, version, `${pkg.name}: version differs`);
    assert(
      extraFiles.some(
        (file) => file.path === path && file.jsonpath === '$.version',
      ),
      `${pkg.name}: missing Release Please version update`,
    );
    if (pkg.cspPlugin) {
      assert.equal(
        pkg.cspPlugin.sdkVersion,
        `^${version}`,
        `${pkg.name}: SDK compatibility differs`,
      );
      assert(
        extraFiles.some(
          (file) =>
            file.path === path && file.jsonpath === '$.cspPlugin.sdkVersion',
        ),
        `${pkg.name}: missing Release Please SDK compatibility update`,
      );
    }
  }
}
console.log(`All workspace packages use release version ${version}.`);
