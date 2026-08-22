/**
 * Font embedding: fetch the TrueType files a compiled theme's controls name,
 * from the Google Fonts catalog. Returns the ZIP entries plus a lookup from
 * (family, weight, style) to the archive-relative path, so the caller can
 * collapse each control's text spec down to a single `font` pointer.
 */

import { fetchGoogleFonts } from './googleFonts';
import type { CompiledTheme, ResolvedType } from './types';
import { CONTROL_IDS } from './types';

export type FontStyle = 'normal' | 'italic';

export type FontBundle = {
  /** Archive path → TTF bytes. Paths are bare filenames at the ZIP root. */
  files: Record<string, Uint8Array>;
  /** `family|weight|style` → archive-relative path (e.g. `./crimson-pro-700.ttf`). */
  paths: Map<string, string>;
};

/** Key for the `paths` map. */
export const faceKey = (
  family: string,
  weight: number,
  style: FontStyle,
): string => `${family}|${weight}|${style}`;

/** CSS generic families and system stacks: named, never downloadable. */
const GENERIC_FAMILIES = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
]);

const slug = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'font';

/** Catalog key: "regular" | "italic" | "700" | "700italic". */
const variantKey = (italic: boolean, weight: number) =>
  weight === 400
    ? italic
      ? 'italic'
      : 'regular'
    : `${weight}${italic ? 'italic' : ''}`;

/** The catalog still answers in `http:`, which a served page won't load. */
const secure = (url: string) => url.replace(/^http:/, 'https:');

type Triple = { family: string; weight: number; italic: boolean };

/** Distinct (family, weight, italic) triples the theme's controls name. */
function requestedFaces(theme: CompiledTheme): Triple[] {
  const seen = new Map<string, Triple>();
  for (const id of CONTROL_IDS) {
    const control = theme.controls[id];
    if (!control || control.shape === 'Window') continue;
    const type: ResolvedType | undefined = control.text;
    const family = type?.family?.trim();
    if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) continue;
    const weight = type?.weight ?? 400;
    const italic = type?.style === 'italic';
    const key = `${family}|${weight}|${italic ? 'i' : 'n'}`;
    if (!seen.has(key)) seen.set(key, { family, weight, italic });
  }
  return [...seen.values()];
}

/**
 * Fetch every face the theme names. Throws on the first face it can't embed
 * — a `.galapatheme` missing a font is a broken theme, not a shipped one.
 */
export async function bundleFonts(theme: CompiledTheme): Promise<FontBundle> {
  const requested = requestedFaces(theme);
  if (!requested.length) return { files: {}, paths: new Map() };

  const catalog = await fetchGoogleFonts();
  const files: Record<string, Uint8Array> = {};
  const paths = new Map<string, string>();

  for (const { family, weight, italic } of requested) {
    const entry = catalog.find((c) => c.family === family);
    if (!entry) {
      throw new Error(`Font "${family}" is not in the Google Fonts catalog.`);
    }

    const key = variantKey(italic, weight);
    if (!entry.variants.includes(key)) {
      throw new Error(`Font "${family}" does not publish ${key}.`);
    }

    const url = entry.files[key];
    if (!url) {
      throw new Error(`Font "${family}" ${key} has no download URL.`);
    }

    const response = await fetch(secure(url));
    if (!response.ok) {
      throw new Error(
        `Failed to fetch "${family}" ${key}: HTTP ${response.status}.`,
      );
    }
    const bytes = new Uint8Array(await response.arrayBuffer());

    const name = `${slug(family)}-${weight}${italic ? 'i' : ''}.ttf`;
    files[name] = bytes;
    paths.set(
      faceKey(family, weight, italic ? 'italic' : 'normal'),
      `./${name}`,
    );
  }

  return { files, paths };
}
