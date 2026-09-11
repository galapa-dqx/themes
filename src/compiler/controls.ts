/**
 * Control resolution: the `theme.json` tree with every default materialized
 * and every authored state merged into a complete configuration, but with
 * values still at the typed-authoring level (Culori colors, font source
 * descriptors, project asset paths). Lowering turns those into package bytes.
 */
import type { Color } from 'culori';
import { Effect } from 'effect';
import type { Static } from 'typebox';
import {
  CONTROL_CATALOG,
  type CatalogEntry,
  type ControlKind,
} from '@/theme/catalog';
import type { CompiledTypographyDisplay, ProjectColor } from '@/theme/schema';
import { Diagnostics } from './diagnostics';
import { TokenError, type ResolvedTokens, type Typography } from './tokens';
import type { Project } from './project';

export type Paint = Color | 'none';
/** Where a part sits relative to its owner's box. */
export type Placement = 'straddle' | 'inside';
type Four = [number, number, number, number];
type Size = { width?: number; height?: number };
type CompiledTypography = Static<typeof CompiledTypographyDisplay>;
export type ResolvedTypography = Omit<
  CompiledTypography,
  'font' | 'textCase' | 'textDecoration'
> & {
  /** `gfont:` URI or project font path. */
  font: string;
  /** Compiled out by the font stage. */
  fontAxes: Record<string, number>;
  /** Display capability only; absent for editable text. */
  textCase?: CompiledTypography['textCase'];
  textDecoration?: CompiledTypography['textDecoration'];
};

export type ResolvedPathFrame = {
  shape: 'path';
  radius: number | 'pill';
  corner: 'round' | 'bevel' | 'scoop' | 'notch' | 'squircle';
  fill: Paint;
  border: { color: Paint; thickness: Four };
  padding: Four;
  opacity: number;
  size?: Size;
};
export type ResolvedAssetFrame = {
  shape: 'asset';
  asset: string;
  currentColor?: Color;
  opacity: number;
  size?: Size;
};
export type ResolvedText = {
  color: Color;
  typography: ResolvedTypography;
  opacity: number;
  leftInset?: number;
};
export type ResolvedPaint = { color: Color; opacity: number };
export type ResolvedImage = {
  asset?: string;
  currentColor?: Color;
  opacity: number;
  size?: Size;
};
export type ResolvedVariantImage = {
  /** Partial; lowering fills omitted variants with built-in artwork. */
  assets: Record<string, string>;
  currentColor?: Color;
  opacity: number;
  /** Only where the catalog allows it (`news-item.gem`). */
  placement?: Placement;
  size?: Size;
};
export type ResolvedWindow = { fill: Color; borderColor: Paint };
export type ResolvedFocusRing = { color: Color; width: number; offset: number };
export type ResolvedBase =
  | ResolvedPathFrame
  | ResolvedAssetFrame
  | ResolvedText
  | ResolvedPaint
  | ResolvedImage
  | ResolvedVariantImage
  | ResolvedWindow
  | ResolvedFocusRing;
/** Every base field, optional: which are present depends on the catalog kind. */
type AnyBase = Partial<
  Omit<ResolvedPathFrame, 'shape'> &
    Omit<ResolvedAssetFrame, 'shape'> &
    ResolvedText &
    ResolvedPaint &
    ResolvedImage &
    ResolvedVariantImage &
    Omit<ResolvedWindow, 'fill'> &
    ResolvedFocusRing
> & { shape?: 'path' | 'asset' };
export type ResolvedState = AnyBase & { showRing?: boolean };
export type ResolvedControl = AnyBase & {
  states?: Record<string, ResolvedState>;
  parts?: Record<string, ResolvedControl>;
};
export type ResolvedTheme = Record<string, ResolvedControl>;

type Raw = Record<string, unknown>;
const isPlain = (v: unknown): v is Raw =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

/** State fragment over base: plain objects merge, `$type`-tagged values, arrays, and scalars replace. */
export const merge = (base: unknown, over: unknown): unknown => {
  if (!isPlain(base) || !isPlain(over) || '$type' in over) return over;
  const out: Raw = { ...base };
  for (const [k, v] of Object.entries(over)) out[k] = merge(base[k], v);
  return out;
};

const four = (v: unknown, d = 0): Four =>
  typeof v === 'number'
    ? [v, v, v, v]
    : ((v as Four | undefined) ?? [d, d, d, d]);

class Fail extends Error {
  readonly path: string;
  constructor(path: string, message: string) {
    super(message);
    this.path = path;
  }
}
const fail = (path: string, message: string): never => {
  throw new Fail(path, message);
};

/** Runs a token evaluator, relocating any `TokenError` under `path`. */
const lookup = <T>(path: string, f: () => T): T => {
  try {
    return f();
  } catch (e) {
    if (e instanceof TokenError) return fail(path + e.path, e.message);
    throw e;
  }
};

/** Field resolvers over one token graph. */
const values = (tokens: ResolvedTokens) => {
  const color = (v: unknown, path: string) =>
    lookup(path, () => tokens.color(v as Static<typeof ProjectColor>));
  return {
    color,
    paint: (v: unknown, path: string): Paint =>
      v === 'none' || v === undefined ? 'none' : color(v, path),
    optColor: (v: unknown, path: string) =>
      v === undefined ? undefined : color(v, path),
    asset: (v: unknown, path: string) =>
      lookup(path, () => tokens.asset(v as string)),
    typography: (v: unknown, path: string) =>
      lookup(path, () => tokens.typography(v as string)),
  };
};
type Values = ReturnType<typeof values>;

/** Completes a typography fragment and checks it against the slot's capability set. */
const typography = (
  t: Typography,
  cap: CatalogEntry['typography'],
  path: string,
): ResolvedTypography => {
  for (const k of ['font', 'fontWeight', 'fontSize'] as const) {
    if (t[k] === undefined) fail(path, `typography is missing ${k}`);
  }
  const axes = t.fontAxes ?? {};
  if ('wght' in axes) {
    fail(`${path}/fontAxes/wght`, 'use fontWeight instead of the wght axis');
  }
  if (t.fontStyle !== undefined && ('ital' in axes || 'slnt' in axes)) {
    fail(`${path}/fontAxes`, 'fontStyle and ital/slnt axes both set');
  }
  const out: ResolvedTypography = {
    font: t.font!,
    fontWeight: t.fontWeight!,
    fontStyle: t.fontStyle ?? 'normal',
    fontAxes: axes,
    fontSize: t.fontSize!,
    lineHeight: t.lineHeight ?? 1,
    letterSpacing: t.letterSpacing ?? 0,
    fontFeatures: t.fontFeatures ?? {},
  };
  if (cap !== 'editable') {
    out.textCase = t.textCase ?? 'none';
    out.textDecoration = t.textDecoration ?? [];
  } else if ((t.textCase ?? 'none') !== 'none' || t.textDecoration?.length) {
    fail(path, 'editable text does not support textCase or textDecoration');
  }
  return out;
};

// ---------------------------------------------------------------- per-kind normalizers
// Each takes a raw base or merged state and returns one complete configuration.

type Normalizer = (
  v: Values,
  e: CatalogEntry,
  r: Raw,
  path: string,
) => ResolvedBase;
const opacity = (r: Raw) => (r.opacity as number | undefined) ?? 1;
const size = (r: Raw) => r.size as Size | undefined;

const frame: Normalizer = (v, _e, r, path) => {
  if (r.shape === 'asset') {
    return {
      shape: 'asset',
      asset: v.asset(r.asset, `${path}/asset`),
      currentColor: v.optColor(r.currentColor, `${path}/currentColor`),
      opacity: opacity(r),
      size: size(r),
    };
  }
  const border = (r.border as Raw | undefined) ?? {};
  return {
    shape: 'path',
    radius: (r.radius as number | 'pill' | undefined) ?? 0,
    corner: (r.corner as ResolvedPathFrame['corner']) ?? 'round',
    fill: v.paint(r.fill, `${path}/fill`),
    border: {
      color: v.paint(border.color, `${path}/border/color`),
      thickness: four(border.thickness),
    },
    padding: four(r.padding),
    opacity: opacity(r),
    size: size(r),
  };
};

const text: Normalizer = (v, e, r, path) => {
  const out: ResolvedText = {
    color: v.color(r.color, `${path}/color`),
    typography: typography(
      v.typography(r.typography, `${path}/typography`),
      e.typography,
      `${path}/typography`,
    ),
    opacity: opacity(r),
  };
  if (e.leftInset !== undefined) {
    out.leftInset = (r.leftInset as number | undefined) ?? e.leftInset;
  }
  return out;
};

const paint: Normalizer = (v, _e, r, path) => ({
  color: v.color(r.color, `${path}/color`),
  opacity: opacity(r),
});

const image: Normalizer = (v, _e, r, path) => ({
  asset: r.asset === undefined ? undefined : v.asset(r.asset, `${path}/asset`),
  currentColor: v.optColor(r.currentColor, `${path}/currentColor`),
  opacity: opacity(r),
  size: size(r),
});

const variantImage: Normalizer = (v, e, r, path) => {
  const out: ResolvedVariantImage = {
    assets: Object.fromEntries(
      Object.entries((r.assets as Raw | undefined) ?? {}).map(([k, a]) => [
        k,
        v.asset(a, `${path}/assets/${k}`),
      ]),
    ),
    currentColor: v.optColor(r.currentColor, `${path}/currentColor`),
    opacity: opacity(r),
    size: size(r),
  };
  if (e.placement) out.placement = (r.placement as Placement) ?? 'straddle';
  return out;
};

const windowControl: Normalizer = (v, _e, r, path) => ({
  fill: v.color(r.fill, `${path}/fill`),
  borderColor: v.paint(r.borderColor, `${path}/borderColor`),
});

const focusRing: Normalizer = (v, _e, r, path) => ({
  color: v.color(r.color, `${path}/color`),
  width: (r.width as number | undefined) ?? 2,
  offset: (r.offset as number | undefined) ?? -2,
});

const NORMALIZE: Record<Exclude<ControlKind, 'composite'>, Normalizer> = {
  frame,
  text,
  paint,
  image,
  'variant-image': variantImage,
  window: windowControl,
  'focus-ring': focusRing,
};

// ---------------------------------------------------------------- tree walk

type Problem = { file: string; path: string; message: string };

/** Runs `f`, recording a `Fail` as a problem instead of throwing. */
const attempt = <T>(
  problems: Problem[],
  file: string,
  f: () => T,
): T | undefined => {
  try {
    return f();
  } catch (e) {
    if (!(e instanceof Fail)) throw e;
    problems.push({ file, path: e.path, message: e.message });
    return undefined;
  }
};

/** Resolves one control and, recursively, its parts. */
const control = (
  v: Values,
  problems: Problem[],
  e: CatalogEntry,
  raw: Raw,
  file: string,
  path: string,
): ResolvedControl => {
  const { states, parts, ...rawBase } = raw;
  const out: ResolvedControl = {};
  if (e.kind !== 'composite') {
    const normalize = NORMALIZE[e.kind];
    const base = attempt(problems, file, () => normalize(v, e, rawBase, path));
    // A broken base would only repeat its errors once per state.
    if (base) Object.assign(out, base);
    if (base && states) {
      out.states = {};
      for (const [name, fragment] of Object.entries(states as Raw)) {
        const { showRing, ...rest } = fragment as Raw;
        const statePath = `${path}/states/${name}`;
        const merged = merge(rawBase, rest) as Raw;
        const state = attempt(problems, file, () =>
          normalize(v, e, merged, statePath),
        );
        if (!state) continue;
        out.states[name] =
          name === 'focused' && e.focusRingOwner
            ? { ...state, showRing: (showRing as boolean | undefined) ?? true }
            : state;
      }
    }
  }
  if (e.parts) {
    out.parts = {};
    for (const [name, part] of Object.entries(e.parts)) {
      const rawPart = (parts as Raw | undefined)?.[name] as Raw | undefined;
      if (!rawPart) continue; // required parts are checked by the schema
      out.parts[name] = control(
        v,
        problems,
        part,
        rawPart,
        file,
        `${path}/parts/${name}`,
      );
    }
  }
  return out;
};

export const resolveControls = (project: Project, tokens: ResolvedTokens) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    const v = values(tokens);
    const problems: Problem[] = [];
    const theme: ResolvedTheme = {};
    for (const [id, raw] of Object.entries(project.controls)) {
      const e = CONTROL_CATALOG[id as keyof typeof CONTROL_CATALOG];
      theme[id] = control(
        v,
        problems,
        e,
        raw as Raw,
        `controls/${id}.json`,
        '',
      );
    }
    for (const p of problems) {
      yield* d.error('control', p.message, { file: p.file, path: p.path });
    }
    yield* d.checkpoint;
    return theme;
  });
