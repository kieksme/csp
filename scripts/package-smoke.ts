import {
  mkdtemp,
  readFile,
  writeFile,
  readdir,
  rm,
  mkdir,
} from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { spawn } from 'node:child_process';
import assert from 'node:assert/strict';
const root = process.cwd();
const { version: sdkVersion } = JSON.parse(
  await readFile(join(root, 'packages/sdk/package.json'), 'utf8'),
);
const temp = await mkdtemp(join(tmpdir(), 'csp-packed-'));
async function run(
  cmd: string,
  args: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = process.env,
) {
  return new Promise<string>((ok, fail) => {
    const child = spawn(cmd, args, { cwd, env, shell: false });
    let output = '';
    child.stdout.on('data', (x) => (output += x));
    child.stderr.on('data', (x) => (output += x));
    const timeout = setTimeout(() => {
      child.kill('SIGKILL');
    }, 180000);
    child.once('error', fail);
    child.once('exit', (code) => {
      clearTimeout(timeout);
      code === 0
        ? ok(output)
        : fail(
            new Error(`${cmd} ${args.join(' ')} failed (${code}):\n${output}`),
          );
    });
  });
}
try {
  const archives = join(temp, 'archives');
  await mkdir(archives);
  const overrides: Record<string, string> = {};
  for (const directory of await readdir(join(root, 'packages'))) {
    if (
      directory === 'cli' ||
      directory === 'core' ||
      directory === 'sdk' ||
      directory.startsWith('plugin-')
    ) {
      const cwd = join(root, 'packages', directory);
      const pkg = JSON.parse(await readFile(join(cwd, 'package.json'), 'utf8'));
      await run('pnpm', ['pack', '--pack-destination', archives], cwd);
      const archive = (await readdir(archives)).find(
        (file) =>
          file ===
          pkg.name.replace('@', '').replace('/', '-') +
            '-' +
            pkg.version +
            '.tgz',
      );
      assert(archive, `Missing tarball: ${pkg.name}`);
      overrides[pkg.name] = 'file:' + join(archives, archive);
    }
  }
  const customer = join(temp, 'customer');
  await run(
    'node',
    [join(root, 'packages/cli/dist/index.js'), 'init', customer],
    temp,
  );
  const pkgPath = join(customer, 'package.json');
  const pkg = JSON.parse(await readFile(pkgPath, 'utf8'));
  await writeFile(
    join(customer, 'pnpm-workspace.yaml'),
    JSON.stringify(
      { overrides, allowBuilds: { esbuild: true, sharp: false } },
      null,
      2,
    ),
  );
  pkg.devDependencies['@kieksme/csp-cli'] = overrides['@kieksme/csp-cli'];
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2));
  await writeFile(
    join(customer, '.env'),
    'CSP_DEMO=true\nCSP_NAME=Packed Customer\nCSP_CONTACT_PHONE=+49000\nCSP_API_URL=http://localhost:3999\nCSP_ALLOWED_ORIGINS=http://localhost:4173\nCSP_CHAT_OPENAI_API_KEY=sentinel-not-for-browser\nCSP_SIGNL4_API_KEY=sentinel-not-for-browser\n',
  );
  await run('pnpm', ['install'], customer);
  await run('pnpm', ['exec', 'csp', 'validate'], customer);
  for (const entry of ['main.tsx', 'server.ts', 'vite.config.ts', 'Dockerfile'])
    assert(
      !(await readdir(customer)).includes(entry),
      'Customer entrypoint still copied',
    );
  await run('pnpm', ['build'], customer);
  const assets = await readdir(join(customer, 'dist/assets'));
  for (const asset of assets.filter((a) => /\.(js|css)$/.test(a)))
    assert(
      !(await readFile(join(customer, 'dist/assets', asset), 'utf8')).includes(
        'sentinel-not-for-browser',
      ),
      'Secret leaked into browser bundle',
    );
  const profilePath = join(customer, 'portal.config.json');
  const profile = JSON.parse(await readFile(profilePath, 'utf8'));
  profile.public.basePath = '/pilot/';
  profile.branding.logoFile = 'public/logo.svg';
  profile.branding.iconFile = 'public/logo.svg';
  profile.avatarsFile = 'avatars.json';
  await mkdir(join(customer, 'public'), { recursive: true });
  await writeFile(
    join(customer, 'public/logo.svg'),
    '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="#176b58"/></svg>',
  );
  await writeFile(join(customer, 'public/unused.eps'), 'unused print source');
  await writeFile(
    join(customer, 'avatars.json'),
    JSON.stringify({
      ids: { 'demo-lena': 'public/logo.svg' },
      names: { 'Lena Demo': 'public/logo.svg' },
    }),
  );
  await writeFile(profilePath, JSON.stringify(profile, null, 2));
  await run('pnpm', ['build'], customer);
  const manifest = JSON.parse(
    await readFile(join(customer, 'dist/manifest.webmanifest'), 'utf8'),
  );
  assert.equal(manifest.scope, '/pilot/');
  assert(
    (await readFile(join(customer, 'dist/sw.js'), 'utf8')).includes('/pilot/'),
  );
  assert(
    (await readFile(join(customer, 'dist/index.html'), 'utf8')).includes(
      '/pilot/assets/',
    ),
  );
  assert(
    (await readdir(join(customer, 'dist/assets'))).some((x) =>
      x.endsWith('-logo.svg'),
    ),
  );
  assert(
    !(await readdir(join(customer, 'dist/assets'))).some((x) =>
      x.endsWith('.eps'),
    ),
  );
  const cli = join(customer, 'node_modules/@kieksme/csp-cli/dist/index.js');
  // A third-party plugin has no workspace imports; installation is a real pnpm transaction.
  const fixture = join(temp, 'fixture');
  await mkdir(fixture);
  await writeFile(
    join(fixture, 'package.json'),
    JSON.stringify({
      name: 'csp-smoke-external-plugin',
      version: '1.0.0',
      type: 'module',
      exports: { './browser': './browser.js', './server': './server.js' },
      cspPlugin: {
        id: 'external',
        sdkVersion: `^${sdkVersion}`,
        browser: './browser',
        server: './server',
      },
      dependencies: { '@kieksme/csp-sdk': sdkVersion },
    }),
  );
  await writeFile(
    join(fixture, 'browser.js'),
    `import React from 'react'; export default {id:'external',sdkVersion:'^${sdkVersion}',sections:[{id:'external',title:'External plugin',label:'External',order:90,component:()=>React.createElement('p',null,'External fixture')}]};`,
  );
  await writeFile(
    join(fixture, 'server.js'),
    `import {z} from 'zod'; export default {id:'external',sdkVersion:'^${sdkVersion}',configSchema:z.object({}),setup(ctx){ctx.app.get('/api/v1/external',async()=>({external:true}));}};`,
  );
  const fixturePkg = JSON.parse(
    await readFile(join(fixture, 'package.json'), 'utf8'),
  );
  fixturePkg.dependencies.zod = '^3.25.76';
  fixturePkg.peerDependencies = { react: '^19.0.0' };
  await writeFile(join(fixture, 'package.json'), JSON.stringify(fixturePkg));
  await run(
    'npm',
    ['pack', '--pack-destination', archives, '--ignore-scripts'],
    fixture,
  );
  await run(
    'node',
    [
      cli,
      'plugin',
      'add',
      join(archives, 'csp-smoke-external-plugin-1.0.0.tgz'),
    ],
    customer,
  );
  await run('pnpm', ['build'], customer);
  async function verifyRoute(exists: boolean) {
    const child = spawn('node', [join(customer, 'dist-api/server.js')], {
      cwd: customer,
      env: { ...process.env, CSP_PORT: '3999' },
      stdio: 'pipe',
    });
    const exited = new Promise<void>((ok) => child.once('exit', () => ok()));
    let errors = '';
    child.stderr.on('data', (x) => (errors += x));
    try {
      let ready = false;
      for (let i = 0; i < 100; i++) {
        if (child.exitCode !== null) throw new Error('API failed: ' + errors);
        try {
          const response = await fetch('http://127.0.0.1:3999/health');
          if (response.ok) {
            ready = true;
            break;
          }
        } catch {}
        await new Promise((ok) => setTimeout(ok, 100));
      }
      assert(ready, 'API startup timeout: ' + errors);
      const route = await fetch('http://127.0.0.1:3999/api/v1/external');
      assert.equal(route.status, exists ? 200 : 404);
      const chat = await fetch('http://127.0.0.1:3999/api/v1/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [{ role: 'user', content: 'Help' }] }),
      });
      assert.equal(chat.status, 200);
      assert(
        (await chat.text()).includes('event: done'),
        'Demo chat stream did not finish',
      );
    } finally {
      child.kill('SIGTERM');
      await exited;
    }
  }
  await verifyRoute(true);
  assert(
    (await readFile(join(customer, 'pnpm-lock.yaml'), 'utf8')).includes(
      'csp-smoke-external-plugin',
    ),
  );
  await run(
    'node',
    [cli, 'plugin', 'remove', 'csp-smoke-external-plugin'],
    customer,
  );
  await run('pnpm', ['build'], customer);
  await verifyRoute(false);
  console.log(
    'Packed packages: fresh customer install, validation, root/subpath builds, referenced assets, secret scan, external plugin add/remove and API routes passed.',
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
