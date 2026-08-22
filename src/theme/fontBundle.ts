/**
 * Font embedding: turn the families a compiled theme *names* into the font
 * bytes a reader can render offline.
 *
 * A compiled theme is self-contained in every respect but one — art is inlined
 * and colours are literal, but `text.family` is still just a string, and the
 * app has been quietly relying on Google's CDN to make it mean something. That
 * is the last fetch a `.galapatheme` has to close, and it is the reason the
 * container is an archive rather than a bigger JSON file: font binaries do not
 * want to be base64.
 *
 * Only the faces the theme actually uses are fetched. The compiled controls
 * name a concrete (family, weight, style) each, so the exact set is knowable —
 * a theme that asks for Crimson Pro 700 gets Crimson Pro 700, not the other
 * eleven weights it never draws. The cost is that re-weighting a control means
 * re-exporting, which is true of every other compiled value already.
 *
 * TrueType, from the Web Fonts catalog's own `files` map. The css2 endpoint is
 * deliberately not involved: it varies its response by User-Agent, so what came
 * back would depend on who was exporting, and it answers in a stylesheet that
 * would then have to be parsed for the URLs underneath. The catalog is already
 * fetched for the Studio's font picker and points straight at the files.
 */

import { fetchGoogleFonts } from './googleFonts';
import type { CompiledTheme, ResolvedType } from './types';
import { CONTROL_IDS } from './types';

/** One embedded face, as the engine sees it. */
export type BundledFace = {
  family: string;
  weight: number;
  style: 'normal' | 'italic';
  /** Archive path, relative to the container root. */
  path: string;
};

export type FontBundle = {
  /** Archive path → bytes, ready to hand to the zipper. */
  files: Record<string, Uint8Array>;
  faces: BundledFace[];
  /** Families embedded, in the order first seen. */
  families: string[];
  /** Everything that went wrong without being worth failing the export over. */
  warnings: string[];
};

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

/** The catalog's key for a face: "regular" | "italic" | "700" | "700italic". */
const variantKey = (italic: boolean, weight: number) =>
  weight === 400
    ? italic
      ? 'italic'
      : 'regular'
    : `${weight}${italic ? 'italic' : ''}`;

/** The catalog still answers in `http:`, which a served page won't load. */
const secure = (url: string) => url.replace(/^http:/, 'https:');

/** `family` → the variant keys it needs, in first-seen family order. */
function requestedFaces(theme: CompiledTheme): Map<string, Set<string>> {
  const wanted = new Map<string, Set<string>>();

  for (const id of CONTROL_IDS) {
    const control = theme.controls[id];
    // A complete compiled theme has every control, but this reads a file that
    // may not be one, and a missing face is a better outcome than a failed
    // export. The window is the one control with no text of its own.
    const type: ResolvedType | undefined =
      !control || control.shape === 'Window' ? undefined : control.text;
    const family = type?.family?.trim();
    if (!family || GENERIC_FAMILIES.has(family.toLowerCase())) continue;

    const set = wanted.get(family) ?? new Set<string>();
    set.add(variantKey(type?.style === 'italic', type?.weight ?? 400));
    wanted.set(family, set);
  }

  return wanted;
}

/** A variant key back into the weight and slant it stands for. */
function parseVariant(key: string): { weight: number; italic: boolean } {
  const italic = key.endsWith('italic');
  const stem = key.replace(/italic$/, '');
  return {
    weight: stem === '' || stem === 'regular' ? 400 : Number(stem),
    italic,
  };
}

/**
 * Move a requested variant onto one the family actually publishes. A weight
 * it doesn't ship becomes the nearest it does, and a family with no italic
 * falls back to its upright — which is what the renderer would have had to
 * synthesise anyway. Returns `undefined` only if the family ships nothing.
 */
function snapToAvailable(
  key: string,
  available: readonly string[],
): string | undefined {
  if (available.includes(key)) return key;
  const { weight, italic } = parseVariant(key);

  let candidates = available.filter((v) => parseVariant(v).italic === italic);
  if (!candidates.length)
    candidates = available.filter((v) => !parseVariant(v).italic);
  if (!candidates.length) return undefined;

  return candidates.reduce((a, b) =>
    Math.abs(parseVariant(b).weight - weight) <
    Math.abs(parseVariant(a).weight - weight)
      ? b
      : a,
  );
}

/**
 * Fetch every face the compiled theme uses and return the archive entries for
 * them. Network failures are collected as warnings rather than thrown: a
 * `.galapatheme` missing one face is still a usable theme, and an export that
 * dies because a CDN blinked helps nobody.
 */
export async function bundleFonts(theme: CompiledTheme): Promise<FontBundle> {
  const warnings: string[] = [];
  const files: Record<string, Uint8Array> = {};
  const faces: BundledFace[] = [];
  const families: string[] = [];

  const wanted = requestedFaces(theme);
  if (!wanted.size) return { files, faces, families, warnings };

  let catalog;
  try {
    catalog = await fetchGoogleFonts();
  } catch {
    warnings.push('Google Fonts catalog unavailable — no fonts embedded.');
    return { files, faces, families, warnings };
  }

  for (const [family, keys] of wanted) {
    const entry = catalog.find((candidate) => candidate.family === family);
    if (!entry) {
      warnings.push(`"${family}" is not a Google font — not embedded.`);
      continue;
    }

    let embedded = 0;
    // Two requested variants can snap onto the same published one, so the
    // fetched set is deduped rather than the requested set.
    const resolved = new Set<string>();
    for (const key of keys) {
      const snapped = snapToAvailable(key, entry.variants);
      if (!snapped) {
        warnings.push(`"${family}" ships no usable variant — not embedded.`);
        break;
      }
      if (snapped !== key) {
        warnings.push(
          `"${family}" ${key} is not published; ${snapped} was embedded instead.`,
        );
      }
      resolved.add(snapped);
    }

    for (const key of resolved) {
      const url = entry.files[key];
      if (!url) {
        warnings.push(`"${family}" ${key} has no download URL — not embedded.`);
        continue;
      }

      let bytes: Uint8Array;
      try {
        const response = await fetch(secure(url));
        if (!response.ok) throw new Error(`${response.status}`);
        bytes = new Uint8Array(await response.arrayBuffer());
      } catch (error) {
        warnings.push(`Could not fetch "${family}" ${key} (${error}).`);
        continue;
      }

      const { weight, italic } = parseVariant(key);
      const path = `fonts/${slug(family)}-${weight}${italic ? 'i' : ''}.ttf`;
      files[path] = bytes;
      faces.push({ family, weight, style: italic ? 'italic' : 'normal', path });
      embedded++;
    }

    if (embedded) families.push(family);
    else warnings.push(`No "${family}" faces could be embedded.`);
  }

  if (faces.length) {
    files['fonts/fonts.json'] = new TextEncoder().encode(
      JSON.stringify(faces, null, 2) + '\n',
    );
  }

  return { files, faces, families, warnings };
}
