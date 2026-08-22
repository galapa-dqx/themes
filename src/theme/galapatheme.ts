/**
 * The `.galapatheme` container.
 *
 *   magic     8 B   "GLPTHEME"
 *   version   2 B   u16 BE
 *   length    4 B   u32 BE — bytes of header JSON
 *   header    N B   UTF-8 JSON — see {@link GalapathemeHeader}
 *   payload         ZIP archive to end of file
 *
 * The prefix carries identity (id, label, version, updateUrl) so a catalog
 * scan doesn't need to open the archive. A prefixed ZIP still opens with any
 * reader — the central directory sits at the tail and readers compensate for
 * the leading bytes.
 */

import { zipSync } from 'fflate';
import { bundleFonts, faceKey, type FontStyle } from './fontBundle';
import type {
  CompiledControl,
  CompiledTheme,
  ResolvedType,
  ThemeMode,
} from './types';

/** ASCII `GLPTHEME`. */
export const GALAPATHEME_MAGIC = new TextEncoder().encode('GLPTHEME');

/** Container format version. Bump only for a breaking change to the layout. */
export const GALAPATHEME_VERSION = 1;

export const GALAPATHEME_EXTENSION = '.galapatheme';
export const GALAPATHEME_MIME = 'application/vnd.galapa.theme+zip';

/** The path the compiled theme takes inside the archive. */
export const THEME_ENTRY = 'theme.json';

const FIXED_HEADER_BYTES = 8 + 2 + 4;

/** 1980-01-01 (the ZIP DOS-timestamp floor) built from local components, so
 *  the stored mtime is byte-identical across timezones. */
const EPOCH = new Date(1980, 0, 1);

/**
 * The prepended index. Every field is identity — nothing that grows with the
 * theme, so the header stays cheap however large the payload gets.
 */
export type GalapathemeHeader = {
  format: typeof GALAPATHEME_VERSION;
  /** Stable identifier for the theme. Falls back to the label slug when the
   *  caller doesn't supply one. */
  id: string;
  label: string;
  mode: ThemeMode;
  version?: string;
  description?: string;
  maintainer?: string;
  updateUrl?: string;
};

/** Filesystem-safe slug from a theme label. */
export function themeSlug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'theme'
  );
}

/** Collapse a resolved text spec's (family, weight, style) into a single
 *  `font` pointer at the archive path — the reader hands that file to the
 *  font engine and doesn't need the metadata separately. */
function rewriteText(
  text: ResolvedType,
  paths: Map<string, string>,
): Record<string, unknown> {
  const family = text.family?.trim();
  const out: Record<string, unknown> = {};
  if (text.fallback !== undefined) out.fallback = text.fallback;
  if (text.size !== undefined) out.size = text.size;
  if (text.case !== undefined) out.case = text.case;
  if (!family) {
    if (text.family !== undefined) out.family = text.family;
    if (text.weight !== undefined) out.weight = text.weight;
    if (text.style !== undefined) out.style = text.style;
    return out;
  }
  const style: FontStyle = text.style === 'italic' ? 'italic' : 'normal';
  const font = paths.get(faceKey(family, text.weight ?? 400, style));
  if (font) out.font = font;
  return out;
}

function rewriteControls(
  controls: CompiledTheme['controls'],
  paths: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, control] of Object.entries(controls) as [
    string,
    CompiledControl | undefined,
  ][]) {
    if (!control || control.shape === 'Window' || !control.text) {
      out[id] = control;
      continue;
    }
    out[id] = { ...control, text: rewriteText(control.text, paths) };
  }
  return out;
}

/**
 * Build the container. Fetches fonts, so it's async — and it throws on any
 * font it can't embed rather than shipping a broken theme.
 */
export async function galapathemeBundle(
  theme: CompiledTheme,
  options: { id?: string } = {},
): Promise<{ filename: string; blob: Blob }> {
  const encoder = new TextEncoder();
  const { files, paths } = await bundleFonts(theme);
  const id = options.id ?? themeSlug(theme.label);

  const themeJson = {
    id,
    ...theme,
    controls: rewriteControls(theme.controls, paths),
  };

  const payload = zipSync(
    {
      [THEME_ENTRY]: encoder.encode(JSON.stringify(themeJson, null, 2) + '\n'),
      ...files,
    },
    { mtime: EPOCH },
  );

  const meta = theme.meta;
  const header: GalapathemeHeader = {
    format: GALAPATHEME_VERSION,
    id,
    label: theme.label,
    mode: theme.mode,
    ...(meta?.version ? { version: meta.version } : {}),
    ...(meta?.description ? { description: meta.description } : {}),
    ...(meta?.maintainer ? { maintainer: meta.maintainer } : {}),
    ...(meta?.updateUrl ? { updateUrl: meta.updateUrl } : {}),
  };
  const headerJson = encoder.encode(JSON.stringify(header));

  const prefix = new Uint8Array(FIXED_HEADER_BYTES + headerJson.length);
  prefix.set(GALAPATHEME_MAGIC, 0);
  const view = new DataView(prefix.buffer);
  view.setUint16(8, GALAPATHEME_VERSION, false);
  view.setUint32(10, headerJson.length, false);
  prefix.set(headerJson, FIXED_HEADER_BYTES);

  const version = meta?.version ? `-${meta.version}` : '';
  return {
    filename: `${themeSlug(theme.label)}${version}${GALAPATHEME_EXTENSION}`,
    blob: new Blob([prefix, payload], { type: GALAPATHEME_MIME }),
  };
}
