/**
 * Google Fonts resolver over the Developer API (not the CSS API). The catalog
 * is fetched once per service instance with `capability=VF`, so variable
 * families report their axes and a variable resource per style, while
 * static families report one TTF per variant.
 */
import { HttpClient } from '@effect/platform';
import { Config, Data, Effect, Redacted } from 'effect';

export interface GoogleFont {
  /** Canonical capitalization from the catalog. */
  readonly family: string;
  /** Variant key -> fonts.gstatic.com TTF. Variable families use `regular`/`italic`. */
  readonly files: Record<string, string>;
  readonly axes?: readonly { tag: string; start: number; end: number }[];
}

export class FontSourceError extends Data.TaggedError('FontSourceError')<{
  readonly message: string;
}> {}

const API = 'https://www.googleapis.com/webfonts/v1/webfonts';
const CDN = 'https://fonts.gstatic.com/';

/** Family name from a `gfont:` URI: `+` is a space, the rest is percent-encoded. */
export const gfontFamily = (uri: string) =>
  decodeURIComponent(uri.slice('gfont:'.length).replaceAll('+', ' '));

/** The resource to hand to fontTools for one face, preferring variable fonts. */
export const pickResource = (
  font: GoogleFont,
  weight: number,
  style: 'normal' | 'italic' | 'oblique',
): { url: string; variable: boolean } | undefined => {
  if (font.axes) {
    // Oblique on a slanting axis is set by fontTools on the upright resource.
    const slanted =
      style === 'oblique' && font.axes.some((a) => a.tag === 'slnt');
    const key = style === 'normal' || slanted ? 'regular' : 'italic';
    const url = font.files[key];
    return url ? { url, variable: true } : undefined;
  }
  const w = weight === 400 ? '' : String(weight);
  const key = style === 'normal' ? w || 'regular' : `${w}italic`;
  const url = font.files[key];
  return url ? { url, variable: false } : undefined;
};

export class GoogleFonts extends Effect.Service<GoogleFonts>()('GoogleFonts', {
  effect: Effect.gen(function* () {
    const key = yield* Config.redacted('GOOGLE_FONTS_API_KEY');
    const http = (yield* HttpClient.HttpClient).pipe(HttpClient.filterStatusOk);
    const fail = (message: string) => (e: { message: string }) =>
      new FontSourceError({ message: `${message}: ${e.message}` });

    const catalog = yield* Effect.cached(
      http
        .get(API, { urlParams: { capability: 'VF', key: Redacted.value(key) } })
        .pipe(
          Effect.flatMap((r) => r.json),
          Effect.map((body) => (body as { items: GoogleFont[] }).items),
          Effect.mapError(fail('Google Fonts catalog unavailable')),
        ),
    );

    return {
      /** Resolves a `gfont:` URI case-insensitively to its catalog entry. */
      lookup: (uri: string) =>
        Effect.gen(function* () {
          const family = gfontFamily(uri);
          const wanted = family.toLowerCase();
          const font = (yield* catalog).find(
            (f) => f.family.toLowerCase() === wanted,
          );
          if (!font)
            return yield* new FontSourceError({
              message: `unknown Google Font "${family}"`,
            });
          return font;
        }),
      /** Downloads one resource URL returned by `lookup`. */
      download: (url: string) =>
        Effect.gen(function* () {
          if (!url.startsWith(CDN)) {
            return yield* new FontSourceError({
              message: `refusing to download ${url}`,
            });
          }
          const buffer = yield* http.get(url).pipe(
            Effect.flatMap((r) => r.arrayBuffer),
            Effect.mapError(fail(`cannot download ${url}`)),
          );
          return new Uint8Array(buffer);
        }),
    };
  }),
}) {}
