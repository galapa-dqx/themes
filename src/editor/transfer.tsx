/** The header's export/import actions: run an archive effect, download or navigate, show the error. */
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Modal } from '@mantine/core';
import { Effect, type ManagedRuntime } from 'effect';
import { PROJECT_EXTENSION, THEME_EXTENSION } from '@/theme/schema';
import {
  download,
  exportProject,
  exportTheme,
  fileName,
  importProject,
} from './archive';
import { useProjectStoreApi } from './projectStore';
import { runtime } from './runtime';

function useAction<In, A>(
  effect: (
    input: In,
  ) => Effect.Effect<
    A,
    { message: string },
    ManagedRuntime.ManagedRuntime.Context<typeof runtime>
  >,
  then: (a: A) => void,
) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const run = (input: In) => {
    setBusy(true);
    runtime
      .runPromise(effect(input).pipe(Effect.either))
      .then((r) =>
        r._tag === 'Right' ? then(r.right) : setError(r.left.message),
      )
      .catch((e: unknown) => setError(String(e)))
      .finally(() => setBusy(false));
  };
  return { run, busy, error, clear: () => setError(undefined) };
}

/** Compiles the open project to a `.galapatheme` download. */
export function useExportTheme() {
  const store = useProjectStoreApi();
  const { run, busy, error, clear } = useAction(
    () => {
      const { dir, doc } = store.getState();
      return exportTheme(dir, doc);
    },
    ({ bytes }) =>
      download(
        fileName(store.getState().doc.metadata.name, THEME_EXTENSION),
        bytes,
      ),
  );
  return {
    run,
    busy,
    modal: errorModal('The theme did not compile', error, clear),
  };
}

/** Zips the open project's folder to a `.galapathemeproj` download. */
export function useExportProject() {
  const store = useProjectStoreApi();
  const { run, busy, error, clear } = useAction(
    () => {
      const { dir, doc } = store.getState();
      return exportProject(dir, doc);
    },
    (bytes) =>
      download(
        fileName(store.getState().doc.metadata.name, PROJECT_EXTENSION),
        bytes,
      ),
  );
  return {
    run,
    busy,
    modal: errorModal('Could not export the project', error, clear),
  };
}

/** Unpacks a picked `.galapathemeproj` into a new project and opens it. */
export function useImportProject() {
  const navigate = useNavigate();
  const { run, error, clear } = useAction(
    (file: File) =>
      Effect.flatMap(
        Effect.promise(() => file.arrayBuffer()),
        (buf) => importProject(new Uint8Array(buf)),
      ),
    (id) => navigate(`/editor/${id}/project`),
  );
  return {
    accept: PROJECT_EXTENSION,
    pick: (f: File | null) => f && run(f),
    modal: errorModal('Could not import the project', error, clear),
  };
}

/** Lowercase on purpose: a component export here would trip react-refresh's rule. */
const errorModal = (
  title: string,
  error: string | undefined,
  onClose: () => void,
) => (
  <Modal opened={error !== undefined} onClose={onClose} title={title}>
    <pre style={{ whiteSpace: 'pre-wrap', margin: 0, fontSize: 12 }}>
      {error}
    </pre>
  </Modal>
);
