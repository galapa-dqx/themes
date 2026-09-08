import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFileSystem } from '@effect/platform-node';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import sharp from 'sharp';
import Value from 'typebox/value';
import { describe, expect, it } from 'vitest';
import type { Static } from 'typebox';
import {
  CompiledAssetFrame,
  CompiledText,
  CompiledThemeSchema,
  CompiledVariantImage,
  type CompiledTheme,
} from '@/theme/schema';
import { compileProject } from './compiler';
import { CompileFailed, Diagnostics } from './diagnostics';
import { MINIMAL_PROJECT, writeProject } from './fixtures/minimal';
import { FontTools } from './fontTools';
import { FontSourceError, GoogleFonts } from './googleFonts';
import { imagesSharp } from './imagesNode';
import { Svg } from './svg';

const font = new Uint8Array(
  readFileSync(
    resolve(import.meta.dirname, 'fixtures/space-grotesk-subset.ttf'),
  ),
);
let py: Promise<PyodideInterface> | undefined;
const load = () =>
  (py ??= loadPyodide({
    packages: ['fonttools'],
    packageCacheDir: resolve(process.cwd(), '.pyodide-assets'),
  }));

/** Google Fonts stand-in: Space Grotesk is the fixture, everything else is unknown. */
const google = Layer.succeed(
  GoogleFonts,
  new GoogleFonts({
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
    download: () => Effect.succeed(font),
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

/** A 2x1 JPEG whose EXIF orientation says "rotate 90": stripping must yield 1x2 with no EXIF. */
const preview = sharp({
  create: { width: 2, height: 1, channels: 3, background: 'red' },
})
  .jpeg()
  .withMetadata({ orientation: 6 })
  .toBuffer();

const compile = (files: Record<string, unknown>) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const out = yield* compileProject(yield* writeProject(files));
      const read = (name: string) =>
        JSON.parse(readFileSync(`${out.dir}/${name}`, 'utf8')) as unknown;
      return { ...out, read };
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

const wrap = (body: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10">${body}</svg>`;
const nine = (content: string) =>
  wrap(
    `<rect id="frame" width="10" height="10" fill="none"/><rect id="content" ${content} fill="none"/>` +
      `<svg id="0_0" width="10" height="10"><rect width="10" height="10" fill="{colors.bg}"/></svg>`,
  );
const text = {
  color: '#111111',
  typography: { font: './assets/sg.ttf', fontWeight: 600, fontSize: 12 },
};

describe('compileProject', () => {
  it('emits a complete, schema-valid package with deduplicated resources', async () => {
    const exit = await compile({
      ...MINIMAL_PROJECT,
      'metadata.json': {
        ...(MINIMAL_PROJECT['metadata.json'] as object),
        previewImage: './assets/preview.jpg',
      },
      'assets/preview.jpg': new Uint8Array(await preview),
      'assets/sg.ttf': font,
      'assets/tinted.svg': wrap('<circle r="4" fill="currentColor"/>'),
      'assets/frame.svg': nine('x="2" y="2" width="6" height="6"'),
      'assets/frame-hover.svg': nine('x="3" y="3" width="4" height="4"'),
      'tokens.json': { colors: { bg: '#123456' } },
      'controls/panel.json': { shape: 'path' },
      'controls/button.json': {
        shape: 'asset',
        asset: './assets/frame.svg',
        states: { hover: { asset: './assets/frame-hover.svg' } },
        parts: {
          text: {
            color: '{colors.bg}',
            typography: {
              font: 'gfont:Space+Grotesk',
              fontWeight: 400,
              fontSize: 14,
            },
            states: { hover: { color: '#ffffff' } },
          },
        },
      },
      'controls/input.json': {
        shape: 'path',
        parts: {
          label: text,
          value: text,
          placeholder: text,
          caret: { color: '#000000' },
        },
      },
      'controls/news-item.json': {
        shape: 'path',
        parts: {
          title: text,
          date: text,
          gem: {
            currentColor: '#ff0000',
            assets: { news: './assets/tinted.svg' },
          },
        },
      },
    });
    if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
    const { read, diagnostics, dir } = exit.value;

    const theme = read('theme.json') as CompiledTheme;
    expect([...Value.Errors(CompiledThemeSchema, theme)]).toEqual([]);
    const button = theme.button as Static<typeof CompiledAssetFrame> & {
      parts: { text: Static<typeof CompiledText> };
    };
    const value = theme.input.parts!.value as Static<typeof CompiledText>;
    const gem = theme['news-item'].parts!.gem as Static<
      typeof CompiledVariantImage
    >;
    const hint = theme['tab-bar'].parts!.hint as Static<
      typeof CompiledVariantImage
    >;
    expect(button.asset).toMatch(/^\.\/assets\/[0-9a-f]{12}\.svg$/);
    expect(button.states!.hover!.asset).not.toBe(button.asset);
    expect(button.parts.text.typography).toEqual({
      font: expect.stringMatching(/^\.\/assets\/fonts\/[0-9a-f]{12}\.ttf$/),
      fontWeight: 400,
      fontStyle: 'normal',
      fontSize: 14,
      lineHeight: 1,
      letterSpacing: 0,
      fontFeatures: {},
      textCase: 'none',
      textDecoration: [],
    });
    expect(button.parts.text.states!.hover!.typography).toEqual(
      button.parts.text.typography,
    );
    expect(value.typography).not.toHaveProperty('textCase');
    expect(theme.window).toEqual({ fill: '#ffffff', borderColor: 'none' });
    expect(Object.keys(gem.assets).sort()).toEqual([
      'events',
      'maintenance',
      'news',
      'updates',
    ]);
    expect(hint.assets).toEqual(
      expect.objectContaining({
        'left-bumper': expect.stringMatching(/\.svg$/),
      }),
    );

    const metadata = read('metadata.json') as Record<string, unknown>;
    expect(metadata).not.toHaveProperty('formatVersion');
    expect(metadata.previewImage).toMatch(/^\.\/assets\/[0-9a-f]{12}\.jpg$/);
    const stripped = await sharp(
      readFileSync(`${dir}/${(metadata.previewImage as string).slice(2)}`),
    ).metadata();
    expect([stripped.width, stripped.height, stripped.exif]).toEqual([
      1,
      2,
      undefined,
    ]);

    const licenses = read('licenses.json') as {
      files: string[];
      license: string;
      licenseFile?: string;
    }[];
    expect(licenses.map((l) => l.license)).toEqual(['Apache-2.0', 'OFL-1.1']);
    expect(licenses[0].files).toHaveLength(4);
    expect(licenses[1].files).toEqual(
      [button.parts.text.typography.font, value.typography.font].sort(),
    );
    expect(
      readFileSync(`${dir}/${licenses[1].licenseFile!.slice(2)}`, 'utf8'),
    ).toMatch(/^Copyright 2020/);
    expect(
      readFileSync(`${dir}/${licenses[0].licenseFile!.slice(2)}`, 'utf8'),
    ).toMatch(/^Apache License/);

    // dot.svg is used by nav and pip once; the two fonts, 4 hints, 3 default gems, tinted, 2 frames.
    const svgs = readdirRecursive(`${dir}/assets`).filter((f) =>
      f.endsWith('.svg'),
    );
    expect(svgs).toHaveLength(1 + 4 + 3 + 1 + 2);
    expect(readdirRecursive(`${dir}/assets/fonts`)).toHaveLength(2);

    expect(diagnostics.filter((d) => d.severity === 'warning')).toEqual([
      expect.objectContaining({
        code: 'nine-slice',
        file: 'controls/button.json',
        path: '/states/hover/asset',
      }),
    ]);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  }, 60_000);

  it('collects resource errors from every control before failing', async () => {
    const exit = await compile({
      ...MINIMAL_PROJECT,
      'metadata.json': {
        ...(MINIMAL_PROJECT['metadata.json'] as object),
        previewImage: './assets/preview.png',
      },
      'assets/preview.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]),
      'assets/tinted.svg': wrap('<circle r="4" fill="currentColor"/>'),
      'controls/carousel.json': {
        shape: 'path',
        parts: {
          nav: { asset: './assets/tinted.svg' },
          pip: { asset: './assets/missing.svg' },
        },
      },
      'controls/settings.json': {
        parts: {
          heading: {
            color: '#000000',
            typography: { font: 'gfont:Nope', fontWeight: 400, fontSize: 12 },
          },
        },
      },
      'controls/subtabs.json': { shape: 'asset', asset: './assets/dot.svg' },
    });
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
      'controls/settings.json/parts/heading/typography: unknown Google Font "gfont:Nope"',
      'controls/subtabs.json/asset: <svg>: nine-slice requires a direct child <rect id="frame">',
      expect.stringMatching(/^metadata.json\/previewImage: /),
    ]);
  }, 60_000);
});

const readdirRecursive = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const path = `${dir}/${name}`;
    return statSync(path).isDirectory() ? readdirRecursive(path) : [path];
  });
