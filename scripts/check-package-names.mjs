import { readFile, readdir } from 'node:fs/promises';
for (const directory of await readdir(
  new URL('../packages/', import.meta.url),
)) {
  const pkg = JSON.parse(
    await readFile(
      new URL(`../packages/${directory}/package.json`, import.meta.url),
      'utf8',
    ),
  );
  const response = await fetch(
    'https://registry.npmjs.org/' + encodeURIComponent(pkg.name),
    { signal: AbortSignal.timeout(15000) },
  );
  if (response.status === 404)
    console.log(
      `${pkg.name}: currently unpublished; scope publishing rights still required`,
    );
  else if (response.ok) {
    console.error(
      `${pkg.name}: already exists; verify ownership before release`,
    );
    process.exitCode = 1;
  } else throw new Error(`Registry check failed: ${response.status}`);
}
