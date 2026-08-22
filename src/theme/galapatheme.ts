/**
 * The `.galapatheme` container.
 *
 *   magic     8 B   "GLPTHEME"
 *   version   2 B   u16 LE
 *   length    4 B   u32 LE — bytes of header JSON
 *   header    N B   UTF-8 JSON — see {@link GalapathemeHeader}
 *   payload         ZIP archive to end of file
 *
 * The prefix carries identity (label, version, updateUrl) so a catalog scan
 * doesn't need to open the archive. A prefixed ZIP still opens with any
 * reader — the central directory sits at the tail and readers compensate for
 * the leading bytes.
 */

import { zipSync } from 'fflate';
import { bundleFonts } from './fontBundle';
import type { CompiledTheme, ThemeMeta, ThemeMode } from './types';

/** ASCII `GLPTHEME`. */
export const GALAPATHEME_MAGIC = new TextEncoder().encode('GLPTHEME');

/** Container format version. Bump only for a breaking change to the layout. */
export const GALAPATHEME_VERSION = 1;

export const GALAPATHEME_EXTENSION = '.galapatheme';
export const GALAPATHEME_MIME = 'application/vnd.galapa.theme+zip';

/** The path the compiled theme takes inside the archive. */
export const THEME_ENTRY = 'theme.json';

const FIXED_HEADER_BYTES = 8 + 2 + 4;

/**
 * Local-component 1980-01-01, so ZIP mtimes are byte-identical across runs
 * and timezones. A fixed UTC instant would land west of Greenwich in 1979
 * and be rejected as out of range.
 */
const EPOCH = new Date(1980, 0, 1);

/** The prepended index. Scalars only — anything a reader needs the theme's
 *  contents for belongs in the payload instead. */
export type GalapathemeHeader = {
  format: typeof GALAPATHEME_VERSION;
  label: string;
  mode: ThemeMode;
  /** Release metadata, minus `previewImage`. */
  meta?: Omit<ThemeMeta, 'previewImage'>;
  /** Font families embedded in the payload. */
  fonts: string[];
  /** Byte length of the ZIP that follows, for a truncation check. */
  payloadLength: number;
  generator: string;
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

/** Metadata fields small enough to ride in the header. Explicit allowlist so
 *  a new `ThemeMeta` field can't silently land in the prefix. */
const HEADER_META_KEYS = [
  'description',
  'maintainer',
  'version',
  'updateUrl',
] as const satisfies readonly (keyof ThemeMeta)[];

function headerMeta(
  meta?: ThemeMeta,
): Omit<ThemeMeta, 'previewImage'> | undefined {
  if (!meta) return undefined;
  const picked: Omit<ThemeMeta, 'previewImage'> = {};
  for (const key of HEADER_META_KEYS) {
    if (meta[key] !== undefined) picked[key] = meta[key];
  }
  return Object.keys(picked).length ? picked : undefined;
}

/**
 * Build the container. Fetches fonts, so it's async — and it throws on any
 * font it can't embed rather than shipping a broken theme.
 */
export async function galapathemeBundle(
  theme: CompiledTheme,
): Promise<{ filename: string; blob: Blob }> {
  const encoder = new TextEncoder();
  const { files, faces } = await bundleFonts(theme);

  const themeJson = {
    ...theme,
    fonts: faces.map(({ family, weight, style, src }) => ({
      family,
      weight,
      style,
      src,
    })),
  };

  const payload = zipSync(
    {
      [THEME_ENTRY]: encoder.encode(JSON.stringify(themeJson, null, 2) + '\n'),
      ...files,
    },
    { mtime: EPOCH },
  );

  const meta = headerMeta(theme.meta);
  const families = [...new Set(faces.map((f) => f.family))];
  const header: GalapathemeHeader = {
    format: GALAPATHEME_VERSION,
    label: theme.label,
    mode: theme.mode,
    ...(meta ? { meta } : {}),
    fonts: families,
    payloadLength: payload.length,
    generator: 'galapa-ui',
  };
  const headerJson = encoder.encode(JSON.stringify(header));

  const prefix = new Uint8Array(FIXED_HEADER_BYTES + headerJson.length);
  prefix.set(GALAPATHEME_MAGIC, 0);
  const view = new DataView(prefix.buffer);
  view.setUint16(8, GALAPATHEME_VERSION, true);
  view.setUint32(10, headerJson.length, true);
  prefix.set(headerJson, FIXED_HEADER_BYTES);

  const version = theme.meta?.version ? `-${theme.meta.version}` : '';
  return {
    filename: `${themeSlug(theme.label)}${version}${GALAPATHEME_EXTENSION}`,
    blob: new Blob([prefix, payload], { type: GALAPATHEME_MIME }),
  };
}
