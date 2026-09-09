/**
 * Every first-party theme under themes/ must compile cleanly. Google Fonts
 * are stood in by the fixture font, since the real key is browser-only.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NodeFileSystem } from '@effect/platform-node';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { describe, expect, it } from 'vitest';
import { compileProject } from './compiler';
import { CompileFailed, Diagnostics } from './diagnostics';
import { FIXTURES } from './fixtures';
import { FontTools } from './fontTools';
import { GoogleFonts, gfontFamily } from './googleFonts';
import { imagesSharp } from './imagesNode';
import { Svg } from './svg';

const THEMES = resolve(process.cwd(), 'themes');
let py: Promise<PyodideInterface> | undefined;
const load = () =>
  (py ??= loadPyodide({
    packages: ['fonttools'],
    packageCacheDir: resolve(process.cwd(), '.pyodide-assets'),
  }));

const google = Layer.succeed(
  GoogleFonts,
  new GoogleFonts({
    list: Effect.succeed([]),
    lookup: (uri) =>
      Effect.succeed({
        family: gfontFamily(uri),
        files: {
          regular: 'https://fonts.gstatic.com/s/sg.ttf',
          italic: 'https://fonts.gstatic.com/s/sg-italic.ttf',
        },
        axes: [{ tag: 'wght', start: 300, end: 700 }],
      }),
    // sg-italic.ttf is the fixture font with its italic bits set.
    download: (url) =>
      Effect.succeed(
        new Uint8Array(
          readFileSync(
            url.endsWith('sg-italic.ttf')
              ? `${FIXTURES}/sg-italic.ttf`
              : `${FIXTURES}/full/assets/sg.ttf`,
          ),
        ),
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

describe('first-party themes', () => {
  it.each(readdirSync(THEMES))(
    '%s compiles without errors',
    async (name) => {
      const exit = await Effect.runPromiseExit(
        compileProject(`${THEMES}/${name}`).pipe(
          Effect.scoped,
          Effect.provide(layer),
        ),
      );
      if (Exit.isFailure(exit)) {
        const err = Option.getOrThrow(Cause.failureOption(exit.cause));
        const lines =
          err instanceof CompileFailed
            ? err.diagnostics.map(
                (d) => `${d.severity}: ${d.file}${d.path ?? ''}: ${d.message}`,
              )
            : [String(err)];
        expect.fail(lines.join('\n'));
      }
      // The compiler already conforms theme.json to the compiled schema.
      expect(
        exit.value.diagnostics.filter((d) => d.severity === 'error'),
      ).toEqual([]);
    },
    60_000,
  );
});
