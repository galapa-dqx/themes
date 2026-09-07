import { Cause, Effect, Exit, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { CompileFailed, Diagnostics } from './diagnostics.ts';

const run = <A, E>(effect: Effect.Effect<A, E, Diagnostics>) =>
  Effect.runPromiseExit(effect.pipe(Effect.provide(Diagnostics.Default)));

describe('Diagnostics', () => {
  it('passes a checkpoint with only warnings', async () => {
    const exit = await run(
      Effect.gen(function* () {
        const d = yield* Diagnostics;
        yield* d.warn('x', 'careful', { file: 'tokens.json' });
        yield* d.checkpoint;
        return yield* d.all;
      }),
    );
    expect(Exit.isSuccess(exit) && exit.value).toEqual([
      {
        severity: 'warning',
        code: 'x',
        message: 'careful',
        file: 'tokens.json',
      },
    ]);
  });

  it('fails a checkpoint with every collected diagnostic', async () => {
    const exit = await run(
      Effect.gen(function* () {
        const d = yield* Diagnostics;
        yield* d.error('a', 'first', { file: 'a.json', path: '/x' });
        yield* d.error('b', 'second');
        yield* d.checkpoint;
      }),
    );
    const err = Exit.isFailure(exit)
      ? Option.getOrThrow(Cause.failureOption(exit.cause))
      : undefined;
    expect(err).toBeInstanceOf(CompileFailed);
    expect(err?.diagnostics).toHaveLength(2);
    expect(err?.message).toBe('a.json#/x: first\n: second');
  });
});
