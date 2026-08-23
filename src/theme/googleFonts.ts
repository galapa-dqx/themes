/**
 * Google Fonts catalog + on-demand loader.
 *
 * The catalog comes from the Web Fonts Developer API and is fetched once,
 * lazily. Loading a family injects a fonts.googleapis.com/css2 link whose
 * ital/wght tuples are derived from the catalog's variant list, so we never
 * request weights a family doesn't ship (css2 rejects the whole request).
 * https://developers.google.com/fonts/docs/developer_api
 */

// Public browser key (rate-limited, safe to ship in a prototype).
const API_KEY = 'AIzaSyA3MtsAoDVzJvFca7iJ8XZZux4apbDISIY';
const API_URL = `https://www.googleapis.com/webfonts/v1/webfonts?sort=popularity&key=${API_KEY}`;

export type GoogleFontEntry = {
  family: string;
  category: string; // serif | sans-serif | display | handwriting | monospace
  variants: string[]; // "regular" | "italic" | "500" | "700italic" | ...
  files: Record<string, string>; // same variant keys → TrueType download URL
};

/** Families bundled via index.html (or generic) — never re-loaded. */
export const BUNDLED_FAMILIES = new Set([
  'Crimson Pro',
  'Source Sans 3',
  'Space Grotesk',
  'Inter',
  'Playfair Display',
  'Georgia',
  'system-ui',
  'serif',
  'sans-serif',
  'monospace',
]);

let catalog: Promise<GoogleFontEntry[]> | null = null;

export function fetchGoogleFonts(): Promise<GoogleFontEntry[]> {
  if (!catalog) {
    catalog = fetch(API_URL)
      .then((res) => {
        if (!res.ok)
          throw new Error(`${res.status} fetching Google Fonts list`);
        return res.json() as Promise<{ items: GoogleFontEntry[] }>;
      })
      .then((data) =>
        data.items.map(({ family, category, variants, files }) => ({
          family,
          category,
          variants,
          files,
        })),
      );
    catalog.catch((err) => {
      console.warn('[fonts] Google Fonts catalog unavailable', err);
      catalog = null;
    });
  }
  return catalog;
}

/** css2 ital,wght tuples from API variants, sorted as the API requires. */
export function variantTuples(variants: string[]): [number, number][] {
  const tuples = new Map<string, [number, number]>();
  for (const variant of variants) {
    const italic = variant.includes('italic') ? 1 : 0;
    const weightText = variant.replace('italic', '');
    const weight =
      weightText === '' || weightText === 'regular' ? 400 : Number(weightText);
    if (!Number.isNaN(weight))
      tuples.set(`${italic},${weight}`, [italic, weight]);
  }
  return [...tuples.values()].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

const loaded = new Set<string>();

/** Inject a stylesheet for `family` if it's a known Google Font. */
export async function ensureFontLoaded(family: string): Promise<void> {
  const clean = family.trim();
  if (!clean || BUNDLED_FAMILIES.has(clean) || loaded.has(clean)) return;
  let entries: GoogleFontEntry[];
  try {
    entries = await fetchGoogleFonts();
  } catch {
    return; // offline — theme falls back to the font stack's generic
  }
  const entry = entries.find((e) => e.family === clean);
  if (!entry || loaded.has(clean)) return;
  loaded.add(clean);

  const tuples = variantTuples(entry.variants);
  const spec = tuples.length
    ? `:ital,wght@${tuples.map((t) => t.join(',')).join(';')}`
    : '';
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${clean.replaceAll(' ', '+')}${spec}&display=swap`;
  document.head.appendChild(link);
}
