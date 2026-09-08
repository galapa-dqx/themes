/**
 * One store per open project. The in-memory document is the source of truth
 * for a session; OPFS is write-behind persistence. Every edit is one Immer
 * transaction whose forward and inverse patches form the undo history, and
 * whose patch roots name the project files that became dirty. Session-wide
 * state (settings, recents) lives in `appStore` instead.
 */
import {
  applyPatches,
  enablePatches,
  produceWithPatches,
  type Draft,
  type Patch,
} from 'immer';
import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { RootControlId } from '@/theme/catalog';
import type {
  ProjectControl,
  ProjectMetadata,
  ProjectTokens,
} from '@/theme/schema';

enablePatches();

/** What `loadProject` yields, minus its directory: the persisted document tier. */
export interface Document {
  readonly metadata: ProjectMetadata;
  readonly tokens: ProjectTokens;
  readonly controls: Partial<Record<RootControlId, ProjectControl>>;
}

export interface Transaction {
  readonly label: string;
  readonly patches: readonly Patch[];
  readonly inversePatches: readonly Patch[];
}

export interface ProjectState {
  readonly doc: Document;
  readonly past: readonly Transaction[];
  readonly future: readonly Transaction[];
  /** The patches most recently applied to `doc`, by edit, undo, redo, or a peer tab. */
  readonly applied: readonly Patch[];
  /** True when `applied` came from another tab (not to be rebroadcast). */
  readonly remote: boolean;
  /** Unflushed edits exist or a write is in flight; set by persistence. */
  readonly saving: boolean;
  /** Runs `recipe` as one undoable transaction; a no-op recipe records nothing. */
  edit(label: string, recipe: (doc: Draft<Document>) => void): void;
  undo(): void;
  redo(): void;
  /** Applies another tab's committed patches outside this tab's history. */
  applyRemote(patches: readonly Patch[]): void;
}

// ponytail: unbounded memory otherwise; raise or make it byte-based if needed.
const HISTORY_LIMIT = 200;

export const createProjectStore = (doc: Document) =>
  createStore<ProjectState>((set, get) => ({
    doc,
    past: [],
    future: [],
    applied: [],
    remote: false,
    saving: false,
    edit: (label, recipe) => {
      const { doc, past } = get();
      const [next, patches, inversePatches] = produceWithPatches(doc, recipe);
      if (patches.length === 0) return;
      set({
        doc: next,
        past: [
          ...past.slice(-(HISTORY_LIMIT - 1)),
          { label, patches, inversePatches },
        ],
        future: [],
        applied: patches,
        remote: false,
      });
    },
    undo: () => {
      const { doc, past, future } = get();
      const tx = past.at(-1);
      if (!tx) return;
      set({
        doc: applyPatches(doc, tx.inversePatches),
        past: past.slice(0, -1),
        future: [tx, ...future],
        applied: tx.inversePatches,
        remote: false,
      });
    },
    redo: () => {
      const { doc, past, future } = get();
      const tx = future[0];
      if (!tx) return;
      set({
        doc: applyPatches(doc, tx.patches),
        past: [...past, tx],
        future: future.slice(1),
        applied: tx.patches,
        remote: false,
      });
    },
    // ponytail: local undo entries may no longer apply cleanly over a peer's
    // edit to the same path; history is per tab and best-effort across tabs.
    applyRemote: (patches) =>
      set((s) => ({
        doc: applyPatches(s.doc, patches),
        applied: patches,
        remote: true,
      })),
  }));
export type ProjectStore = ReturnType<typeof createProjectStore>;

const ProjectStoreContext = createContext<ProjectStore | undefined>(undefined);
export const ProjectStoreProvider = ProjectStoreContext;
export const useProjectStore = <T>(selector: (s: ProjectState) => T) => {
  const store = useContext(ProjectStoreContext);
  if (!store) throw new Error('useProjectStore outside a ProjectStoreProvider');
  return useStore(store, selector);
};

const ID_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** The route and OPFS folder id; `metadata.id` is this under the `app.galapa.themes.` prefix. */
export const newProjectId = () =>
  Array.from(
    crypto.getRandomValues(new Uint8Array(20)),
    (b) => ID_ALPHABET[b % 36],
  ).join('');

/** A blank, tolerant document; required controls are a compile-time diagnostic. */
export const newDocument = (id: string, name: string): Document => ({
  metadata: {
    formatVersion: 1,
    id: `app.galapa.themes.${id}`,
    name,
    author: { name: '' },
    updates: null,
    chromeStyle: 'dark',
  },
  tokens: {},
  controls: {},
});

/** Project files (relative to the project root) that `patches` made dirty. */
export const dirtyFiles = (patches: readonly Patch[]) => {
  const files = new Set<string>();
  for (const { path } of patches) {
    const [root, id] = path;
    if (root === 'controls') {
      // ponytail: a patch at bare `controls` (whole-map replace) isn't emitted by
      // per-control recipes; add a doc-diff fallback if one ever appears.
      if (id !== undefined) files.add(`controls/${id}.json`);
    } else files.add(`${root}.json`);
  }
  return files;
};
