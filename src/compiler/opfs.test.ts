import { readdirSync, readFileSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { FileSystem } from '@effect/platform';
import { Cause, Effect, Exit, Layer, Option, type Scope } from 'effect';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { describe, expect, it } from 'vitest';
import { compileProject } from './compiler';
import { Diagnostics } from './diagnostics';
import { FIXTURES } from './fixtures';
import { MemoryDirectory } from './fixtures/memoryHandles';
import { FontTools } from './fontTools';
import { FontSourceError, GoogleFonts } from './googleFonts';
import { imagesSharp } from './imagesNode';
import { layer as opfs } from './opfs';
import { Svg } from './svg';

const run = <A, E>(
  root: MemoryDirectory,
  effect: Effect.Effect<A, E, FileSystem.FileSystem | Scope.Scope>,
) =>
  Effect.runPromise(
    effect.pipe(Effect.scoped, Effect.provide(opfs(root)), Effect.either),
  );

describe('OPFS FileSystem', () => {
  it('writes, reads, lists, stats, copies, renames, and removes', async () => {
    const root = new MemoryDirectory();
    const result = await run(
      root,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.makeDirectory('/p/controls', { recursive: true });
        yield* fs.writeFileString('/p/controls/a.json', '{"a":1}');
        yield* fs.writeFile('/p/b.bin', new Uint8Array([1, 2, 3]));
        const listing = yield* fs.readDirectory('/p');
        const text = yield* fs.readFileString('/p/controls/a.json');
        const stat = yield* fs.stat('/p/b.bin');
        const dirStat = yield* fs.stat('/p/controls');
        yield* fs.copy('/p', '/q');
        yield* fs.rename('/q/b.bin', '/q/c.bin');
        yield* fs.remove('/p', { recursive: true });
        const exists = [
          yield* fs.exists('/p'),
          yield* fs.exists('/q/c.bin'),
          yield* fs.exists('/q/controls/a.json'),
        ];
        const tmp = yield* fs.makeTempDirectoryScoped({ prefix: 'x-' });
        yield* fs.writeFileString(`${tmp}/t`, 't');
        return {
          listing,
          text,
          size: Number(stat.size),
          types: [stat.type, dirStat.type],
          exists,
          tmp,
        };
      }),
    );
    if (result._tag === 'Left') throw result.left;
    expect(result.right).toMatchObject({
      listing: ['b.bin', 'controls'],
      text: '{"a":1}',
      size: 3,
      types: ['File', 'Directory'],
      exists: [false, true, true],
    });
    expect(result.right.tmp).toMatch(/^\/\.tmp\/x-/);
    // The scoped temp directory is gone once the scope closes.
    expect(root.children.get('.tmp')).toMatchObject({ children: new Map() });
  });

  it('maps DOM exceptions to platform errors and rejects .. segments', async () => {
    const root = new MemoryDirectory();
    const errors = await run(
      root,
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        yield* fs.writeFileString('/f', 'x');
        return yield* Effect.all(
          [
            fs.readFile('/missing'),
            fs.readDirectory('/f'),
            fs.remove('/nope'),
            fs.readFile('/../etc/passwd'),
            fs.makeDirectory('/a/b'),
          ].map((e) => Effect.flip(e)),
        );
      }),
    );
    if (errors._tag === 'Left') throw errors.left;
    expect(
      errors.right.map((e) => (e._tag === 'SystemError' ? e.reason : e._tag)),
    ).toEqual([
      'NotFound',
      'BadResource',
      'NotFound',
      'BadArgument',
      'NotFound',
    ]);
  });

  it('compiles the full fixture from OPFS into OPFS', async () => {
    const root = new MemoryDirectory();
    let py: Promise<PyodideInterface> | undefined;
    const services = Layer.mergeAll(
      Diagnostics.Default,
      Svg.Default,
      imagesSharp,
      FontTools.inProcess(
        () =>
          (py ??= loadPyodide({
            packages: ['fonttools'],
            packageCacheDir: resolve(process.cwd(), '.pyodide-assets'),
          })),
      ),
      Layer.succeed(
        GoogleFonts,
        new GoogleFonts({
          list: Effect.succeed([]),
          lookup: () =>
            Effect.fail(new FontSourceError({ message: 'offline' })),
          download: () =>
            Effect.fail(new FontSourceError({ message: 'offline' })),
        }),
      ),
    );
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        // Import the on-disk fixture into the memory OPFS, swapping the one gfont for a local font.
        const src = `${FIXTURES}/full`;
        const walk = (dir: string): string[] =>
          readdirSync(dir).flatMap((n) =>
            statSync(`${dir}/${n}`).isDirectory()
              ? walk(`${dir}/${n}`)
              : [`${dir}/${n}`],
          );
        for (const path of walk(src)) {
          const rel = path.slice(src.length);
          yield* fs.makeDirectory(
            `/projects/full${rel}`.replace(/\/[^/]+$/, ''),
            { recursive: true },
          );
          const bytes = readFileSync(path);
          yield* fs.writeFile(`/projects/full${rel}`, new Uint8Array(bytes));
        }
        const tokens = JSON.parse(
          yield* fs.readFileString('/projects/full/tokens.json'),
        );
        tokens.fonts.heading = './assets/sg.ttf';
        yield* fs.writeFileString(
          '/projects/full/tokens.json',
          JSON.stringify(tokens),
        );
        const out = yield* compileProject('/projects/full', '/compiled/full');
        const theme = JSON.parse(
          yield* fs.readFileString(`${out.dir}/theme.json`),
        );
        const assets = yield* fs.readDirectory(`${out.dir}/assets`);
        return { theme, assets, diagnostics: out.diagnostics };
      }).pipe(Effect.scoped, Effect.provide(Layer.merge(opfs(root), services))),
    );
    if (Exit.isFailure(exit))
      throw Option.getOrElse(Cause.failureOption(exit.cause), () =>
        Cause.squash(exit.cause),
      );
    const { theme, assets, diagnostics } = exit.value;
    expect(theme.window).toEqual({ fill: '#123456', borderColor: 'none' });
    expect(assets).toContain('fonts');
    expect(assets.filter((a) => a.endsWith('.svg'))).toHaveLength(11);
    expect(diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
  }, 60_000);
});
