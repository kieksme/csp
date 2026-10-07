import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
import { spawn } from 'node:child_process';
import { parse } from 'dotenv';
import { loadProfile } from '@kieksme/csp-core/profile';
import { portalBuild } from '@kieksme/csp-core/build';
import { build, createServer as createViteServer, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { build as bundle } from 'esbuild';
import type { Env } from '@kieksme/csp-sdk';
import { generateRegistry } from './index.js';
export async function runtimeEnv(
  directory: string,
  mode?: string,
): Promise<Env> {
  const result: Env = {};
  for (const file of ['.env.branding', '.env', '.env.local']) {
    try {
      Object.assign(result, parse(await readFile(join(directory, file))));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  if (mode) Object.assign(result, loadEnv(mode, directory, ''));
  return { ...result, ...process.env };
}
export async function runPortal(
  command: string,
  file: string,
  mode = 'production',
  production = false,
) {
  file = resolve(file);
  const directory = dirname(file);
  const loaded = loadProfile(
    file,
    await runtimeEnv(
      directory,
      command === 'build' || command === 'dev' ? mode : undefined,
    ),
    production,
  );
  if (command === 'validate' || command === 'inspect') {
    await generateRegistry(directory, loaded.profile.plugins);
    console.log(
      JSON.stringify(
        command === 'inspect'
          ? { public: loaded.config, origins: loaded.origins }
          : {
              valid: true,
              id: loaded.profile.id,
              plugins: loaded.profile.plugins,
            },
        null,
        2,
      ),
    );
    return;
  }
  const work = join(directory, '.csp');
  await mkdir(work, { recursive: true });
  if (command === 'start') {
    // Validate the current profile before executing the matching built server.
    const child = spawn(
      process.execPath,
      [join(directory, 'dist-api/server.js')],
      {
        cwd: directory,
        env: { ...process.env, CSP_CONFIG_PATH: file },
        stdio: 'inherit',
      },
    );
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.once(signal, () => child.kill(signal));
    await new Promise<void>((ok, fail) => {
      child.once('error', fail);
      child.once('exit', (code) =>
        code === 0 ? ok() : fail(new Error(`Portal server exited ${code}`)),
      );
    });
    return;
  }
  await generateRegistry(directory, loaded.profile.plugins, work);
  const pkg = JSON.parse(
    await readFile(join(directory, 'package.json'), 'utf8'),
  );
  loaded.config.customerVersion = pkg.version;
  await writeFile(
    join(work, 'main.tsx'),
    `import { mountPortal } from '@kieksme/csp-core/browser';\nimport '@kieksme/csp-core/style.css';\nimport plugins from './portal.browser';\nmountPortal(__CSP_CONFIG__,plugins);\n`,
  );
  await writeFile(
    join(work, 'index.html'),
    '<!doctype html><html lang="de"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><div id="root"></div><script type="module" src="./main.tsx"></script></body></html>',
  );
  await writeFile(
    join(work, 'server.ts'),
    `import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { createServer } from '@kieksme/csp-core/server';
import { loadProfile, loadRuntimeEnv } from '@kieksme/csp-core/profile';
import plugins from './portal.server';
const file=resolve(process.env.CSP_CONFIG_PATH ?? ${JSON.stringify(file.startsWith(directory + '/') ? file.slice(directory.length + 1) : file)});
const loaded=loadProfile(file,loadRuntimeEnv(dirname(file)));
if(JSON.stringify(loaded.profile.plugins)!==${JSON.stringify(JSON.stringify(loaded.profile.plugins))}) throw new Error('Plugin selection changed. Rebuild frontend and API.');
const app=await createServer({plugins,config:loaded.config,env:loaded.env});
const port=loaded.env.CSP_PORT ?? '3001';
if(!/^\\d+$/.test(port)||Number(port)>65535||Number(port)<1) throw new Error('CSP_PORT must be between 1 and 65535');
await app.listen({port:Number(port),host:loaded.env.CSP_HOST ?? '0.0.0.0'});
for(const signal of ['SIGTERM','SIGINT']) process.once(signal,()=>void app.close().then(()=>process.exit(0)));
`,
  );
  const assetsPlugin = {
    name: 'csp-profile-assets',
    generateBundle(this: {
      emitFile: (x: {
        type: 'asset';
        fileName: string;
        source: Buffer;
      }) => void;
    }) {
      for (const asset of loaded.assets)
        this.emitFile({
          type: 'asset',
          fileName: asset.fileName,
          source: readFileSync(asset.source),
        });
    },
  };
  const options = {
    configFile: false as const,
    root: work,
    envDir: directory,
    publicDir: false as const,
    plugins: [react(), portalBuild(loaded.config, directory), assetsPlugin],
    resolve: {
      alias: {
        react: dirname(
          createRequire(
            import.meta.resolve('@kieksme/csp-core/browser'),
          ).resolve('react/package.json'),
        ),
        'react-dom': dirname(
          createRequire(
            import.meta.resolve('@kieksme/csp-core/browser'),
          ).resolve('react-dom/package.json'),
        ),
      },
    },
    build: { outDir: join(directory, 'dist'), emptyOutDir: true },
    server: { host: '127.0.0.1', port: 5173, strictPort: true },
  };
  if (command === 'dev') {
    // Serve only explicitly referenced assets.
    const server = await createViteServer(options);
    server.middlewares.use((req, res, next) => {
      const asset = loaded.assets.find(
        (a) => req.url?.split('?')[0] === loaded.config.basePath + a.fileName,
      );
      if (!asset) return next();
      const ext = asset.fileName.split('.').pop();
      res.setHeader(
        'Content-Type',
        ext === 'svg'
          ? 'image/svg+xml'
          : ext === 'jpg' || ext === 'jpeg'
            ? 'image/jpeg'
            : `image/${ext}`,
      );
      res.end(readFileSync(asset.source));
    });
    await bundle({
      entryPoints: [join(work, 'server.ts')],
      bundle: true,
      packages: 'external',
      platform: 'node',
      format: 'esm',
      outfile: join(work, 'server-dev.mjs'),
    });
    await server.listen();
    server.printUrls();
    const api = spawn(process.execPath, [join(work, 'server-dev.mjs')], {
      cwd: directory,
      env: { ...process.env, CSP_CONFIG_PATH: file },
      stdio: 'inherit',
    });
    api.once('error', (error) => {
      console.error(error.message);
      void server.close();
      process.exitCode = 1;
    });
    api.once('exit', (code) => {
      void server.close();
      if (code) process.exitCode = code;
    });
    for (const signal of ['SIGINT', 'SIGTERM'] as const)
      process.once(signal, () => {
        api.kill(signal);
        void server.close();
      });
    return;
  }
  await build(options);
  await bundle({
    entryPoints: [join(work, 'server.ts')],
    bundle: true,
    packages: 'external',
    platform: 'node',
    format: 'esm',
    outfile: join(directory, 'dist-api/server.js'),
  });
  await cp(file, join(directory, 'dist-api/portal.config.json'));
}
import { readFileSync } from 'node:fs';
