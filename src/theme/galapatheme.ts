/**
 * The `.galapatheme` container: one file that is a whole installable theme.
 *
 * ```
 *  ┌────────────────────────────────────────────────────────────┐
 *  │ magic      8 B   89 47 4C 50 0D 0A 1A 0A                   │
 *  │ version    2 B   u16 LE — container format, currently 1    │  header
 *  │ length     4 B   u32 LE — byte length of the header JSON   │
 *  │ header     N B   UTF-8 JSON (@see GalapathemeHeader)       │
 *  ├────────────────────────────────────────────────────────────┤
 *  │ payload          a ZIP archive, running to end of file     │  payload
 *  │                    theme.json      the CompiledTheme       │
 *  │                    fonts/fonts.json family/weight/style    │
 *  │                                     per embedded file      │
 *  │                    fonts/*.ttf      the binaries           │
 *  └────────────────────────────────────────────────────────────┘
 * ```
 *
 * **Why a ZIP.** The compiled theme was already self-contained in everything
 * but its fonts, and fonts are binaries — base64 in JSON would cost a third
 * again in size and give every reader a decode pass before it can hand bytes
 * to a font engine. An archive also means every platform this format has to
 * reach already has a reader, including the Avalonia/Skia engine the compiled
 * format exists for.
 *
 * **Why a prefix works.** A ZIP is read from its tail: the reader scans
 * backwards for the End Of Central Directory record, and the file index hangs
 * off that. Nothing about that walk depends on the archive starting at byte
 * zero, which is why a self-extracting archive is just an executable with a
 * ZIP stapled to the end of it. The offsets the directory stores do go stale
 * by the length of whatever sits in front, and readers have compensated for
 * that for as long as SFX archives have existed — `unzip` says so out loud
 * ("N extra bytes at beginning") and carries on. So the header rides in front
 * and the payload stays an ordinary archive that ordinary tools can open.
 *
 * **Why prepend at all.** A catalog — a launcher's theme list, an update
 * server, a directory scan — wants a theme's name, version and update URL,
 * and wants them from the first few hundred bytes rather than from a
 * central-directory walk and an inflate. So the identity goes in front, in
 * the clear. It is deliberately *only* identity: no preview image, no control
 * data, nothing that grows with the theme, so the header stays a cheap read
 * however large the payload gets.
 *
 * The duplication with `theme.json` is real and intended — the header is a
 * derived index, and the payload stays the truth. A reader that has already
 * opened the archive should prefer what is inside it.
 *
 * **Why the magic looks like that.** It borrows PNG's trick wholesale. The
 * high bit in `0x89` fails loudly on a transport that strips to 7 bits; `GLP`
 * identifies the format to a human with a hex editor and to `file(1)`; the
 * `\r\n` pair detects a transfer that has "helpfully" translated line endings,
 * and the trailing `\n` catches the reverse; `0x1A` is DOS end-of-file, so
 * `type theme.galapatheme` stops instead of spraying the terminal.
 */

import { zipSync } from 'fflate';
import { bundleFonts } from './fontBundle';
import type { CompiledTheme, ThemeMeta, ThemeMode } from './types';

/** `\x89 G L P \r \n \x1A \n` */
export const GALAPATHEME_MAGIC = Uint8Array.of(
  0x89,
  0x47,
  0x4c,
  0x50,
  0x0d,
  0x0a,
  0x1a,
  0x0a,
);

/** Container format version. Bump only for a breaking change to the layout. */
export const GALAPATHEME_VERSION = 1;

export const GALAPATHEME_EXTENSION = '.galapatheme';
export const GALAPATHEME_MIME = 'application/vnd.galapa.theme+zip';

/** Magic + version + header length, before the header JSON itself. */
const FIXED_HEADER_BYTES = 8 + 2 + 4;

/** The path the compiled theme takes inside the archive. */
export const THEME_ENTRY = 'theme.json';

/**
 * A fixed timestamp for every entry. Exports are content-addressed in spirit:
 * the same theme should produce the same bytes, so a rebuild is diffable and a
 * mirror can dedupe. A real clock makes every export unique for no reader's
 * benefit. 1980-01-01 is the earliest a ZIP's DOS timestamp can spell.
 *
 * Built from *local* components on purpose. A ZIP stores wall-clock date and
 * time with no zone, and the writer reads them off the `Date` with the local
 * getters — so a fixed UTC instant would land on a different stored timestamp
 * in every timezone, and west of Greenwich it would land on 1979 and be
 * rejected outright as out of range. Local midnight is the same stored
 * timestamp everywhere, which is the determinism this is here for.
 */
const EPOCH = new Date(1980, 0, 1);

/**
 * The prepended index. Scalars only, and every field is either identity or a
 * pointer — anything a reader would need the theme's *contents* for belongs in
 * the payload instead.
 */
export type GalapathemeHeader = {
  format: typeof GALAPATHEME_VERSION;
  label: string;
  mode: ThemeMode;
  /** Release metadata, minus `previewImage` — @see the note on size above. */
  meta?: Omit<ThemeMeta, 'previewImage'>;
  /** Font families embedded in the payload. */
  fonts: string[];
  /** Byte length of the ZIP that follows, for a truncation check. */
  payloadLength: number;
  generator: string;
};

/** A filesystem-safe slug from a theme label: "Aurelia Dusk" → "aurelia-dusk",
 *  falling back to "theme" when a label has no usable characters. */
export function themeSlug(label: string): string {
  return (
    label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'theme'
  );
}

/**
 * The metadata fields small enough to ride in the header. An allowlist rather
 * than "everything except `previewImage`", so that a `ThemeMeta` field added
 * later — another image, a changelog — can't silently land in the prefix and
 * cost every catalog scan its cheapness.
 */
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
 * Build the container. Fonts are fetched here — the only network this does —
 * so the call is async and can take a moment on a theme with several families;
 * anything it could not embed comes back in `warnings` rather than throwing.
 */
export async function galapathemeBundle(theme: CompiledTheme): Promise<{
  filename: string;
  blob: Blob;
  warnings: string[];
}> {
  const encoder = new TextEncoder();
  const fonts = await bundleFonts(theme);

  // Everything here wants deflating: the theme JSON is mostly inlined SVG and
  // repeated key names, and TrueType carries no compression of its own.
  const payload = zipSync(
    {
      [THEME_ENTRY]: encoder.encode(JSON.stringify(theme, null, 2) + '\n'),
      ...fonts.files,
    },
    { mtime: EPOCH },
  );

  const meta = headerMeta(theme.meta);
  const header: GalapathemeHeader = {
    format: GALAPATHEME_VERSION,
    label: theme.label,
    mode: theme.mode,
    ...(meta ? { meta } : {}),
    fonts: fonts.families,
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
    warnings: fonts.warnings,
  };
}
