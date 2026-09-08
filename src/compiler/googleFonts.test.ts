import {
  FetchHttpClient,
  HttpClient,
  HttpClientResponse,
} from '@effect/platform';
import { ConfigProvider, Effect, Layer } from 'effect';
import { describe, expect, it } from 'vitest';
import {
  gfontFamily,
  GoogleFonts,
  pickResource,
  type GoogleFont,
} from './googleFonts';

const grotesk: GoogleFont = {
  family: 'Space Grotesk',
  files: { regular: 'https://fonts.gstatic.com/s/sg.ttf' },
  axes: [{ tag: 'wght', start: 300, end: 700 }],
};
const inter: GoogleFont = {
  family: 'Inter',
  files: {
    regular: 'https://fonts.gstatic.com/s/i.ttf',
    italic: 'https://fonts.gstatic.com/s/ii.ttf',
  },
  axes: [
    { tag: 'opsz', start: 14, end: 32 },
    { tag: 'wght', start: 100, end: 900 },
  ],
};
const lobster: GoogleFont = {
  family: 'Lobster Two',
  files: {
    regular: 'https://fonts.gstatic.com/s/l.ttf',
    italic: 'https://fonts.gstatic.com/s/li.ttf',
    '700': 'https://fonts.gstatic.com/s/l7.ttf',
    '700italic': 'https://fonts.gstatic.com/s/l7i.ttf',
  },
};

const requests: string[] = [];
const stub = HttpClient.make((req, url) => {
  requests.push(url.href);
  const body =
    url.hostname === 'www.googleapis.com'
      ? url.searchParams.get('key') === 'k' &&
        url.searchParams.get('capability') === 'VF'
        ? Response.json({ items: [grotesk, inter, lobster] })
        : new Response('nope', { status: 403 })
      : new Response(new Uint8Array([1, 2, 3]));
  return Effect.succeed(HttpClientResponse.fromWeb(req, body));
});
const layer = GoogleFonts.Default.pipe(
  Layer.provide(Layer.succeed(HttpClient.HttpClient, stub)),
  Layer.provide(
    Layer.setConfigProvider(
      ConfigProvider.fromMap(new Map([['GOOGLE_FONTS_API_KEY', 'k']])),
    ),
  ),
);
const run = <A, E>(f: (g: typeof GoogleFonts.Service) => Effect.Effect<A, E>) =>
  Effect.runPromise(
    Effect.flatMap(GoogleFonts, f).pipe(Effect.provide(layer), Effect.either),
  );

describe('gfontFamily', () => {
  it('decodes + and percent escapes', () => {
    expect(gfontFamily('gfont:Space+Grotesk')).toBe('Space Grotesk');
    expect(gfontFamily('gfont:M+PLUS+1%2B')).toBe('M PLUS 1+');
  });
});

describe('pickResource', () => {
  it('prefers variable resources and falls back to static variants', () => {
    expect(pickResource(grotesk, 700, 'normal')).toEqual({
      url: grotesk.files.regular,
      variable: true,
    });
    expect(pickResource(grotesk, 400, 'italic')).toBeUndefined();
    expect(pickResource(inter, 500, 'italic')).toEqual({
      url: inter.files.italic,
      variable: true,
    });
    expect(pickResource(inter, 500, 'oblique')).toEqual({
      url: inter.files.italic,
      variable: true,
    });
    expect(
      pickResource(
        { ...inter, axes: [{ tag: 'slnt', start: -10, end: 0 }] },
        400,
        'oblique',
      ),
    ).toEqual({
      url: inter.files.regular,
      variable: true,
    });
    expect(pickResource(lobster, 400, 'normal')).toEqual({
      url: lobster.files.regular,
      variable: false,
    });
    expect(pickResource(lobster, 400, 'italic')).toEqual({
      url: lobster.files.italic,
      variable: false,
    });
    expect(pickResource(lobster, 700, 'italic')).toEqual({
      url: lobster.files['700italic'],
      variable: false,
    });
    expect(pickResource(lobster, 500, 'normal')).toBeUndefined();
  });
});

describe('GoogleFonts', () => {
  it('looks up families case-insensitively from one cached catalog fetch', async () => {
    requests.length = 0;
    const result = await run((g) =>
      Effect.all([
        g.lookup('gfont:space+grotesk'),
        g.lookup('gfont:INTER'),
        g.lookup('gfont:Nope').pipe(Effect.flip),
      ]),
    );
    if (result._tag !== 'Right') throw result.left;
    const [a, b, err] = result.right;
    expect(a.family).toBe('Space Grotesk');
    expect(b).toEqual(inter);
    expect(err.message).toBe('unknown Google Font "Nope"');
    expect(requests.filter((u) => u.includes('googleapis'))).toHaveLength(1);
  });

  it('downloads only from fonts.gstatic.com', async () => {
    const ok = await run((g) =>
      g.download('https://fonts.gstatic.com/s/sg.ttf'),
    );
    expect(ok._tag === 'Right' && ok.right).toEqual(new Uint8Array([1, 2, 3]));
    const bad = await run((g) => g.download('https://evil.example/sg.ttf'));
    expect(bad._tag === 'Left' && bad.left.message).toBe(
      'refusing to download https://evil.example/sg.ttf',
    );
  });

  it('reports a failed catalog request', async () => {
    const result = await Effect.runPromise(
      Effect.flatMap(GoogleFonts, (g) => g.lookup('gfont:Inter')).pipe(
        Effect.provide(
          GoogleFonts.Default.pipe(
            Layer.provide(Layer.succeed(HttpClient.HttpClient, stub)),
            Layer.provide(
              Layer.setConfigProvider(
                ConfigProvider.fromMap(
                  new Map([['GOOGLE_FONTS_API_KEY', 'wrong']]),
                ),
              ),
            ),
          ),
        ),
        Effect.either,
      ),
    );
    expect(result._tag === 'Left' && result.left.message).toMatch(
      /^Google Fonts catalog unavailable: /,
    );
  });

  it.skipIf(!process.env.GOOGLE_FONTS_API_KEY)(
    'resolves a real family (needs GOOGLE_FONTS_API_KEY)',
    async () => {
      const result = await Effect.runPromise(
        Effect.flatMap(GoogleFonts, (g) =>
          Effect.flatMap(g.lookup('gfont:Space+Grotesk'), (f) =>
            g.download(pickResource(f, 500, 'normal')!.url),
          ),
        ).pipe(
          Effect.provide(
            GoogleFonts.Default.pipe(Layer.provide(FetchHttpClient.layer)),
          ),
        ),
      );
      // TrueType magic
      expect([...result.slice(0, 4)]).toEqual([0, 1, 0, 0]);
    },
  );
});
