/**
 * Per-token display values for the Tokens page. Unlike `resolveTokens`, which
 * fails the whole graph on the first error, this evaluates each token on its
 * own so a bad one shows its error while the rest render.
 */
import type { Color } from 'culori';
import {
  evalColor,
  evalTypography,
  toHex,
  TokenError,
  type Typography,
} from '@/compiler/tokens';
import type { Draft } from 'immer';
import type { RootControlId } from '@/theme/catalog';
import type { ProjectTokens } from '@/theme/schema';
import type { Document } from './projectStore';

type Result<R> =
  { value: R; error?: undefined } | { value?: undefined; error: string };

/** A memoizing, cycle-detecting getter over one token category. */
export const resolver = <V, R>(
  record: Record<string, V>,
  evaluate: (value: V, get: (name: string, path?: string) => R) => R,
) => {
  const cache = new Map<string, R | Error>();
  const stack = new Set<string>();
  const get = (name: string): R => {
    const hit = cache.get(name);
    if (hit !== undefined) {
      if (hit instanceof Error) throw hit;
      return hit;
    }
    if (!(name in record)) throw new TokenError(`unknown token ${name}`);
    if (stack.has(name)) {
      const chain = [...stack];
      chain.splice(0, chain.indexOf(name));
      throw new TokenError(`Cycle: ${[...chain, name].join(' → ')}`);
    }
    stack.add(name);
    try {
      const r = evaluate(record[name], get);
      cache.set(name, r);
      return r;
    } catch (e) {
      cache.set(name, e as Error);
      throw e;
    } finally {
      stack.delete(name);
    }
  };
  const safe = (name: string): Result<R> => {
    try {
      return { value: get(name) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  };
  return { get, safe };
};

const REF = /^\{(fonts|assets)\.([a-z0-9-]+)\}$/;
export const evalAlias = (value: string, get: (name: string) => string) => {
  const m = REF.exec(value);
  return m ? get(m[2]) : value;
};

export interface TokenRow<V, R> {
  readonly name: string;
  readonly value: V;
  readonly resolved: Result<R>;
  /** Exact `{category.name}` references across tokens and controls. */
  readonly used: number;
  /** Controls (by id) that reference the token anywhere in their file. */
  readonly usedBy: RootControlId[];
  /** Other tokens (as `category.name`) whose value references this token. */
  readonly usedByTokens: string[];
}

export interface TokenView {
  colors: TokenRow<NonNullable<ProjectTokens['colors']>[string], string>[];
  fonts: TokenRow<string, string>[];
  assets: TokenRow<string, string>[];
  typography: TokenRow<
    NonNullable<ProjectTokens['typography']>[string],
    Typography
  >[];
}

export const tokenView = (doc: Document): TokenView => {
  const { colors = {}, fonts = {}, assets = {}, typography = {} } = doc.tokens;
  // ponytail: substring counting over the serialized document; fine at this size.
  const text = JSON.stringify([doc.tokens, doc.controls]);
  const used = (category: string, name: string) =>
    text.split(`"{${category}.${name}}"`).length - 1;
  const controlText = Object.entries(doc.controls).map(
    ([id, c]) => [id as RootControlId, JSON.stringify(c)] as const,
  );
  const usedBy = (category: string, name: string) =>
    controlText
      .filter(([, t]) => t.includes(`"{${category}.${name}}"`))
      .map(([id]) => id);
  const tokenText = Object.entries(doc.tokens).flatMap(([cat, record]) =>
    Object.entries(record as Record<string, unknown>).map(
      ([n, v]) => [`${cat}.${n}`, JSON.stringify(v)] as const,
    ),
  );
  const usedByTokens = (category: string, name: string) =>
    tokenText
      .filter(([, t]) => t.includes(`"{${category}.${name}}"`))
      .map(([id]) => id);

  type ColorValue = NonNullable<ProjectTokens['colors']>[string];
  type TypeValue = NonNullable<ProjectTokens['typography']>[string];
  const color = resolver<ColorValue, Color>(colors, (v, get) =>
    evalColor(v, get),
  );
  const hex = {
    safe: (name: string): Result<string> => {
      const r = color.safe(name);
      return r.error !== undefined ? r : { value: toHex(r.value) };
    },
  };
  const font = resolver<string, string>(fonts, evalAlias);
  const asset = resolver<string, string>(assets, evalAlias);
  const type = resolver<TypeValue, Typography>(typography, (v, get) =>
    evalTypography(v, get, font.get),
  );
  const rows = <V, R>(
    category: string,
    record: Record<string, V>,
    r: { safe: (name: string) => Result<R> },
  ) =>
    Object.keys(record)
      .sort()
      .map((name) => ({
        name,
        value: record[name],
        resolved: r.safe(name),
        used: used(category, name),
        usedBy: usedBy(category, name),
        usedByTokens: usedByTokens(category, name),
      }));
  return {
    colors: rows('colors', colors, hex),
    fonts: rows('fonts', fonts, font),
    assets: rows('assets', assets, asset),
    typography: rows('typography', typography, type),
  };
};

/** Resolves one color value against `colors` to a hex string, or undefined on any error. */
export const resolveColor = (
  colors: NonNullable<ProjectTokens['colors']>,
  value: NonNullable<ProjectTokens['colors']>[string],
) => {
  const r = resolver<NonNullable<ProjectTokens['colors']>[string], Color>(
    colors,
    (v, get) => evalColor(v, get),
  );
  try {
    return toHex(evalColor(value, r.get));
  } catch {
    return undefined;
  }
};

/** SVG text with every `{colors.name}` paint replaced by its resolved hex, for display. */
export const bakeColors = (
  text: string,
  colors: NonNullable<ProjectTokens['colors']>,
) =>
  text.replace(
    /\{colors\.([a-z0-9-]+)\}/g,
    (m, n: string) => resolveColor(colors, `{colors.${n}}`) ?? m,
  );

/** Short label for a color value: `#E0114A`, `accent`, or `mix(a, b, 70%)`. */
export const describeColor = (
  v: NonNullable<ProjectTokens['colors']>[string],
): string =>
  typeof v === 'string'
    ? v.startsWith('{')
      ? v.slice(8, -1)
      : v.toUpperCase()
    : `mix(${describeColor(v.inputs[0])}, ${describeColor(v.inputs[1])}, ${Math.round(v.amount * 100)}%)`;

/** Human label for a font source: `gfont:Space+Grotesk` → Space Grotesk, a path → its file name. */
export const fontLabel = (source: string) =>
  source.startsWith('gfont:')
    ? decodeURIComponent(source.slice(6)).replaceAll('+', ' ')
    : source.replace(/^.*\//, '');

/** The lowest unused `prefix-N` name in `record`. */
export const freeName = (record: Record<string, unknown>, prefix: string) => {
  for (let i = 1; ; i++)
    if (!(`${prefix}-${i}` in record)) return `${prefix}-${i}`;
};

export type TokenCategory = keyof ProjectTokens & string;

/**
 * Rewrites every exact `{category.from}` reference across tokens and controls
 * to `{category.to}`, for use inside one `edit` recipe.
 */
export const replaceReferences = (
  doc: Draft<Document>,
  category: TokenCategory,
  from: string,
  to: string,
) => {
  const ref = `{${category}.${from}}`;
  const next = `{${category}.${to}}`;
  const walk = (o: Record<string, unknown>) => {
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (v === ref) o[k] = next;
      else if (v && typeof v === 'object') walk(v as Record<string, unknown>);
    }
  };
  walk(doc.tokens as Record<string, unknown>);
  walk(doc.controls as Record<string, unknown>);
};

/** Renames a token, moving its key and rewriting every reference to it. */
export const renameToken = (
  doc: Draft<Document>,
  category: TokenCategory,
  from: string,
  to: string,
) => {
  const record = doc.tokens[category] as Record<string, unknown> | undefined;
  if (!record || !(from in record) || from === to) return;
  replaceReferences(doc, category, from, to);
  record[to] = record[from];
  delete record[from];
};

export const TOKEN_NAME = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
