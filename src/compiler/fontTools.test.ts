import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Effect, Either } from 'effect';
import { loadPyodide, type PyodideInterface } from 'pyodide';
import { describe, expect, it } from 'vitest';
import { FontTools, type FaceRequest } from './fontTools';

// Space Grotesk (OFL-1.1) variable font subset to "Galapa" for test size; wght 300-700.
const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(import.meta.dirname, 'fixtures', name)));
const source = fixture('full/assets/sg.ttf');
/** Two static faces (400, 700) of the same family. */
const collection = fixture('full/assets/sg.ttc');

let py: Promise<PyodideInterface> | undefined;
const load = () =>
  (py ??= loadPyodide({
    packages: ['fonttools'],
    packageCacheDir: resolve(process.cwd(), '.pyodide-assets'),
  }));
const layer = FontTools.inProcess(load);

const compile = (bytes: Uint8Array, request: FaceRequest) =>
  Effect.runPromise(
    Effect.flatMap(FontTools, (f) => f.compile(bytes, request)).pipe(
      Effect.provide(layer),
      Effect.either,
    ),
  );

/** Inspects an output font with fontTools itself. */
const inspect = async (bytes: Uint8Array) => {
  const runtime = await load();
  runtime.FS.writeFile('/tmp/inspect.ttf', bytes);
  return JSON.parse(
    String(
      runtime.runPython(`
import json
from fontTools.ttLib import TTFont
f = TTFont('/tmp/inspect.ttf')
json.dumps({
  "variable": "fvar" in f,
  "weight": f["OS/2"].usWeightClass,
  "italic": bool(f["OS/2"].fsSelection & 1),
  "glyphs": len(f.getGlyphOrder()),
  "gsub": "GSUB" in f,
})`),
    ),
  ) as {
    variable: boolean;
    weight: number;
    italic: boolean;
    glyphs: number;
    gsub: boolean;
  };
};

describe('FontTools', () => {
  it('instantiates a variable font into an exact static face with its license', async () => {
    const r = await compile(source, { weight: 500, style: 'normal', axes: {} });
    if (Either.isLeft(r)) throw r.left;
    const face = r.right;
    expect(face.extension).toBe('ttf');
    expect(face.license.identifier).toBe('OFL-1.1');
    expect(face.license.copyright).toMatch(
      /^Copyright 2020 The Space Grotesk Project Authors/,
    );
    expect(face.license.url).toBe('https://scripts.sil.org/OFL');
    const info = await inspect(face.bytes);
    expect(info.variable).toBe(false);
    expect(info.weight).toBe(500);
    expect(info.glyphs).toBe((await inspect(source)).glyphs);
  }, 60_000);

  it('rejects faces the source cannot provide, naming the range', async () => {
    // One runtime, one layer: the semaphore serializes only within a layer instance.
    const messages: string[] = [];
    for (const request of [
      { weight: 900, style: 'normal', axes: {} },
      { weight: 400, style: 'italic', axes: {} },
      { weight: 400, style: 'normal', axes: { opsz: 12 } },
    ] as FaceRequest[]) {
      const r = await compile(source, request);
      messages.push(Either.isLeft(r) ? r.left.message : 'ok');
    }
    expect(messages).toEqual([
      'ValueError: the source cannot provide weight 900 normal (0 matching faces)',
      'ValueError: the source cannot provide weight 400 italic (0 matching faces)',
      'ValueError: the font has no opsz axis',
    ]);
  }, 60_000);

  it('extracts the one matching face from a collection', async () => {
    const r = await compile(collection, {
      weight: 700,
      style: 'normal',
      axes: {},
    });
    if (Either.isLeft(r)) throw r.left;
    expect(await inspect(r.right.bytes)).toMatchObject({
      variable: false,
      weight: 700,
    });
    const missing = await compile(collection, {
      weight: 500,
      style: 'normal',
      axes: {},
    });
    expect(Either.isLeft(missing) && missing.left.message).toBe(
      'ValueError: the source cannot provide weight 500 normal (0 matching faces)',
    );
    const mixed = await compile(fixture('bad-resources/assets/mixed.ttc'), {
      weight: 400,
      style: 'normal',
      axes: {},
    });
    expect(Either.isLeft(mixed) && mixed.left.message).toBe(
      'ValueError: collections with more than one family are not supported',
    );
  }, 60_000);

  it('accepts a static face only at its exact weight and style', async () => {
    const stat = await compile(source, {
      weight: 700,
      style: 'normal',
      axes: {},
    });
    if (Either.isLeft(stat)) throw stat.left;
    const again = await compile(stat.right.bytes, {
      weight: 700,
      style: 'normal',
      axes: {},
    });
    expect(Either.isRight(again)).toBe(true);
    const wrong = await compile(stat.right.bytes, {
      weight: 400,
      style: 'normal',
      axes: {},
    });
    expect(Either.isLeft(wrong) && wrong.left.message).toBe(
      'ValueError: the source cannot provide weight 400 normal (0 matching faces)',
    );
    const garbage = await compile(new Uint8Array([1, 2, 3]), {
      weight: 400,
      style: 'normal',
      axes: {},
    });
    expect(Either.isLeft(garbage)).toBe(true);
  }, 60_000);
});
