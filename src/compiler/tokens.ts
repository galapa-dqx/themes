/**
 * Token graph resolution. Builds each category's complete graph before
 * evaluating, so forward references work and cycles report their chain.
 * Colors stay as float Culori values; `toHex` gamut-maps at the boundary.
 */
import {
  converter,
  formatHex,
  formatHex8,
  interpolateWith,
  parse,
  toGamut,
  type Color,
  type Mode,
} from 'culori';
import { Effect } from 'effect';
import type { Static } from 'typebox';
import type {
  ColorMix,
  ProjectColor,
  ProjectTokens,
  ProjectTypographyDisplay,
} from '@/theme/schema';
import { Diagnostics } from './diagnostics';

type Category = 'colors' | 'fonts' | 'typography' | 'assets';
type ProjectTypography = Static<typeof ProjectTypographyDisplay>;
/** A typography fragment with `$extends` applied and `font` resolved to a source descriptor. */
export type Typography = Omit<ProjectTypography, '$extends'>;

export class TokenError extends Error {
  /** JSON pointer relative to the value being evaluated. */
  readonly path: string;
  /** The token whose evaluation raised this, set by the graph resolver. */
  at?: string;
  constructor(message: string, path = '') {
    super(message);
    this.path = path;
  }
}

const REF =
  /^\{(colors|fonts|typography|assets)\.([a-z0-9]+(?:-[a-z0-9]+)*)\}$/;

/** The token name if `value` is an atomic reference into `category`. */
const ref = (value: unknown, category: Category, path = '') => {
  if (typeof value !== 'string') return undefined;
  const m = REF.exec(value);
  if (!m) return undefined;
  if (m[1] !== category) {
    throw new TokenError(
      `expected a ${category} reference, got ${value}`,
      path,
    );
  }
  return m[2];
};

// ---------------------------------------------------------------- evaluators

const premultiply = (v: number, ch: string, c: Color) =>
  ch === 'alpha' || ch === 'h' ? v : (v || 0) * (c.alpha ?? 1);
const unpremultiply = (v: number, ch: string, c: Color) =>
  ch === 'alpha' || ch === 'h' || c.alpha === 0 ? v : (v || 0) / (c.alpha ?? 1);
const mix = interpolateWith(premultiply, unpremultiply) as (
  colors: Color[],
  mode: Mode,
) => (t: number) => Color;
type Mix = Static<typeof ColorMix>;
const MODES: Record<Mix['space'], Mode> = {
  srgb: 'rgb',
  'srgb-linear': 'lrgb',
  lab: 'lab',
  lch: 'lch',
  oklab: 'oklab',
  oklch: 'oklch',
};

export const evalColor = (
  value: Static<typeof ProjectColor>,
  get: (name: string, path?: string) => Color,
  path = '',
): Color => {
  if (typeof value === 'string') {
    const name = ref(value, 'colors', path);
    if (name) return get(name, path);
    const color = parse(value);
    if (!color) throw new TokenError(`invalid color ${value}`, path);
    return color;
  }
  const m = value as Mix;
  const [a, b] = m.inputs.map((v, i) =>
    evalColor(v, get, `${path}/inputs/${i}`),
  );
  return mix([a, b], MODES[m.space])(m.amount);
};

const evalString = (
  value: string,
  category: 'fonts' | 'assets',
  get: (name: string, path?: string) => string,
  path = '',
) => {
  const name = ref(value, category, path);
  return name ? get(name, path) : value;
};

export const evalTypography = (
  value: string | ProjectTypography,
  get: (name: string, path?: string) => Typography,
  getFont: (name: string) => string,
  path = '',
): Typography => {
  let result: Typography;
  if (typeof value === 'string') {
    const name = ref(value, 'typography', path);
    if (!name) throw new TokenError('expected a typography reference', path);
    result = { ...get(name, path) };
  } else {
    const { $extends, ...own } = value;
    const name = ref($extends, 'typography', `${path}/$extends`);
    result = { ...(name ? get(name, `${path}/$extends`) : {}), ...own };
  }
  if (result.font) {
    result.font = evalString(result.font, 'fonts', getFont, `${path}/font`);
  }
  return result;
};

/** Gamut-maps to sRGB and formats as #rrggbb or #rrggbbaa. */
const clamp = toGamut('rgb', 'oklch');
const rgb = converter('rgb');
export const toHex = (color: Color) => {
  const c = rgb(clamp(color));
  return (c.alpha ?? 1) < 1 ? formatHex8(c) : formatHex(c);
};

// ---------------------------------------------------------------- graph

/** Resolves one category, memoizing results and reporting each failure once at its token. */
const resolveGraph = <In, Out>(
  category: Category,
  source: Record<string, In>,
  evaluate: (
    value: In,
    get: (name: string, path?: string) => Out,
    path: string,
  ) => Out,
) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    const done = new Map<string, Out>();
    const failed = new Set<string>();
    const stack: string[] = [];
    const get = (name: string, path = ''): Out => {
      if (done.has(name)) return done.get(name)!;
      if (failed.has(name)) {
        throw new TokenError(
          `depends on unresolved {${category}.${name}}`,
          path,
        );
      }
      if (stack.includes(name)) {
        const chain = [...stack.slice(stack.indexOf(name)), name];
        throw new TokenError(
          `reference cycle: ${chain.map((n) => `{${category}.${n}}`).join(' -> ')}`,
          path,
        );
      }
      if (!(name in source)) {
        throw new TokenError(`unknown token {${category}.${name}}`, path);
      }
      stack.push(name);
      try {
        const out = evaluate(source[name], get, '');
        done.set(name, out);
        return out;
      } catch (e) {
        failed.add(name);
        if (e instanceof TokenError) e.at ??= name;
        throw e;
      } finally {
        stack.pop();
      }
    };
    for (const name of Object.keys(source)) {
      if (done.has(name) || failed.has(name)) continue;
      try {
        get(name);
      } catch (e) {
        if (!(e instanceof TokenError)) throw e;
        yield* d.error('token', e.message, {
          file: 'tokens.json',
          path: `/${category}/${e.at ?? name}${e.path}`,
        });
      }
    }
    return get;
  });

export interface ResolvedTokens {
  /** Each evaluator throws `TokenError` for an unknown reference. */
  color(value: Static<typeof ProjectColor>): Color;
  font(value: string): string;
  asset(value: string): string;
  typography(value: string | ProjectTypography): Typography;
}

export const resolveTokens = (tokens: ProjectTokens) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    const colors = yield* resolveGraph(
      'colors',
      tokens.colors ?? {},
      evalColor,
    );
    const fonts = yield* resolveGraph<string, string>(
      'fonts',
      tokens.fonts ?? {},
      (v, get, p) => evalString(v, 'fonts', get, p),
    );
    const assets = yield* resolveGraph<string, string>(
      'assets',
      tokens.assets ?? {},
      (v, get, p) => evalString(v, 'assets', get, p),
    );
    const typography = yield* resolveGraph<ProjectTypography, Typography>(
      'typography',
      tokens.typography ?? {},
      (v, get, p) => evalTypography(v, get, fonts, p),
    );
    yield* d.checkpoint;
    return {
      color: (v) => evalColor(v, colors),
      font: (v) => evalString(v, 'fonts', fonts),
      asset: (v) => evalString(v, 'assets', assets),
      typography: (v) => evalTypography(v, typography, fonts),
    } satisfies ResolvedTokens;
  });
