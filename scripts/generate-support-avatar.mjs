import sharp from 'sharp';
import { readFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const source = new URL(
  'packages/plugin-teams/teams-app/support-avatar.svg',
  root,
);
const svg = await readFile(source, 'utf8');
// Keep the Teams symbol inside the central 96×96 safe area on a full-bleed background.
const teams = svg
  .replace('rx="42" ', '')
  .replace(
    '<path d="M48',
    '<g transform="translate(19.2 19.2) scale(.8)"><path d="M48',
  )
  .replace('</svg>', '</g></svg>');
await sharp(Buffer.from(teams))
  .resize(192, 192)
  .png()
  .toFile(new URL('packages/plugin-teams/teams-app/color.png', root).pathname);
await sharp(
  new URL('packages/plugin-teams/teams-app/support-outline.svg', root).pathname,
)
  .resize(32, 32)
  .png()
  .toFile(
    new URL('packages/plugin-teams/teams-app/outline.png', root).pathname,
  );
await sharp(Buffer.from(svg))
  .resize(512, 512)
  .png()
  .toFile(new URL('packages/plugin-slack/slack-app/avatar.png', root).pathname);
