/**
 * Control resolution: the `theme.json` tree with every default materialized
 * and every authored state merged into a complete configuration, but with
 * values still at the typed-authoring level (Culori colors, font source
 * descriptors, project asset paths). Lowering turns those into package bytes.
 */
import type { Color } from 'culori';
import { Effect } from 'effect';
import type { Static } from 'typebox';
import { CONTROL_CATALOG, type CatalogEntry } from '@/theme/catalog';
import type { CompiledTypographyDisplay, ProjectColor } from '@/theme/schema';
import { Diagnostics } from './diagnostics';
import { TokenError, type ResolvedTokens, type Typography } from './tokens';
import type { Project } from './project';

export type Paint = Color | 'none';
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

export const resolveControls = (project: Project, tokens: ResolvedTokens) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    const pending: { file: string; path: string; message: string }[] = [];
    const fail = (path: string, message: string): never => {
      throw new Fail(path, message);
    };

    const color = (v: unknown, path: string): Color => {
      try {
        return tokens.color(v as Static<typeof ProjectColor>);
      } catch (e) {
        if (e instanceof TokenError) return fail(path + e.path, e.message);
        throw e;
      }
    };
    const paint = (v: unknown, path: string): Paint =>
      v === 'none' || v === undefined ? 'none' : color(v, path);
    const optColor = (v: unknown, path: string) =>
      v === undefined ? undefined : color(v, path);
    const asset = (v: unknown, path: string): string => {
      try {
        return tokens.asset(v as string);
      } catch (e) {
        if (e instanceof TokenError) return fail(path + e.path, e.message);
        throw e;
      }
    };

    const typography = (
      v: unknown,
      cap: CatalogEntry['typography'],
      path: string,
    ): ResolvedTypography => {
      let t: Typography;
      try {
        t = tokens.typography(v as string);
      } catch (e) {
        if (e instanceof TokenError) return fail(path + e.path, e.message);
        throw e;
      }
      for (const k of ['font', 'fontWeight', 'fontSize'] as const) {
        if (t[k] === undefined) fail(path, `typography is missing ${k}`);
      }
      const axes = t.fontAxes ?? {};
      if ('wght' in axes) {
        fail(
          `${path}/fontAxes/wght`,
          'use fontWeight instead of the wght axis',
        );
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
      if (cap === 'editable') {
        if ((t.textCase ?? 'none') !== 'none' || t.textDecoration?.length) {
          fail(
            path,
            'editable text does not support textCase or textDecoration',
          );
        }
        return out;
      }
      return {
        ...out,
        textCase: t.textCase ?? 'none',
        textDecoration: t.textDecoration ?? [],
      };
    };

    /** One complete configuration from a raw base or merged state. */
    const normalize = (e: CatalogEntry, r: Raw, path: string): ResolvedBase => {
      const opacity = (r.opacity as number | undefined) ?? 1;
      const size = r.size as Size | undefined;
      switch (e.kind) {
        case 'frame': {
          if (r.shape === 'asset') {
            return {
              shape: 'asset',
              asset: asset(r.asset, `${path}/asset`),
              currentColor: optColor(r.currentColor, `${path}/currentColor`),
              opacity,
              size,
            };
          }
          const border = (r.border as Raw | undefined) ?? {};
          return {
            shape: 'path',
            radius: (r.radius as number | 'pill' | undefined) ?? 0,
            corner: (r.corner as ResolvedPathFrame['corner']) ?? 'round',
            fill: paint(r.fill, `${path}/fill`),
            border: {
              color: paint(border.color, `${path}/border/color`),
              thickness: four(border.thickness),
            },
            padding: four(r.padding),
            opacity,
            size,
          };
        }
        case 'text': {
          const out: ResolvedText = {
            color: color(r.color, `${path}/color`),
            typography: typography(
              r.typography,
              e.typography,
              `${path}/typography`,
            ),
            opacity,
          };
          if (e.leftInset !== undefined) {
            out.leftInset = (r.leftInset as number | undefined) ?? e.leftInset;
          }
          return out;
        }
        case 'paint':
          return { color: color(r.color, `${path}/color`), opacity };
        case 'image':
          return {
            asset:
              r.asset === undefined
                ? undefined
                : asset(r.asset, `${path}/asset`),
            currentColor: optColor(r.currentColor, `${path}/currentColor`),
            opacity,
            size,
          };
        case 'variant-image':
          return {
            assets: Object.fromEntries(
              Object.entries((r.assets as Raw | undefined) ?? {}).map(
                ([k, v]) => [k, asset(v, `${path}/assets/${k}`)],
              ),
            ),
            currentColor: optColor(r.currentColor, `${path}/currentColor`),
            opacity,
            size,
          };
        case 'window':
          return {
            fill: color(r.fill, `${path}/fill`),
            borderColor: paint(r.borderColor, `${path}/borderColor`),
          };
        case 'focus-ring':
          return {
            color: color(r.color, `${path}/color`),
            width: (r.width as number | undefined) ?? 2,
            offset: (r.offset as number | undefined) ?? -2,
          };
        case 'composite':
          return {} as never;
      }
    };

    const attempt = <T>(file: string, f: () => T): T | undefined => {
      try {
        return f();
      } catch (e) {
        if (!(e instanceof Fail)) throw e;
        pending.push({ file, path: e.path, message: e.message });
        return undefined;
      }
    };

    const control = (
      e: CatalogEntry,
      raw: Raw,
      file: string,
      path: string,
    ): ResolvedControl => {
      const { states, parts, ...rawBase } = raw;
      const out: ResolvedControl = {};
      if (e.kind !== 'composite') {
        const base = attempt(file, () => normalize(e, rawBase, path));
        if (base) {
          Object.assign(out, base);
          if (states) {
            out.states = {};
            for (const [name, fragment] of Object.entries(states as Raw)) {
              const { showRing, ...rest } = fragment as Raw;
              const statePath = `${path}/states/${name}`;
              const merged = merge(rawBase, rest) as Raw;
              const state = attempt(file, () =>
                normalize(e, merged, statePath),
              );
              if (!state) continue;
              out.states[name] =
                name === 'focused' && e.focusRingOwner
                  ? {
                      ...state,
                      showRing: (showRing as boolean | undefined) ?? true,
                    }
                  : state;
            }
          }
        }
      }
      if (e.parts) {
        out.parts = {};
        for (const [name, part] of Object.entries(e.parts)) {
          const rawPart = (parts as Raw | undefined)?.[name] as Raw | undefined;
          if (!rawPart) continue; // required parts are checked by the schema
          out.parts[name] = control(
            part,
            rawPart,
            file,
            `${path}/parts/${name}`,
          );
        }
      }
      return out;
    };

    const theme: ResolvedTheme = {};
    for (const [id, raw] of Object.entries(project.controls)) {
      const e = CONTROL_CATALOG[id as keyof typeof CONTROL_CATALOG];
      theme[id] = control(e, raw as Raw, `controls/${id}.json`, '');
    }
    for (const p of pending)
      yield* d.error('control', p.message, { file: p.file, path: p.path });
    yield* d.checkpoint;
    return theme;
  });
