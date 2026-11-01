// Temporary, generated backports until customers adopt a published MCP Core.
import { readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
const require = createRequire(import.meta.url);
const { transform } = createRequire(require.resolve('tsup'))('esbuild');
const source = await readFile(
  new URL('../packages/core/src/mcp.ts', import.meta.url),
  'utf8',
);
const customers = [
  ['csp-acme', '0.15.1'],
  ['csp-thinkport', '0.8.0'],
  ['csp-netcombw', '0.7.0'],
];
const check = process.argv.includes('--check');
const directory = resolve(
  process.argv.find((arg, i) => i > 1 && arg !== '--check') ??
    new URL('../../', import.meta.url).pathname,
);
const temp = await mkdtemp(join(tmpdir(), 'csp-mcp-backport-'));
try {
  for (const [customer, version] of customers) {
    const root = join(directory, customer);
    const packageRoot = join(root, 'node_modules/@kieksme/csp-core');
    const pkg = JSON.parse(
      await readFile(join(packageRoot, 'package.json'), 'utf8'),
    );
    if (pkg.version !== version)
      throw new Error(
        `${customer}: expected Core ${version}; install the frozen lockfile first`,
      );
    const patchFile = join(
      root,
      'patches',
      `@kieksme__csp-core@${version}.patch`,
    );
    const registration = '  registerMcp(ctx, installed, allowed);\n';
    const importLine = 'import { registerMcp } from "./mcp.js";\n';
    const original = (
      await readFile(join(packageRoot, 'dist/server.js'), 'utf8')
    )
      .replace(importLine, '')
      .replace(registration, '');
    const anchor = '  app.get("/health",';
    if (
      !original.includes(anchor) ||
      !original.includes('installed.add(plugin.id)')
    )
      throw new Error(`${customer}: unsupported server layout`);
    const updated =
      importLine + original.replace(anchor, registration + anchor);
    const compiled = await transform(
      source.replace(
        "import { version } from '../package.json';",
        `const version = ${JSON.stringify(version + '+mcp')};`,
      ),
      { loader: 'ts', format: 'esm', target: 'node22' },
    );
    const before = join(temp, 'before'),
      after = join(temp, 'after');
    await writeFile(before, original);
    await writeFile(after, updated);
    let diff;
    try {
      diff = execFileSync(
        'diff',
        [
          '-u',
          '--label',
          'a/dist/server.js',
          before,
          '--label',
          'b/dist/server.js',
          after,
        ],
        { encoding: 'utf8' },
      );
    } catch (error) {
      if (error.status !== 1) throw error;
      diff = error.stdout;
    }
    const lines = compiled.code.trimEnd().split('\n');
    const patch =
      'diff --git a/dist/server.js b/dist/server.js\n' +
      diff +
      'diff --git a/dist/mcp.js b/dist/mcp.js\nnew file mode 100644\n--- /dev/null\n+++ b/dist/mcp.js\n' +
      `@@ -0,0 +1,${lines.length} @@\n` +
      lines.map((line) => '+' + line).join('\n') +
      '\n';
    if (check) {
      if ((await readFile(patchFile, 'utf8')) !== patch)
        throw new Error(`${customer}: stale MCP patch`);
    } else await writeFile(patchFile, patch);
    console.log(
      `${customer}: ${check ? 'verified' : 'generated'} Core ${version}`,
    );
  }
} finally {
  await rm(temp, { recursive: true, force: true });
}
