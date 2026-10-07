import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  mkdtemp,
  mkdir,
  writeFile,
  readFile,
  readdir,
  rm,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderWikiMarkdown, syncWiki } from '../scripts/sync-wiki.mjs';

const release = { tag: 'v1.2.3', repository: 'https://github.com/kieksme/csp' };

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), 'csp-wiki-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const source = join(root, 'Docs');
  const target = join(root, 'wiki');
  await mkdir(source);
  await mkdir(target);
  for (const [name, text] of Object.entries({
    'Home.md': '# Home\n\n[Guide](guide.md#setup)\n',
    'guide.md': '# Guide\n\n[Home](Home.md)\n',
    '_Header.md': '**Portal** · [Home](Home.md)\n',
    '_Footer.md': '[Home](Home.md)\n',
    '_Sidebar.md': '- [Guide](guide.md)\n',
  }))
    await writeFile(join(source, name), text);
  return { source, target };
}

test('renders wiki links and anchors while preserving URLs and code examples', () => {
  const markdown = [
    '[Guide](./guide.md#setup) [Home](Home.md)',
    '[Source](https://github.com/kieksme/csp/blob/main/README.md)',
    '[Anchor](#setup) `[Sample](missing.md)`',
    '```md',
    '[Example](missing.md)',
    '```',
    '~~~md',
    '[Other example](missing.md)',
    '~~~',
  ].join('\n');
  const rendered = renderWikiMarkdown(
    markdown,
    new Set(['Home.md', 'guide.md']),
  );
  assert.ok(rendered.startsWith('[Guide](guide#setup) [Home](Home)'));
  assert.ok(
    rendered.includes('https://github.com/kieksme/csp/blob/main/README.md'),
  );
  assert.ok(rendered.includes('`[Sample](missing.md)`'));
  assert.ok(rendered.includes('```md\n[Example](missing.md)\n```'));
  assert.ok(rendered.includes('~~~md\n[Other example](missing.md)\n~~~'));
});

test('mirrors pages, embeds one header, preserves source and is idempotent', async (t) => {
  const { source, target } = await fixture(t);
  const before = await readFile(join(source, 'Home.md'), 'utf8');
  await syncWiki(source, target, release);
  const mirrored = await readFile(join(target, 'Home.md'), 'utf8');
  assert.equal(
    mirrored,
    '**Portal** · [Home](Home)\n\n---\n\n# Home\n\n[Guide](guide#setup)\n',
  );
  assert.equal(await readFile(join(source, 'Home.md'), 'utf8'), before);
  assert.equal(
    await readFile(join(target, '_Sidebar.md'), 'utf8'),
    '- [Guide](guide)\n',
  );
  assert.equal(
    await readFile(join(target, '_Footer.md'), 'utf8'),
    '[Home](Home)\n',
  );
  const manifest = await readFile(
    join(target, '.csp-wiki-manifest.json'),
    'utf8',
  );
  assert.equal(JSON.parse(manifest).tag, release.tag);
  await syncWiki(source, target, release);
  assert.equal(await readFile(join(target, 'Home.md'), 'utf8'), mirrored);
  assert.equal(
    await readFile(join(target, '.csp-wiki-manifest.json'), 'utf8'),
    manifest,
  );
});

test('deletes obsolete managed pages and keeps unrelated wiki files and Git metadata', async (t) => {
  const { source, target } = await fixture(t);
  await mkdir(join(target, '.git'));
  await writeFile(join(target, 'Notes.md'), '# Manual notes\n');
  await writeFile(join(target, 'image.png'), 'asset');
  await syncWiki(source, target, release);
  await rm(join(source, 'guide.md'));
  await writeFile(join(source, 'Home.md'), '# Home\n');
  await writeFile(join(source, '_Sidebar.md'), '[Home](Home.md)\n');
  await syncWiki(source, target, { ...release, tag: 'v1.2.4' });
  assert.ok(!(await readdir(target)).includes('guide.md'));
  assert.equal(
    await readFile(join(target, 'Notes.md'), 'utf8'),
    '# Manual notes\n',
  );
  assert.equal(await readFile(join(target, 'image.png'), 'utf8'), 'asset');
  assert.ok((await readdir(target)).includes('.git'));
  assert.equal(
    JSON.parse(await readFile(join(target, '.csp-wiki-manifest.json'), 'utf8'))
      .tag,
    'v1.2.4',
  );
});

test('fails on broken links before writing or deleting wiki pages', async (t) => {
  const { source, target } = await fixture(t);
  await syncWiki(source, target, release);
  const before = await readFile(join(target, 'Home.md'), 'utf8');
  await writeFile(join(source, 'Home.md'), '[Broken](missing.md)\n');
  await assert.rejects(
    syncWiki(source, target, release),
    /Unknown documentation page/,
  );
  assert.equal(await readFile(join(target, 'Home.md'), 'utf8'), before);
});

test('rejects unsafe manifest paths without modifying unrelated files', async (t) => {
  const { source, target } = await fixture(t);
  await writeFile(
    join(target, '.csp-wiki-manifest.json'),
    JSON.stringify({ files: ['../outside.md'] }),
  );
  await assert.rejects(
    syncWiki(source, target, release),
    /Invalid wiki manifest/,
  );
  assert.deepEqual(await readdir(target), ['.csp-wiki-manifest.json']);
});

test('requires layout pages and rejects overlapping source and target', async (t) => {
  const { source, target } = await fixture(t);
  await assert.rejects(
    syncWiki(source, source, release),
    /separate directories/,
  );
  await assert.rejects(
    syncWiki(source, join(source, 'wiki'), release),
    /separate directories/,
  );
  await assert.rejects(
    syncWiki(source, join(source, '..preview'), release),
    /separate directories/,
  );
  await assert.rejects(
    syncWiki(source, join(source, '..'), release),
    /separate directories/,
  );
  await rm(join(source, '_Header.md'));
  await assert.rejects(
    syncWiki(source, target, release),
    /Missing documentation page/,
  );
  assert.deepEqual(await readdir(target), []);
});

test('project documentation can be mirrored and all pages appear in Home and sidebar', async (t) => {
  const target = await mkdtemp(join(tmpdir(), 'csp-docs-preview-'));
  t.after(() => rm(target, { recursive: true, force: true }));
  const source = fileURLToPath(new URL('../Docs/', import.meta.url));
  await syncWiki(source, target, release);
  const home = await readFile(join(source, 'Home.md'), 'utf8');
  const sidebar = await readFile(join(source, '_Sidebar.md'), 'utf8');
  for (const name of await readdir(source)) {
    if (name.startsWith('_') || name === 'Home.md') continue;
    assert.ok(home.includes(`](${name})`), `${name} missing from Home`);
    assert.ok(sidebar.includes(`](${name})`), `${name} missing from sidebar`);
  }
});
