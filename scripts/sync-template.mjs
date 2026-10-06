import { cp, readFile, writeFile, rm } from 'node:fs/promises';
const target = new URL('../packages/cli/template/', import.meta.url);
await rm(target, { recursive: true, force: true });
await cp(new URL('../templates/customer/', import.meta.url), target, {
  recursive: true,
  filter: (source) =>
    !/(?:^|\/)(?:node_modules|dist|dist-api|\.env(?:\.local)?)$/.test(source),
});
const file = new URL('package.json', target);
const pkg = JSON.parse(await readFile(file, 'utf8'));
for (const section of ['dependencies', 'devDependencies'])
  for (const [name, version] of Object.entries(pkg[section] ?? {}))
    if (version.startsWith('workspace:'))
      pkg[section][name] = JSON.parse(
        await readFile(
          new URL(
            '../packages/' +
              name.replace('@kieksme/csp-', '') +
              '/package.json',
            import.meta.url,
          ),
          'utf8',
        ),
      ).version;
await writeFile(file, JSON.stringify(pkg, null, 2) + '\n');
