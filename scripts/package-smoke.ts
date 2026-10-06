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
  await run('pnpm', ['exec', 'tsc', '--noEmit'], customer);
  await run('pnpm', ['build'], customer);
  const assets = await readdir(join(customer, 'dist/assets'));
  for (const asset of assets.filter((a) => /\.(js|css)$/.test(a)))
    assert(
      !(await readFile(join(customer, 'dist/assets', asset), 'utf8')).includes(
        'sentinel-not-for-browser',
      ),
      'Secret leaked into browser bundle',
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
    const code = `import{createServer}from'@kieksme/csp-core/server';import{publicConfig}from'@kieksme/csp-core/build';import plugins from './portal.server.ts';const env={CSP_DEMO:'true',CSP_CONTACT_PHONE:'+49000',CSP_CONTENT_PATH:'content.json'};const app=await createServer({plugins,env,config:publicConfig(env)});const r=await app.inject({url:'/api/v1/external'});if(r.statusCode!==${exists ? 200 : 404})throw new Error('External route mismatch');await app.close();`;
    await writeFile(join(customer, 'smoke.mts'), code);
    await run('pnpm', ['exec', 'tsx', 'smoke.mts'], customer);
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
  await verifyRoute(false);
  await run('pnpm', ['build'], customer);
  console.log(
    'Packed packages: fresh customer install, typecheck, build, secret scan, external plugin add/remove and API routes passed.',
  );
} finally {
  await rm(temp, { recursive: true, force: true });
}
