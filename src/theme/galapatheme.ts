/**
 * The `.galapatheme` container.
 *
 *   magic     8 B   "GLPTHEME"
 *   version   2 B   u16 BE
 *   length    4 B   u32 BE — bytes of header JSON
 *   header    N B   UTF-8 JSON — see {@link GalapathemeHeader}
 *   payload         ZIP archive to end of file
 *
 * The header carries only what an update loop needs (`format`, `id`,
 * `publishedAt`) so a catalog scan doesn't open the archive. Everything
 * user-facing lives in `metadata.json`; rendering data lives in `theme.json`;
 * anything else (fonts, preview image) is a file alongside them.
 *
 * A prefixed ZIP still opens with any reader — the central directory sits at
 * the tail and readers compensate for the leading bytes.
 */

import { zipSync } from 'fflate';
import { bundleFonts, faceKey, type FontStyle } from './fontBundle';
import type {
  CompiledControl,
  CompiledTheme,
  ResolvedType,
} from './types';

/** ASCII `GLPTHEME`. */
export const GALAPATHEME_MAGIC = new TextEncoder().encode('GLPTHEME');

/** Container format version. Bump only for a breaking change to the layout. */
export const GALAPATHEME_VERSION = 1;

export const GALAPATHEME_EXTENSION = '.galapatheme';
export const GALAPATHEME_MIME = 'application/vnd.galapa.theme+zip';

/** Payload entry names. */
export const THEME_ENTRY = 'theme.json';
export const METADATA_ENTRY = 'metadata.json';

const FIXED_HEADER_BYTES = 8 + 2 + 4;

/** The minimum an update loop needs. Everything else lives in `metadata.json`. */
export type GalapathemeHeader = {
  format: typeof GALAPATHEME_VERSION;
  /** Stable identifier for the theme. */
  id: string;
  /** ISO 8601 timestamp of when this bundle was written. */
  publishedAt: string;
};

/** The user-facing metadata for the theme — the `metadata.json` payload. */
export type GalapathemeMetadata = {
  format: typeof GALAPATHEME_VERSION;
  id: string;
  label: string;
  description?: string;
  publishedAt: string;
  maintainer?: string;
  updateUrl?: string;
  /** Relative archive path to the preview image, if one was bundled. */
  previewImage?: string;
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
 *  font engine and doesn't need the metadata separately. A text spec with
 *  no family (just size/case overrides) passes through untouched. */
function rewriteText(
  text: ResolvedType,
  paths: Map<string, string>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (text.fallback !== undefined) out.fallback = text.fallback;
  if (text.size !== undefined) out.size = text.size;
  if (text.case !== undefined) out.case = text.case;
  const family = text.family?.trim();
  if (!family) return out;
  const style: FontStyle = text.style === 'italic' ? 'italic' : 'normal';
  const font = paths.get(faceKey(family, text.weight ?? 400, style));
  // `bundleFonts` throws on any face it can't embed, so a family that reaches
  // here always has a path — this asserts that invariant.
  if (!font) {
    throw new Error(
      `Missing bundled path for "${family}" ${text.weight ?? 400} ${style}.`,
    );
  }
  out.font = font;
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

const PREVIEW_EXTS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
};

/** Turn the stored preview data URL into a ZIP entry plus the relative path
 *  the metadata will point at. Throws on anything it can't decode — a stored
 *  preview that won't unpack is a bug the author should hear about, not a
 *  silent hole in the exported archive. */
function decodePreview(
  dataUrl: string | undefined,
): { path: string; bytes: Uint8Array } | undefined {
  if (dataUrl === undefined) return undefined;
  const match = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl);
  if (!match) {
    throw new Error('Preview image is not a base64 data URL.');
  }
  const mime = match[1].toLowerCase();
  const ext = PREVIEW_EXTS[mime];
  if (!ext) {
    throw new Error(`Preview image MIME "${mime}" is not supported.`);
  }
  let binary: string;
  try {
    binary = atob(match[2]);
  } catch {
    throw new Error('Preview image base64 is malformed.');
  }
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return { path: `preview.${ext}`, bytes };
}

/**
 * Build the container. Fetches fonts, so it's async — and it throws on any
 * font it can't embed rather than shipping a broken theme.
 */
export async function galapathemeBundle(
  theme: CompiledTheme,
  options: { id: string },
): Promise<{ filename: string; blob: Blob }> {
  const encoder = new TextEncoder();
  const { files, paths } = await bundleFonts(theme);
  const { id } = options;
  const publishedAt = new Date().toISOString();
  const preview = decodePreview(theme.meta?.previewImage);

  const themeJson = {
    mode: theme.mode,
    focusRing: theme.focusRing,
    controls: rewriteControls(theme.controls, paths),
  };

  const meta = theme.meta;
  const metadata: GalapathemeMetadata = {
    format: GALAPATHEME_VERSION,
    id,
    label: theme.label,
    ...(meta?.description ? { description: meta.description } : {}),
    publishedAt,
    ...(meta?.maintainer ? { maintainer: meta.maintainer } : {}),
    ...(meta?.updateUrl ? { updateUrl: meta.updateUrl } : {}),
    ...(preview ? { previewImage: `./${preview.path}` } : {}),
  };

  const payload = zipSync({
    [METADATA_ENTRY]: encoder.encode(JSON.stringify(metadata, null, 2) + '\n'),
    [THEME_ENTRY]: encoder.encode(JSON.stringify(themeJson, null, 2) + '\n'),
    ...(preview ? { [preview.path]: preview.bytes } : {}),
    ...files,
  });

  const header: GalapathemeHeader = {
    format: GALAPATHEME_VERSION,
    id,
    publishedAt,
  };
  const headerJson = encoder.encode(JSON.stringify(header));

  const prefix = new Uint8Array(FIXED_HEADER_BYTES + headerJson.length);
  prefix.set(GALAPATHEME_MAGIC, 0);
  const view = new DataView(prefix.buffer);
  view.setUint16(8, GALAPATHEME_VERSION, false);
  view.setUint32(10, headerJson.length, false);
  prefix.set(headerJson, FIXED_HEADER_BYTES);

  return {
    filename: `${themeSlug(theme.label)}${GALAPATHEME_EXTENSION}`,
    blob: new Blob([prefix, payload], { type: GALAPATHEME_MIME }),
  };
}
