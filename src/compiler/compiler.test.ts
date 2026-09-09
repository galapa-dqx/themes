import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFileSystem } from '@effect/platform-node';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import sharp from 'sharp';
import type { Static } from 'typebox';
import Value from 'typebox/value';
import { describe, expect, it } from 'vitest';
import {
  CompiledAssetFrame,
  CompiledText,
  CompiledThemeSchema,
  CompiledVariantImage,
  type CompiledTheme,
} from '@/theme/schema';
import { compileProject } from './compiler';
import { CompileFailed, Diagnostics } from './diagnostics';
import { FIXTURES, fixtureProject } from './fixtures';
import { FontTools } from './fontTools';
import { FontSourceError, GoogleFonts } from './googleFonts';
import { imagesSharp } from './imagesNode';
import { Svg } from './svg';

let py: Promise<PyodideInterface> | undefined;
const load = () =>
  (py ??= loadPyodide({
    packages: ['fonttools'],
    packageCacheDir: resolve(process.cwd(), '.pyodide-assets'),
  }));

/** Google Fonts stand-in: Space Grotesk resolves to the fixture font, everything else is unknown. */
const google = Layer.succeed(
  GoogleFonts,
  new GoogleFonts({
    list: Effect.succeed([]),
    lookup: (uri) =>
      uri === 'gfont:Space+Grotesk'
        ? Effect.succeed({
            family: 'Space Grotesk',
            files: { regular: 'https://fonts.gstatic.com/s/sg.ttf' },
            axes: [{ tag: 'wght', start: 300, end: 700 }],
          })
        : Effect.fail(
            new FontSourceError({ message: `unknown Google Font "${uri}"` }),
          ),
    download: () =>
      Effect.succeed(
        new Uint8Array(readFileSync(`${FIXTURES}/full/assets/sg.ttf`)),
      ),
  }),
);
const layer = Layer.mergeAll(
  NodeFileSystem.layer,
  Diagnostics.Default,
  Svg.Default,
  FontTools.inProcess(load),
  imagesSharp,
  google,
);

const compile = (layers: string[]) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const out = yield* compileProject(yield* fixtureProject(layers));
      const read = (name: string) =>
        JSON.parse(readFileSync(`${out.dir}/${name}`, 'utf8')) as unknown;
      return { ...out, read };
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

const readdirRecursive = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? readdirRecursive(path) : [path];
  });

describe('compileProject', () => {
  it('compiles the full fixture into a schema-valid, deduplicated package', async () => {
    const exit = await compile(['full']);
    if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
    const { read, diagnostics, dir } = exit.value;

    const theme = read('theme.json') as CompiledTheme;
    expect([...Value.Errors(CompiledThemeSchema, theme)]).toEqual([]);
    const button = theme.button as Static<typeof CompiledAssetFrame> & {
      parts: { text: Static<typeof CompiledText> };
    };
    const text = (root: string, part: string) =>
      (theme[root as 'input'].parts![part] as Static<typeof CompiledText>)
        .typography;

    // Nine-slice frame with a distinct hover asset and shared currentColor.
    expect(button.asset).toMatch(/^\.\/assets\/[0-9a-f]{12}\.svg$/);
    expect(button.currentColor).toBe('#123456');
    expect(button.states!.hover!.asset).not.toBe(button.asset);
    expect(button.states!.focused).toMatchObject({
      showRing: false,
      opacity: 0.9,
    });

    // Typography: gfont (variable, instantiated), project TTF, and TTC members.
    expect(button.parts.text.typography).toEqual({
      font: expect.stringMatching(/^\.\/assets\/fonts\/[0-9a-f]{12}\.ttf$/),
      fontWeight: 400,
      fontStyle: 'normal',
      fontSize: 14,
      lineHeight: 1.4,
      letterSpacing: 0,
      fontFeatures: {},
      textCase: 'uppercase',
      textDecoration: [],
    });
    expect(button.parts.text.states!.hover!.typography).toEqual(
      button.parts.text.typography,
    );
    expect(text('input', 'value')).not.toHaveProperty('textCase');
    expect(text('input', 'label').font).toBe(text('input', 'value').font);
    expect(text('news-item', 'title').font).not.toBe(
      text('news-item', 'date').font,
    );
    const fonts = new Set(
      ['input.value', 'button.text', 'news-item.title', 'news-item.date'].map(
        (id) => {
          const [root, part] = id.split('.');
          return text(root, part).font;
        },
      ),
    );
    // The TTC's 400 member was instantiated from the same variable font as the
    // Google 400 face, so the two compile to identical bytes and one file.
    expect(fonts.size).toBe(3);
    expect(readdirRecursive(`${dir}/assets/fonts`)).toHaveLength(3);

    // Colors, defaults, and built-in variants.
    expect(theme.window).toEqual({ fill: '#123456', borderColor: 'none' });
    expect(theme['focus-ring']).toEqual({
      color: '#123456',
      width: 3,
      offset: -2,
    });
    expect(theme.panel).toMatchObject({
      fill: '#8294a8',
      radius: 'pill',
      corner: 'squircle',
    });
    const gem = theme['news-item'].parts!.gem as Static<
      typeof CompiledVariantImage
    >;
    expect(Object.keys(gem.assets).sort()).toEqual([
      'events',
      'maintenance',
      'news',
      'updates',
    ]);
    expect(gem.states!.hover!.assets.events).toBe(gem.assets.news);
    expect(gem.states!.hover!.assets.updates).toBe(gem.assets.updates);

    // dot, tinted, two frames, four hints, three default gems.
    expect(
      readdirRecursive(`${dir}/assets`).filter((f) => f.endsWith('.svg')),
    ).toHaveLength(11);

    const metadata = read('metadata.json') as Record<string, unknown>;
    expect(metadata).toMatchObject({ name: 'Fixture', updates: null });
    expect(metadata).not.toHaveProperty('formatVersion');
    const preview = await sharp(
      readFileSync(`${dir}/${(metadata.previewImage as string).slice(2)}`),
    ).metadata();
    expect([preview.width, preview.height, preview.exif]).toEqual([
      1,
      2,
      undefined,
    ]);

    const licenses = read('licenses.json') as {
      files: string[];
      license: string;
      licenseFile?: string;
    }[];
    expect(licenses.map((l) => [l.license, l.files.length])).toEqual([
      ['Apache-2.0', 4],
      ['OFL-1.1', 3],
    ]);
    expect(
      readFileSync(`${dir}/${licenses[0].licenseFile!.slice(2)}`, 'utf8'),
    ).toMatch(/^Apache License/);
    expect(
      readFileSync(`${dir}/${licenses[1].licenseFile!.slice(2)}`, 'utf8'),
    ).toMatch(/^Copyright 2020/);

    expect(diagnostics).toEqual([
      expect.objectContaining({
        severity: 'warning',
        code: 'nine-slice',
        file: 'controls/button.json',
        path: '/states/hover/asset',
      }),
    ]);
  }, 60_000);

  it('collects every resource and metadata error before failing', async () => {
    const exit = await compile(['full', 'bad-resources']);
    const err = Exit.isFailure(exit)
      ? Option.getOrThrow(Cause.failureOption(exit.cause))
      : undefined;
    expect(err).toBeInstanceOf(CompileFailed);
    expect(
      (err as CompileFailed).diagnostics
        .filter((d) => d.severity === 'error')
        .map((d) => `${d.file}${d.path}: ${d.message}`),
    ).toEqual([
      'controls/carousel.json/parts/nav: the selected SVG uses currentColor but the configuration omits it',
      'controls/carousel.json/parts/pip/asset: ./assets/missing.svg does not exist',
      'controls/setting-help.json/parts/title/typography: ValueError: collections with more than one family are not supported',
      'controls/setting-help.json/parts/body/typography: ValueError: the source cannot provide weight 500 normal (0 matching faces)',
      'controls/settings.json/parts/heading/typography: unknown Google Font "gfont:Nope"',
      'controls/subtabs.json/asset: <svg>: nine-slice requires a direct child <rect id="frame">',
      expect.stringMatching(/^metadata\.json\/previewImage: /),
    ]);
  }, 60_000);
});
