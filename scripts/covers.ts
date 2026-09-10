/**
 * Bakes the default cover into every first-party theme:
 * themes/<name>/assets/preview.svg plus metadata.previewImage.
 * Run after changing a theme's window, panel, titlebar, or button fills.
 */
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { coverSvg, COVER_PATH } from '@/editor/cover';
import type { Document } from '@/editor/projectStore';

const THEMES = resolve(process.cwd(), 'themes');
const read = (path: string) => {
  const { $schema: _, ...rest } = JSON.parse(readFileSync(path, 'utf8'));
  return rest;
};

for (const name of readdirSync(THEMES)) {
  const dir = `${THEMES}/${name}`;
  const doc: Document = {
    metadata: read(`${dir}/metadata.json`),
    tokens: read(`${dir}/tokens.json`),
    controls: Object.fromEntries(
      readdirSync(`${dir}/controls`).map((f) => [
        f.slice(0, -5),
        read(`${dir}/controls/${f}`),
      ]),
    ),
  };
  const svg = coverSvg(doc);
  writeFileSync(`${dir}/${COVER_PATH.slice(2)}`, svg);
  const metadata = JSON.parse(readFileSync(`${dir}/metadata.json`, 'utf8'));
  metadata.previewImage = COVER_PATH;
  writeFileSync(
    `${dir}/metadata.json`,
    JSON.stringify(metadata, null, 2) + '\n',
  );
  console.log(`${name}: ${svg.length} bytes`);
}
