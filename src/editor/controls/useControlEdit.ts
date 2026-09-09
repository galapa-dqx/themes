/**
 * Read/write access to one root control for the editor cards. Every write is
 * a `store.edit` with a label naming the exact field, so a scrub coalesces
 * into one undo entry while different fields stay separate. Writing into a
 * control or part the project lacks creates it from a schema-valid skeleton.
 */
import type { Draft } from 'immer';
import {
  CONTROL_CATALOG,
  type CatalogEntry,
  type ControlState,
  type RootControlId,
} from '@/theme/catalog';
import {
  useProjectStore,
  type Document,
  type ProjectState,
} from '@/editor/projectStore';
import { EMPTY } from '@/editor/tokensUtil';
import type { StateName } from '@/editor/preview/resolve';

export type PartPath = readonly string[];
export type Raw = Record<string, unknown>;

/** The raw JSON of the node at `path` (root when empty), or the frozen EMPTY. */
export const nodeAt = (raw: unknown, path: PartPath): Raw =>
  (path.reduce<unknown>(
    (n, p) => (n as Raw | undefined)?.parts && ((n as Raw).parts as Raw)[p],
    raw,
  ) as Raw | undefined) ?? EMPTY;

/** `a.b.c` read from a plain object. */
export const getIn = (o: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((n, k) => (n as Raw | undefined)?.[k], o);

const firstToken = (
  tokens: Document['tokens'],
  category: 'colors' | 'typography' | 'assets',
  preferred: string[],
) => {
  const names = Object.keys(tokens[category] ?? {});
  const name = preferred.find((n) => names.includes(n)) ?? names[0];
  return name ? `{${category}.${name}}` : undefined;
};

/**
 * A minimal config for `entry`, required parts included. Schema-valid except
 * for an image with a required asset when the project has no asset tokens.
 */
export const skeleton = (
  entry: CatalogEntry,
  tokens: Document['tokens'],
): Raw => {
  const color = firstToken(tokens, 'colors', ['text', 'accent']) ?? '#000000';
  const out: Raw = (() => {
    switch (entry.kind) {
      case 'frame':
        // Nothing styled: this also backs `ensure`, so editing one field of a
        // missing frame must not paint it. `create` adds the surface look.
        return { shape: 'path' };
      case 'text':
        return {
          color,
          typography: firstToken(tokens, 'typography', ['body']) ?? {
            fontSize: 14,
          },
        };
      case 'paint':
        return { color };
      case 'window':
        return { fill: firstToken(tokens, 'colors', ['bg']) ?? '#ffffff' };
      case 'focus-ring':
        return { color: firstToken(tokens, 'colors', ['accent']) ?? color };
      // The built-in art every variant falls back to is drawn in currentColor,
      // so a tint is what makes it visible at all.
      case 'variant-image':
        return {
          currentColor: firstToken(tokens, 'colors', ['muted']) ?? color,
        };
      case 'image': {
        const asset = entry.assetOptional
          ? undefined
          : firstToken(tokens, 'assets', []);
        return asset ? { asset } : {};
      }
      default:
        return {};
    }
  })();
  const parts = Object.entries(entry.parts ?? {}).filter(([, p]) => p.required);
  if (parts.length)
    out.parts = Object.fromEntries(
      parts.map(([name, p]) => [name, skeleton(p, tokens)]),
    );
  return out;
};

/**
 * main's "Convert to Path" default (ControlsPage 518-531), which is also what
 * every first-party frame is: a surface with a hairline border. Only the
 * conventional token names — an arbitrary colour as a fill is worse than none.
 * Deliberately *not* part of `skeleton`: only an explicit `create` paints.
 */
const frameLook = (tokens: Document['tokens']): Raw => {
  const names = Object.keys(tokens.colors ?? {});
  const pick = (wanted: string[]) => wanted.find((n) => names.includes(n));
  const fill = pick(['surface', 'bg']);
  const line = pick(['border', 'outline']);
  return {
    ...(fill && { fill: `{colors.${fill}}` }),
    ...(line && { border: { color: `{colors.${line}}`, thickness: 1 } }),
  };
};

const entryAt = (root: CatalogEntry, path: PartPath) =>
  path.reduce((e, p) => e.parts![p], root);

/** Every node of the control: root first, then parts depth-first, with its catalog entry. */
const nodes = (root: CatalogEntry, raw: Raw): [Raw, CatalogEntry][] => [
  [raw, root],
  ...Object.entries(root.parts ?? {}).flatMap(([name, e]) => {
    const part = (raw.parts as Raw | undefined)?.[name] as Raw | undefined;
    return part ? nodes(e, part) : [];
  }),
];

/** Frame keys that mean the same under either shape. */
const SHAPE_FREE = new Set(['parts', 'states', 'opacity', 'size', 'showRing']);

const prune = (n: Raw) => {
  if (n.states && Object.keys(n.states as Raw).length === 0) delete n.states;
};

export function useControlEdit(id: RootControlId) {
  const raw = useProjectStore((s) => s.doc.controls[id] ?? EMPTY) as Raw;
  const edit = useProjectStore((s) => s.edit);
  return controlEdit(id, raw, edit);
}
export type ControlEdit = ReturnType<typeof useControlEdit>;

/** The hook's body over a snapshot of the control and the store's `edit`. */
export function controlEdit(
  id: RootControlId,
  raw: Raw,
  edit: ProjectState['edit'],
) {
  const root: CatalogEntry = CONTROL_CATALOG[id];

  /** The node at `path` in the draft, creating the control and parts on the way. */
  const ensure = (d: Draft<Document>, path: PartPath): Raw => {
    const controls = d.controls as Record<string, Raw>;
    let n = (controls[id] ??= skeleton(root, d.tokens));
    let e = root;
    for (const p of path) {
      e = e.parts![p];
      const parts = (n.parts ??= {}) as Raw;
      n = (parts[p] ??= skeleton(e, d.tokens)) as Raw;
    }
    return n;
  };

  return {
    id,
    raw,
    entry: root,
    node: (path: PartPath) => nodeAt(raw, path),
    /** Writes `value` at `key` (dotted for nesting) in the state scope; `undefined` deletes. */
    set(path: PartPath, state: StateName, key: string, value: unknown) {
      if (value === undefined && nodeAt(raw, path) === EMPTY) return;
      edit(`Edit ${[id, ...path].join('.')} ${state} ${key}`, (d) => {
        const n = ensure(d, path);
        const scope =
          state === 'default'
            ? n
            : ((((n.states ??= {}) as Raw)[state] ??= {}) as Raw);
        const keys = key.split('.');
        const leaf = keys.pop()!;
        // Walk down creating objects; on delete, drop emptied parents.
        const chain: Raw[] = [scope];
        for (const k of keys) {
          const cur = chain.at(-1)!;
          if (value === undefined && !cur[k]) return;
          chain.push((cur[k] ??= {}) as Raw);
        }
        const target = chain.at(-1)!;
        if (value === undefined) delete target[leaf];
        else target[leaf] = value;
        for (let i = chain.length - 1; i > 0; i--) {
          if (Object.keys(chain[i]).length === 0)
            delete chain[i - 1][keys[i - 1]];
        }
        if (state !== 'default' && Object.keys(scope).length === 0)
          delete (n.states as Raw)[state];
        prune(n);
      });
    },
    /** Drops `states[state]` at the root and every part. */
    resetState(state: ControlState) {
      edit(`Reset ${id} ${state}`, (d) => {
        const r = d.controls[id] as Raw | undefined;
        if (!r) return;
        for (const [n] of nodes(root, r)) {
          delete (n.states as Raw | undefined)?.[state];
          prune(n);
        }
      });
    },
    /** Copies `states[from]` over `states[to]` wherever the catalog allows both. */
    copyState(from: ControlState, to: ControlState) {
      edit(`Copy ${id} ${from} to ${to}`, (d) => {
        const r = d.controls[id] as Raw | undefined;
        if (!r) return;
        for (const [n, e] of nodes(root, r)) {
          if (!e.states?.includes(to)) continue;
          const src = (n.states as Raw | undefined)?.[from] as Raw | undefined;
          if (!src) {
            delete (n.states as Raw | undefined)?.[to];
            prune(n);
            continue;
          }
          // Drafts are proxies; a JSON round trip is the plain deep copy.
          const copy = JSON.parse(JSON.stringify(src)) as Raw;
          if (to !== 'focused') delete copy.showRing;
          ((n.states ??= {}) as Raw)[to] = copy;
        }
      });
    },
    /** Switches the frame at `path` to `shape`, dropping only the other shape's fields (base and states). */
    setShape(path: PartPath, shape: 'path' | 'asset') {
      edit(`Set ${[id, ...path].join('.')} shape`, (d) => {
        const n = ensure(d, path);
        const strip = (o: Raw) => {
          for (const k of Object.keys(o)) if (!SHAPE_FREE.has(k)) delete o[k];
        };
        strip(n);
        const states = (n.states ?? {}) as Record<string, Raw>;
        for (const s of Object.keys(states)) {
          strip(states[s]);
          if (Object.keys(states[s]).length === 0) delete states[s];
        }
        prune(n);
        n.shape = shape;
      });
    },
    /** Creates the whole control from the skeleton when the project lacks it. */
    create() {
      edit(`Create ${id}`, (d) => {
        const controls = d.controls as Record<string, Raw>;
        if (controls[id]) return;
        const s = skeleton(root, d.tokens);
        // Root frames only, and only here: a created frame should be visible.
        controls[id] =
          root.kind === 'frame'
            ? { shape: 'path', ...frameLook(d.tokens), ...s }
            : s;
      });
    },
    entryAt: (path: PartPath) => entryAt(root, path),
  };
}
