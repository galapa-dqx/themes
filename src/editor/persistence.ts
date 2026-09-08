/**
 * Opens a project's OPFS working folder (`/projects/<id>`) into a project
 * store and keeps every open tab in sync. Each tab broadcasts its committed
 * Immer patches on a BroadcastChannel and applies the others'. Each tab
 * writes only its own edits: dirty files are batched with
 * `Stream.groupedWithin`, serialized from the current snapshot, and written
 * under a per-file Web Lock. A tab opening while peers exist takes its
 * starting document from a peer rather than possibly-stale disk.
 */
import { FileSystem } from '@effect/platform';
import { Clock, Duration, Effect, Option, Queue, Stream } from 'effect';
import { Diagnostics, type Diagnostic } from '@/compiler/diagnostics';
import { loadProject } from '@/compiler/project';
import type { RootControlId } from '@/theme/catalog';
import { schemaUrl } from '@/theme/schema';
import {
  createProjectStore,
  dirtyFiles,
  newDocument,
  newProjectId,
  type Document,
  type ProjectStore,
} from './projectStore';

export const projectDir = (id: string) => `/projects/${id}`;

/** Contents of `file` for `doc`, or undefined when the file should not exist. */
export const serialize = (doc: Document, file: string) => {
  let value: object | undefined;
  let schema: string;
  if (file === 'metadata.json') [value, schema] = [doc.metadata, 'metadata'];
  else if (file === 'tokens.json') [value, schema] = [doc.tokens, 'tokens'];
  else {
    const id = file.slice('controls/'.length, -'.json'.length);
    [value, schema] = [doc.controls[id as RootControlId], `controls/${id}`];
  }
  if (!value) return undefined;
  return (
    JSON.stringify({ $schema: schemaUrl(schema), ...value }, null, 2) + '\n'
  );
};

// ---------------------------------------------------------------- tabs

type Message =
  | { type: 'hello' }
  | { type: 'snapshot'; doc: Document }
  | {
      type: 'patches';
      patches: ProjectStore extends infer S
        ? S extends { getState(): { applied: infer P } }
          ? P
          : never
        : never;
    };

const channel = (id: string) =>
  Effect.acquireRelease(
    Effect.sync(() => new BroadcastChannel(`project:${id}`)),
    (ch) => Effect.sync(() => ch.close()),
  );

/** A peer's current document, or undefined if none answers within `wait`. */
const peerSnapshot = (id: string, wait: Duration.DurationInput) =>
  Effect.gen(function* () {
    const ch = yield* channel(id);
    return yield* Effect.async<Document | undefined>((resume) => {
      ch.onmessage = (e: MessageEvent<Message>) => {
        if (e.data.type === 'snapshot') resume(Effect.succeed(e.data.doc));
      };
      ch.postMessage({ type: 'hello' } satisfies Message);
    }).pipe(
      Effect.timeoutTo({
        duration: wait,
        onTimeout: () => undefined,
        onSuccess: (d) => d,
      }),
    );
  }).pipe(Effect.scoped);

/** Broadcasts local patches, applies peers', and answers `hello` with a snapshot. */
const syncTabs = (id: string, store: ProjectStore) =>
  Effect.gen(function* () {
    const ch = yield* channel(id);
    ch.onmessage = (e: MessageEvent<Message>) => {
      const m = e.data;
      if (m.type === 'patches') store.getState().applyRemote(m.patches);
      else if (m.type === 'hello')
        ch.postMessage({
          type: 'snapshot',
          doc: store.getState().doc,
        } satisfies Message);
    };
    const unsubscribe = store.subscribe((s, prev) => {
      if (s.applied !== prev.applied && !s.remote)
        ch.postMessage({
          type: 'patches',
          patches: s.applied,
        } satisfies Message);
    });
    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));
  });

/** Runs `effect` while holding the Web Lock `name`. No-op without Web Locks. */
const locked = <A, E, R>(name: string, effect: Effect.Effect<A, E, R>) =>
  Effect.acquireUseRelease(
    Effect.async<() => void>((resume) => {
      if (typeof navigator === 'undefined' || !navigator.locks)
        return resume(Effect.succeed(() => {}));
      const abort = new AbortController();
      let release = () => {};
      const held = new Promise<void>((r) => (release = r));
      navigator.locks
        .request(name, { signal: abort.signal }, () => {
          resume(Effect.succeed(release));
          return held;
        })
        .catch(() => {});
      return Effect.sync(() => abort.abort());
    }),
    () => effect,
    (release) => Effect.sync(release),
  );

// ---------------------------------------------------------------- writer

/** Batches this tab's dirty files and writes them on a `window` tick (idle ticks are free). */
const writer = (
  store: ProjectStore,
  dir: string,
  window: Duration.DurationInput,
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dirty = new Set<string>();
    const wake = yield* Queue.sliding<void>(1);
    const gate = yield* Effect.makeSemaphore(1);

    const mark = (files: Iterable<string>) => {
      for (const f of files) dirty.add(f);
      store.setState({ saving: true });
      Queue.unsafeOffer(wake, undefined);
    };
    const flush = gate.withPermits(1)(
      Effect.gen(function* () {
        const files = [...dirty];
        if (files.length === 0) return;
        dirty.clear();
        const doc = store.getState().doc;
        yield* Effect.forEach(
          files,
          (f) => {
            const path = `${dir}/${f}`;
            const text = serialize(doc, f);
            return locked(
              `file:${path}`,
              text === undefined
                ? Effect.ignore(fs.remove(path))
                : fs.writeFileString(path, text),
            );
          },
          { concurrency: 4, discard: true },
        ).pipe(
          // ponytail: re-marked and retried on the next edit or close; no backoff.
          Effect.tapError(() =>
            Effect.sync(() => files.forEach((f) => dirty.add(f))),
          ),
          Effect.tap(() =>
            Effect.map(Clock.currentTimeMillis, (savedAt) =>
              store.setState({ savedAt }),
            ),
          ),
          Effect.ensuring(
            Effect.sync(() => store.setState({ saving: dirty.size > 0 })),
          ),
        );
      }).pipe(Effect.uninterruptible),
    );

    const unsubscribe = store.subscribe((s, prev) => {
      if (s.applied !== prev.applied && !s.remote) mark(dirtyFiles(s.applied));
    });
    yield* Effect.addFinalizer(() => Effect.sync(unsubscribe));

    yield* Stream.fromQueue(wake).pipe(
      Stream.groupedWithin(Number.MAX_SAFE_INTEGER, window),
      Stream.runForEach(() => Effect.catchAll(flush, Effect.logError)),
      Effect.forkScoped,
    );
    // Runs before the stream fiber is interrupted (finalizers are LIFO).
    yield* Effect.addFinalizer(() => Effect.orDie(flush));
    return mark;
  });

// ---------------------------------------------------------------- open

export interface OpenOptions {
  /** Flush period: dirty files are written at the next tick of a free-running clock, so within 0..window. */
  readonly window: Duration.DurationInput;
  /** How long a new tab waits for a peer's snapshot before trusting disk. */
  readonly snapshotWait: Duration.DurationInput;
}
const DEFAULTS: OpenOptions = {
  window: '2 seconds',
  snapshotWait: '300 millis',
};

export interface OpenedProject {
  readonly store: ProjectStore;
  readonly diagnostics: readonly Diagnostic[];
  /** True when the folder did not exist and a blank project was started. */
  readonly fresh: boolean;
}

export const openProject = (id: string, options?: Partial<OpenOptions>) =>
  Effect.gen(function* () {
    const opts = { ...DEFAULTS, ...options };
    const fs = yield* FileSystem.FileSystem;
    const dir = projectDir(id);
    const fresh = !(yield* fs.exists(dir));
    yield* fs.makeDirectory(`${dir}/controls`, { recursive: true });

    let doc: Document | undefined = yield* peerSnapshot(id, opts.snapshotWait);
    let diagnostics: readonly Diagnostic[] = [];
    if (doc) {
      /* a peer tab is authoritative */
    } else if (fresh) doc = newDocument(id, 'Untitled theme');
    else {
      const loaded = yield* Effect.gen(function* () {
        const project = yield* loadProject(dir, { tolerant: true });
        return { project, diagnostics: yield* (yield* Diagnostics).all };
      }).pipe(Effect.provide(Diagnostics.Default));
      const { metadata, tokens, controls } = loaded.project;
      doc = { metadata, tokens, controls };
      diagnostics = loaded.diagnostics;
    }

    const store = createProjectStore(doc);
    if (!fresh) {
      const stat = yield* Effect.option(fs.stat(`${dir}/metadata.json`));
      const mtime = Option.flatMap(stat, (s) => s.mtime);
      store.setState({ savedAt: Option.getOrUndefined(mtime)?.getTime() });
    }
    yield* syncTabs(id, store);
    const mark = yield* writer(store, dir, opts.window);
    if (fresh) mark(['metadata.json', 'tokens.json']);
    return { store, diagnostics, fresh } satisfies OpenedProject;
  });

/** Copies `from`'s folder (assets included) and writes `doc` over it under a new id and name. */
export const duplicateProject = (from: string, doc: Document) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const id = newProjectId();
    const dir = projectDir(id);
    yield* fs.copy(projectDir(from), dir);
    const copy: Document = {
      ...doc,
      metadata: {
        ...doc.metadata,
        id: `app.galapa.themes.${id}`,
        name: `${doc.metadata.name} copy`,
      },
    };
    const files = [
      'metadata.json',
      'tokens.json',
      ...Object.keys(copy.controls).map((c) => `controls/${c}.json`),
    ];
    yield* Effect.forEach(
      files,
      (f) => fs.writeFileString(`${dir}/${f}`, serialize(copy, f)!),
      { discard: true },
    );
    return id;
  });
