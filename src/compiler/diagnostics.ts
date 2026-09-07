/**
 * Compiler diagnostics. Stages report everything they find and keep going;
 * `checkpoint` fails the compile at a stage boundary if any error was reported,
 * so the author sees every problem in one run.
 */
import { Data, Effect, Ref } from 'effect';

export type Severity = 'info' | 'warning' | 'error';

export interface Diagnostic {
  readonly severity: Severity;
  readonly code: string;
  readonly message: string;
  /** Project-relative file, e.g. `controls/button.json`. */
  readonly file?: string;
  /** JSON pointer or dotted path inside `file`. */
  readonly path?: string;
}

export class CompileFailed extends Data.TaggedError('CompileFailed')<{
  readonly diagnostics: readonly Diagnostic[];
}> {
  override get message() {
    return this.diagnostics
      .filter((d) => d.severity === 'error')
      .map((d) => `${d.file ?? ''}${d.path ? `#${d.path}` : ''}: ${d.message}`)
      .join('\n');
  }
}

export class Diagnostics extends Effect.Service<Diagnostics>()('Diagnostics', {
  effect: Effect.gen(function* () {
    const ref = yield* Ref.make<readonly Diagnostic[]>([]);
    const report = (d: Diagnostic) => Ref.update(ref, (ds) => [...ds, d]);
    const emit =
      (severity: Severity) =>
      (
        code: string,
        message: string,
        at: Pick<Diagnostic, 'file' | 'path'> = {},
      ) =>
        report({ severity, code, message, ...at });
    return {
      report,
      info: emit('info'),
      warn: emit('warning'),
      error: emit('error'),
      all: Ref.get(ref),
      checkpoint: Effect.gen(function* () {
        const diagnostics = yield* Ref.get(ref);
        if (diagnostics.some((d) => d.severity === 'error')) {
          return yield* new CompileFailed({ diagnostics });
        }
      }),
    };
  }),
}) {}
