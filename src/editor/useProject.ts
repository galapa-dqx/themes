import { useEffect, useState } from 'react';
import { Cause, Effect, Exit, Scope } from 'effect';
import { openProject, type OpenedProject } from './persistence';
import { runtime } from './runtime';

type Result =
  { status: 'error'; message: string } | ({ status: 'open' } & OpenedProject);
export type ProjectState = { status: 'loading' } | Result;

/** Opens `/projects/<id>` for the component's lifetime; unmount flushes and closes it. */
export function useProject(id: string): ProjectState {
  const [result, setResult] = useState<Result & { id: string }>();
  useEffect(() => {
    const scope = Effect.runSync(Scope.make());
    let live = true;
    const settle = (r: Result) => live && setResult({ id, ...r });
    runtime
      .runPromise(openProject(id).pipe(Scope.extend(scope), Effect.either))
      .then((r) =>
        r._tag === 'Right'
          ? settle({ status: 'open', ...r.right })
          : settle({ status: 'error', message: r.left.message }),
      )
      .catch((e) =>
        settle({ status: 'error', message: Cause.pretty(Cause.die(e)) }),
      );
    return () => {
      live = false;
      runtime.runFork(Scope.close(scope, Exit.void));
    };
  }, [id]);
  return result?.id === id ? result : { status: 'loading' };
}
