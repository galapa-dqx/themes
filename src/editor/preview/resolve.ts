/**
 * Editor-side control resolution for the preview: `doc.controls[id]` merged
 * with one state at every node, catalog defaults applied, colours as hex.
 * Unlike `src/compiler/controls.ts` it never throws — a half-built control
 * must still render, so an unresolvable reference paints magenta (main's
 * honest-failure colour) and an absent value stays undefined.
 */
import { merge } from '@/compiler/controls';
import { MATERIAL_HINTS, NEWS_GEMS } from '@/compiler/builtin';
import { evalTypography, type Typography } from '@/compiler/tokens';
import {
  CONTROL_CATALOG,
  type CatalogEntry,
  type ControlState,
  type RootControlId,
} from '@/theme/catalog';
import type { ProjectTokens } from '@/theme/schema';
import type { Document } from '@/editor/projectStore';
import { evalAlias, resolveColor, resolver } from '@/editor/tokenView';

export type StateName = 'default' | ControlState;
export type Four = [number, number, number, number];
export type Size = { width?: number; height?: number };
export type Corner = 'round' | 'bevel' | 'scoop' | 'notch' | 'squircle';
export type Placement = 'straddle' | 'inside';
export const MAGENTA = '#ff00ff';

export type PathView = {
  shape: 'path';
  radius: number | 'pill';
  corner: Corner;
  /** hex | 'none' */
  fill: string;
  border: { color: string; thickness: Four };
  padding: Four;
  opacity: number;
  size?: Size;
};
export type AssetView = {
  shape: 'asset';
  /** Project path (`./assets/x.svg`), token already followed. */
  asset?: string;
  currentColor?: string;
  opacity: number;
  size?: Size;
};
export type TextView = {
  color?: string;
  /** `font` is a source (`gfont:` or project path). */
  typography?: Typography;
  opacity: number;
  leftInset?: number;
};
export type PaintView = { color?: string; opacity: number };
export type ImageView = {
  asset?: string;
  currentColor?: string;
  opacity: number;
  size?: Size;
};
export type VariantView = {
  /** Path per catalog variant; undefined falls back to `builtin`. */
  assets: Record<string, string | undefined>;
  /** Compiler-owned artwork for omitted variants, by variant key. */
  builtin: Record<string, string>;
  currentColor?: string;
  opacity: number;
  /** Only where the catalog allows it (`news-item.gem`). */
  placement?: Placement;
  size?: Size;
};
export type WindowView = { fill?: string; borderColor: string };
export type FocusRingView = { color: string; width: number; offset: number };

export type ControlView = {
  entry: CatalogEntry;
  /** Full identity, e.g. `input.label`. */
  id: string;
  /** Only on a focus-ring owner in the focused state. */
  showRing?: boolean;
  parts: Record<string, ControlView>;
} & (
  | { kind: 'frame'; frame: PathView | AssetView }
  | { kind: 'text'; text: TextView }
  | { kind: 'paint'; paint: PaintView }
  | { kind: 'image'; image: ImageView }
  | { kind: 'variant-image'; variant: VariantView }
  | { kind: 'window'; window: WindowView }
  | { kind: 'focus-ring'; ring: FocusRingView }
  | { kind: 'composite' }
);

type Raw = Record<string, unknown>;
type Tokens = Document['tokens'];
type Colors = NonNullable<ProjectTokens['colors']>;

/** Compiler-owned artwork for omitted variants, by full catalog identity. */
export const BUILTIN: Record<string, Record<string, string>> = {
  'news-item.gem': NEWS_GEMS,
  'tab-bar.hint': MATERIAL_HINTS,
};

export const four = (v: unknown): Four =>
  typeof v === 'number'
    ? [v, v, v, v]
    : ((v as Four | undefined) ?? [0, 0, 0, 0]);

/** A typography value (`{typography.x}` or an object with `$extends`) flattened; undefined when unusable. */
export const resolveTypography = (
  tokens: Tokens,
  value: unknown,
): Typography | undefined => {
  if (value === undefined || value === null) return undefined;
  const fonts = resolver<string, string>(tokens.fonts ?? {}, evalAlias);
  const type = resolver<Typography, Typography>(
    (tokens.typography ?? {}) as Record<string, Typography>,
    (v, get) => evalTypography(v, get, fonts.get),
  );
  try {
    return evalTypography(value as never, type.get, fonts.get);
  } catch {
    // A broken `$extends` still leaves the object's own fields to render with.
    if (typeof value !== 'object') return undefined;
    const { $extends, ...own } = value as Raw;
    void $extends;
    return own as Typography;
  }
};

/** `{assets.x}` followed to its project path; a path passes through. */
export const resolveAsset = (tokens: Tokens, value: unknown) => {
  if (typeof value !== 'string') return undefined;
  try {
    return evalAlias(
      value,
      resolver<string, string>(tokens.assets ?? {}, evalAlias).get,
    );
  } catch {
    return undefined;
  }
};

/** Tab order: interaction states first, prop-driven states after. */
export const DISPLAY_ORDER: ControlState[] = [
  'hover',
  'pressed',
  'focused',
  'selected',
  'checked',
  'disabled',
];

/** Root states, plus every part's states, in display order. */
export const statesOf = (entry: CatalogEntry): ControlState[] => {
  const all = new Set<ControlState>(entry.states ?? []);
  for (const p of Object.values(entry.parts ?? {}))
    for (const s of statesOf(p)) all.add(s);
  return DISPLAY_ORDER.filter((s) => all.has(s));
};

const values = (colors: Colors) => {
  const color = (v: unknown) =>
    v === undefined ? undefined : (resolveColor(colors, v as never) ?? MAGENTA);
  return {
    color,
    paint: (v: unknown) =>
      v === undefined || v === 'none' ? 'none' : color(v)!,
  };
};

const node = (
  doc: Document,
  entry: CatalogEntry,
  raw: Raw,
  state: StateName,
  id: string,
): ControlView => {
  const { states, parts, ...base } = raw;
  const r = (
    state === 'default'
      ? base
      : merge(base, (states as Raw | undefined)?.[state] ?? {})
  ) as Raw;
  const v = values(doc.tokens.colors ?? {});
  const opacity = (r.opacity as number | undefined) ?? 1;
  const size = entry.size
    ? { ...entry.size, ...(r.size as Size | undefined) }
    : undefined;
  const common = {
    entry,
    id,
    showRing:
      state === 'focused' && entry.focusRingOwner
        ? ((r.showRing as boolean | undefined) ?? true)
        : undefined,
    parts: Object.fromEntries(
      Object.entries(entry.parts ?? {}).map(([name, part]) => [
        name,
        node(
          doc,
          part,
          ((parts as Raw | undefined)?.[name] as Raw | undefined) ?? {},
          state,
          `${id}.${name}`,
        ),
      ]),
    ),
  };
  switch (entry.kind) {
    case 'frame': {
      if (r.shape === 'asset')
        return {
          ...common,
          kind: 'frame',
          frame: {
            shape: 'asset',
            asset: resolveAsset(doc.tokens, r.asset),
            currentColor: v.color(r.currentColor),
            opacity,
            size,
          },
        };
      const border = (r.border as Raw | undefined) ?? {};
      return {
        ...common,
        kind: 'frame',
        frame: {
          shape: 'path',
          radius: (r.radius as number | 'pill' | undefined) ?? 0,
          corner: (r.corner as Corner | undefined) ?? 'round',
          fill: v.paint(r.fill),
          border: {
            color: v.paint(border.color),
            thickness: four(border.thickness),
          },
          padding: four(r.padding),
          opacity,
          size,
        },
      };
    }
    case 'text': {
      const text: TextView = {
        color: v.color(r.color),
        typography: resolveTypography(doc.tokens, r.typography),
        opacity,
      };
      if (entry.leftInset !== undefined)
        text.leftInset = (r.leftInset as number | undefined) ?? entry.leftInset;
      return { ...common, kind: 'text', text };
    }
    case 'paint':
      return {
        ...common,
        kind: 'paint',
        paint: { color: v.color(r.color), opacity },
      };
    case 'image':
      return {
        ...common,
        kind: 'image',
        image: {
          asset: resolveAsset(doc.tokens, r.asset),
          currentColor: v.color(r.currentColor),
          opacity,
          size,
        },
      };
    case 'variant-image': {
      const assets = (r.assets as Raw | undefined) ?? {};
      return {
        ...common,
        kind: 'variant-image',
        variant: {
          assets: Object.fromEntries(
            (entry.variants ?? []).map((k) => [
              k,
              resolveAsset(doc.tokens, assets[k]),
            ]),
          ),
          builtin: BUILTIN[id] ?? {},
          currentColor: v.color(r.currentColor),
          opacity,
          placement: entry.placement
            ? ((r.placement as Placement | undefined) ?? 'straddle')
            : undefined,
          size,
        },
      };
    }
    case 'window':
      return {
        ...common,
        kind: 'window',
        window: { fill: v.color(r.fill), borderColor: v.paint(r.borderColor) },
      };
    case 'focus-ring':
      return { ...common, kind: 'focus-ring', ring: ringOf(v, r) };
    case 'composite':
      return { ...common, kind: 'composite' };
  }
};

const ringOf = (v: ReturnType<typeof values>, r: Raw): FocusRingView => ({
  color: v.color(r.color) ?? MAGENTA,
  width: (r.width as number | undefined) ?? 2,
  offset: (r.offset as number | undefined) ?? -2,
});

/** `doc.controls[id]` (or `{}`) with `states[state]` merged at every node and catalog defaults applied. */
export const resolveView = (
  doc: Document,
  id: RootControlId,
  state: StateName,
): ControlView =>
  node(
    doc,
    CONTROL_CATALOG[id],
    (doc.controls[id] as Raw | undefined) ?? {},
    state,
    id,
  );

/** The theme's focus ring (defaults 2 / -2; magenta when the colour is missing). */
export const focusRingOf = (doc: Document): FocusRingView =>
  ringOf(
    values(doc.tokens.colors ?? {}),
    (doc.controls['focus-ring'] as Raw | undefined) ?? {},
  );
