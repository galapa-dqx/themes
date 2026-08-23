/**
 * Font embedding: fetch the TrueType files a compiled theme's controls name,
 * from the Google Fonts catalog. Returns the ZIP entries plus a lookup from
 * (family, weight, style) to the archive-relative path, so the caller can
 * collapse each control's text spec down to a single `font` pointer.
 */

import { fetchGoogleFonts, BUNDLED_FAMILIES } from './googleFonts';
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

/**
 * Best-effort catalog validation: given a compiled theme, return a list of
 * (family, weight, italic) faces the theme names that the Google Fonts
 * catalog cannot serve. Silently returns `[]` when the catalog is
 * unreachable — this is a lint pass, not a gate. Families bundled locally
 * (see {@link BUNDLED_FAMILIES}) always pass.
 */
export async function validateFontsAgainstCatalog(
  theme: CompiledTheme,
): Promise<string[]> {
  const requested = requestedFaces(theme);
  if (!requested.length) return [];
  let catalog;
  try {
    catalog = await fetchGoogleFonts();
  } catch {
    return [];
  }
  const problems: string[] = [];
  for (const { family, weight, italic } of requested) {
    if (BUNDLED_FAMILIES.has(family)) continue;
    const entry = catalog.find((c) => c.family === family);
    if (!entry) {
      problems.push(`"${family}" is not in the Google Fonts catalog`);
      continue;
    }
    const key = variantKey(italic, weight);
    if (!entry.variants.includes(key)) {
      problems.push(`"${family}" does not publish ${key}`);
    }
  }
  return problems;
}

/** Distinct (family, weight, italic) triples the theme's controls name. */
function requestedFaces(theme: CompiledTheme): Triple[] {
  const seen = new Map<string, Triple>();
  for (const id of CONTROL_IDS) {
    const control = theme.controls[id];
    if (!control || control.shape === 'Window') continue;
    const type: ResolvedType | undefined = control.text;
    const family = type?.family?.trim();
    if (!family) continue;
    const weight = type?.weight ?? 400;
    const italic = type?.style === 'italic';
    const key = `${family}|${weight}|${italic ? 'i' : 'n'}`;
    if (!seen.has(key)) seen.set(key, { family, weight, italic });
  }
  return [...seen.values()];
}

/** Per-face timeout, so a stalled font host doesn't hang the export. */
const FETCH_TIMEOUT_MS = 20_000;

/**
 * Fetch every face the theme names, in parallel. Throws on the first face
 * that can't be embedded — a `.galapatheme` missing a font is broken, not
 * shipped. A theme naming a CSS generic (`serif`, `system-ui`, …) or a
 * system-only face (`Georgia`) hits the "not in the Google Fonts catalog"
 * error here: bundling requires a downloadable family.
 */
export async function bundleFonts(theme: CompiledTheme): Promise<FontBundle> {
  const requested = requestedFaces(theme);
  if (!requested.length) return { files: {}, paths: new Map() };

  const catalog = await fetchGoogleFonts();

  const results = await Promise.all(
    requested.map(async ({ family, weight, italic }) => {
      const entry = catalog.find((c) => c.family === family);
      if (!entry) {
        throw new Error(
          `Font "${family}" is not in the Google Fonts catalog.`,
        );
      }

      const key = variantKey(italic, weight);
      if (!entry.variants.includes(key)) {
        throw new Error(`Font "${family}" does not publish ${key}.`);
      }

      const url = entry.files[key];
      if (!url) {
        throw new Error(`Font "${family}" ${key} has no download URL.`);
      }

      const response = await fetch(secure(url), {
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (!response.ok) {
        throw new Error(
          `Failed to fetch "${family}" ${key}: HTTP ${response.status}.`,
        );
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const name = `${slug(family)}-${weight}${italic ? 'i' : ''}.ttf`;
      return { family, weight, italic, name, bytes };
    }),
  );

  const files: Record<string, Uint8Array> = {};
  const paths = new Map<string, string>();
  for (const { family, weight, italic, name, bytes } of results) {
    files[name] = bytes;
    paths.set(
      faceKey(family, weight, italic ? 'italic' : 'normal'),
      `./${name}`,
    );
  }
  return { files, paths };
}
