import { NodeFileSystem } from '@effect/platform-node';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { CompileFailed, Diagnostics } from './diagnostics';
import { MINIMAL_PROJECT, writeProject } from './fixtures/minimal';
import { findDuplicateKey, loadProject } from './project';

const layer = Layer.merge(NodeFileSystem.layer, Diagnostics.Default);

const load = (files: Record<string, unknown>) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const dir = yield* writeProject(files);
      const project = yield* loadProject(dir);
      const diagnostics = yield* (yield* Diagnostics).all;
      return { project, diagnostics };
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

const failure = <A, E>(exit: Exit.Exit<A, E>) =>
  Exit.isFailure(exit)
    ? Option.getOrThrow(Cause.failureOption(exit.cause))
    : undefined;

describe('findDuplicateKey', () => {
  it('finds nested duplicates and ignores strings that look like keys', () => {
    expect(findDuplicateKey('{"a":1,"b":{"x":"a","x":2}}')).toBe('/b/x');
    expect(findDuplicateKey('{"a":[{"k":1},{"k":2,"k":3}]}')).toBe('/a/1/k');
    expect(findDuplicateKey('{"a":"\\"a\\"","b":["a","a"]}')).toBeUndefined();
  });
});

describe('loadProject', () => {
  it('loads the minimal project with only $schema hints', async () => {
    const exit = await load(MINIMAL_PROJECT);
    expect(failure(exit)).toBeUndefined();
    if (!Exit.isSuccess(exit)) return;
    const { project, diagnostics } = exit.value;
    expect(project.metadata.name).toBe('Minimal');
    expect(Object.keys(project.controls)).toHaveLength(18);
    expect(project.controls.button).toEqual(
      MINIMAL_PROJECT['controls/button.json'],
    );
    expect(new Set(diagnostics.map((d) => d.severity))).toEqual(
      new Set(['info']),
    );
  });

  it('collects every parse, schema, and catalog error before failing', async () => {
    const exit = await load({
      ...MINIMAL_PROJECT,
      'metadata.json': {
        ...(MINIMAL_PROJECT['metadata.json'] as object),
        $schema: 'https://wrong',
      },
      'tokens.json': '{"colors":{"a":"#000000","a":"#ffffff"}}',
      'controls/button.json': '{"shape": "path",}',
      'controls/panel.json': { shape: 'path', bogus: 1 },
      'controls/bogus.json': {},
      'controls/window.json': undefined,
    });
    const err = failure(exit);
    expect(err).toBeInstanceOf(CompileFailed);
    const errors = (err as CompileFailed).diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${d.code} ${d.file}${d.path ?? ''}`);
    expect(errors).toEqual([
      'schema metadata.json/$schema',
      'json tokens.json/colors/a',
      'control controls/bogus.json',
      'json controls/button.json',
      'schema controls/panel.json/bogus',
      'schema controls/panel.json/shape', // other frame branch; see schemaErrors
      'control controls/window.json',
    ]);
  });
});
