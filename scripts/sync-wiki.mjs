import {
  readdir,
  readFile,
  writeFile,
  mkdir,
  rm,
  lstat,
} from 'node:fs/promises';
import { resolve, join, relative, isAbsolute, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

const manifestName = '.csp-wiki-manifest.json';
const pageName = /^[a-zA-Z0-9_-]+\.md$/;
const requiredPages = ['Home.md', '_Header.md', '_Footer.md', '_Sidebar.md'];

// docs uses file links for repository browsing; GitHub Wiki uses page URLs.
// Keep fenced examples and inline code unchanged.
export function renderWikiMarkdown(markdown, pages) {
  let fence;
  return markdown
    .split('\n')
    .map((line) => {
      const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
      if (marker) {
        if (!fence) fence = marker[1];
        else if (
          marker[1][0] === fence[0] &&
          marker[1].length >= fence.length &&
          line.slice(marker[0].length).trim() === ''
        )
          fence = undefined;
        return line;
      }
      if (fence) return line;
      return line
        .split(/(`+[^`]*`+)/g)
        .map((part, index) => {
          if (index % 2) return part;
          return part.replace(
            /(!?\[[^\]\n]*\]\()([^\s)]+)(\))/g,
            (match, start, href, end) => {
              if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(href)) return match;
              const [path, anchor] = href.split('#', 2);
              if (!path.endsWith('.md')) return match;
              const name = path.replace(/^\.\//, '');
              if (!pages.has(name))
                throw new Error(`Unknown documentation page: ${href}`);
              return `${start}${name.slice(0, -3)}${anchor === undefined ? '' : '#' + anchor}${end}`;
            },
          );
        })
        .join('');
    })
    .join('\n');
}

export async function syncWiki(source, target, { tag, repository }) {
  source = resolve(source);
  target = resolve(target);
  const contains = (parent, child) => {
    const path = relative(parent, child);
    return !isAbsolute(path) && path !== '..' && !path.startsWith('..' + sep);
  };
  if (contains(source, target) || contains(target, source))
    throw new Error(
      'Documentation source and wiki must be separate directories',
    );
  if (!tag || !/^https?:\/\//.test(repository ?? ''))
    throw new Error('A release tag and repository URL are required');

  // Validate everything before modifying the checked-out wiki.
  const entries = await readdir(source, { withFileTypes: true });
  if (entries.some((entry) => !entry.isFile() || !pageName.test(entry.name)))
    throw new Error(
      'docs must contain only flat Markdown pages with safe names',
    );
  const pages = new Set(entries.map((entry) => entry.name));
  for (const name of requiredPages)
    if (!pages.has(name))
      throw new Error(`Missing documentation page: ${name}`);
  const content = new Map();
  for (const name of [...pages].sort())
    content.set(
      name,
      renderWikiMarkdown(await readFile(join(source, name), 'utf8'), pages),
    );

  let previous = [];
  try {
    const manifest = JSON.parse(
      await readFile(join(target, manifestName), 'utf8'),
    );
    if (
      !Array.isArray(manifest.files) ||
      manifest.files.some(
        (name) => typeof name !== 'string' || !pageName.test(name),
      )
    )
      throw new Error('Invalid wiki manifest');
    previous = manifest.files;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  for (const name of [...new Set([...pages, ...previous, manifestName])]) {
    try {
      if (!(await lstat(join(target, name))).isFile())
        throw new Error(`Wiki destination is not a regular file: ${name}`);
    } catch (error) {
      if (error.code !== 'ENOENT') throw error;
    }
  }

  await mkdir(target, { recursive: true });
  const header = content.get('_Header.md').trimEnd();
  for (const [name, markdown] of content) {
    const prefix = name.startsWith('_') ? '' : header + '\n\n---\n\n';
    await writeFile(join(target, name), prefix + markdown.trimEnd() + '\n');
  }
  for (const name of previous)
    if (!pages.has(name)) await rm(join(target, name), { force: true });
  await writeFile(
    join(target, manifestName),
    JSON.stringify({ repository, tag, files: [...pages].sort() }, null, 2) +
      '\n',
  );
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(resolve(process.argv[1])).href
) {
  const [source, target, tag, repository] = process.argv.slice(2);
  if (!source || !target || !tag || !repository) {
    console.error(
      'Usage: node scripts/sync-wiki.mjs <docs> <wiki-directory> <release-tag> <repository-url>',
    );
    process.exitCode = 1;
  } else {
    syncWiki(source, target, { tag, repository }).catch((error) => {
      console.error(error.message);
      process.exitCode = 1;
    });
  }
}
