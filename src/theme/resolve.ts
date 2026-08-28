import { formatHex, formatRgb, interpolate, parse } from 'culori';
import type {
  AuthoringTheme,
  AssetControl,
  ColorValue,
  CompiledAssetControl,
  CompiledControl,
  CompiledControls,
  CompiledPaint,
  CompiledPathControl,
  CompiledTextControl,
  CompiledTheme,
  CompiledWindow,
  ControlId,
  LabelCase,
  LiteralColor,
  Operand,
  PartState,
  PathControl,
  PathStateOverride,
  ResolvedType,
  TextBearingControlId,
  TextField,
  TextStyle,
  ThemeTokens,
  TextControl,
  TypeSpec,
  WindowControl,
} from './types';
import { CONTROL_IDS, TEXT_BEARING_CONTROLS } from './types';

/**
 * The resolver: an authoring theme in, a compiled theme out. This is the one
 * step the eventual Skia engine cannot skip — it turns every indirection an
 * author writes (colour tokens, text-style tokens, mix/alpha derivations,
 * external art) into the literal values the engine renders from. After this
 * runs, no `--color-*` or `--text-*` token and no asset URL survives; a
 * compiled theme is self-contained.
 *
 * It is async because inlining art means fetching it. That's the price of a
 * self-contained bundle, and the right shape given themes ship with an
 * `updateUrl`. The colour maths (culori) run in the browser rather than a
 * build script, because the Studio re-resolves on every keystroke.
 */

const MAGENTA = '#ff00ff';

const TEXT_FIELDS: readonly TextField[] = [
  'family',
  'fallback',
  'weight',
  'style',
  'size',
  'letterSpacing',
  'case',
];

/* ── Shared token-reference primitive ────────────────────────────────── */

/** What one namespace looks like to {@link resolveTokenRef}: a name → value
 *  map, plus the `--<prefix>-` string the reference grammar uses. */
type TokenLookup<T> = {
  prefix: string;
  tokens: Record<string, T>;
};

const NAMESPACE = /^--([a-z]+)-([a-z0-9-]+)(?::([a-zA-Z]+))?$/;

/** Parse one reference string into (namespace, name, piece). Returns null for
 *  anything that doesn't match the `--<namespace>-<name>[:<field>]` grammar
 *  (a literal colour, a literal font family, etc.), so the caller can pass
 *  the value through unchanged. */
export function parseTokenRef(
  ref: string,
): { namespace: string; name: string; piece?: string } | null {
  const match = NAMESPACE.exec(ref);
  if (!match) return null;
  return { namespace: match[1], name: match[2], piece: match[3] };
}

/**
 * The shared "look up by name, or by name:piece, else pass a literal through"
 * primitive. Colour uses it via {@link resolveToken}; text uses it per field
 * via {@link resolveTextField}. Derivation ops (`mix`, `alpha`) stay in
 * colour-land — text has none — but the reference-shape logic lives here.
 *
 * Returns the token value (or one piece of it), or `undefined` on a token
 * this namespace doesn't define. The caller decides what an undefined
 * resolution means (magenta paint, a warning, a piece that falls through to
 * a compose peer, …).
 */
export function resolveTokenRef<T>(
  ref: string,
  lookup: TokenLookup<T>,
  warnings: string[],
): { value: T; piece?: string } | { missing: true; piece?: string } | null {
  const parsed = parseTokenRef(ref);
  if (!parsed || parsed.namespace !== lookup.prefix) return null;
  const value = lookup.tokens[parsed.name];
  if (value === undefined) {
    warnings.push(
      `references undefined ${lookup.prefix} token --${lookup.prefix}-${parsed.name}`,
    );
    return { missing: true, piece: parsed.piece };
  }
  return { value, piece: parsed.piece };
}

/* ── Colour resolution ───────────────────────────────────────────────── */

const isToken = (op: Operand): boolean =>
  op === 'none' || op.startsWith('--color-');

const colorLookup = (
  tokens: ThemeTokens,
): TokenLookup<LiteralColor> => ({ prefix: 'color', tokens: tokens.colors });

/** A colour-token ref → its literal, or magenta + a warning when the token
 *  names a role this theme's colours don't define (the honest failure the old
 *  substituteTokens used, kept for the same reason). */
function resolveToken(
  token: string,
  tokens: ThemeTokens,
  warnings: string[],
): LiteralColor {
  if (token === 'none') return 'transparent';
  const looked = resolveTokenRef(token, colorLookup(tokens), warnings);
  if (!looked) {
    // Not `--color-*` grammar — treat as a literal so mix/alpha operands can
    // reach for '#ffffff' inline.
    return token;
  }
  if ('missing' in looked) return MAGENTA;
  return looked.value;
}

const resolveOperand = (
  op: Operand,
  tokens: ThemeTokens,
  warnings: string[],
): LiteralColor => (isToken(op) ? resolveToken(op, tokens, warnings) : op);

/** A culori colour → a literal string: hex when opaque, rgb(… / a) when not,
 *  magenta when the colour didn't parse. */
function format(c: ReturnType<typeof parse>, warnings: string[]): LiteralColor {
  if (!c) {
    warnings.push('derivation produced an unparseable colour');
    return MAGENTA;
  }
  return c.alpha !== undefined && c.alpha < 1 ? formatRgb(c) : formatHex(c);
}

/** One authoring colour → one literal. Tokens resolve straight through; the
 *  two derivation ops resolve their operands first, then blend or fade. */
export function resolveColorValue(
  cv: ColorValue,
  tokens: ThemeTokens,
  warnings: string[],
): LiteralColor {
  if (typeof cv === 'string') return resolveToken(cv, tokens, warnings);
  if ('mix' in cv) {
    const [a, b] = cv.mix.map((op) => resolveOperand(op, tokens, warnings));
    // culori spells sRGB 'rgb'; our authoring vocabulary says 'srgb'.
    const mode = cv.space === 'srgb' ? 'rgb' : 'oklab';
    return format(interpolate([a, b], mode)(cv.amount), warnings);
  }
  const base = parse(resolveOperand(cv.alpha, tokens, warnings));
  return format(base ? { ...base, alpha: cv.value } : undefined, warnings);
}

/* ── Text resolution ─────────────────────────────────────────────────── */

const textLookup = (
  tokens: ThemeTokens,
): TokenLookup<TextStyle> => ({ prefix: 'text', tokens: tokens.text });

/** One text field's authoring value → its literal. `--text-<name>:<field>`
 *  cherry-picks; anything else is a literal already. A piece grammar without
 *  a matching text token warns and returns undefined (the field then falls
 *  through the compose layers, and the completeness check catches whatever
 *  the layers didn't fill). */
function resolveTextField<F extends TextField>(
  field: F,
  value: unknown,
  tokens: ThemeTokens,
  warnings: string[],
): TextStyle[F] | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') {
    const looked = resolveTokenRef(value, textLookup(tokens), warnings);
    if (looked) {
      if ('missing' in looked) return undefined;
      const piece = (looked.piece ?? field) as TextField;
      if (!TEXT_FIELDS.includes(piece)) {
        warnings.push(`text token reference "${value}" names an unknown field`);
        return undefined;
      }
      return looked.value[piece] as TextStyle[F];
    }
  }
  return value as TextStyle[F];
}

/** Compose a whole-token reference (from `spec.style`) with per-field
 *  overrides. Field values may themselves be piece refs, so each one runs
 *  through {@link resolveTextField}. A `TypeSpec` written as a bare string is
 *  the whole-token shorthand and never carries overrides.
 *
 *  The role/inline dance from before is gone: there's just one composition —
 *  a base (empty, or the whole text token) and a per-field override layer. */
function resolveType(
  spec: TypeSpec,
  tokens: ThemeTokens,
  warnings: string[],
): Partial<ResolvedType> {
  if (typeof spec === 'string') {
    const looked = resolveTokenRef(spec, textLookup(tokens), warnings);
    if (!looked) {
      warnings.push(`text reference "${spec}" is not a --text-* token`);
      return {};
    }
    if ('missing' in looked) return {};
    // A whole-token shorthand always names a whole token; a stray piece
    // suffix (`--text-heading:family`) as the shorthand is a mistake worth
    // hearing about, but we still resolve it to that one field.
    if (looked.piece) {
      warnings.push(
        `text shorthand "${spec}" cherry-picks one field — wrap it in { ${looked.piece}: '${spec}' } to be explicit`,
      );
      const piece = looked.piece as TextField;
      return TEXT_FIELDS.includes(piece)
        ? ({ [piece]: looked.value[piece] } as Partial<ResolvedType>)
        : {};
    }
    return { ...looked.value };
  }
  const out: Partial<ResolvedType> = {};
  if (spec.style !== undefined) {
    const looked = resolveTokenRef(spec.style, textLookup(tokens), warnings);
    if (!looked) {
      warnings.push(`style reference "${spec.style}" is not a --text-* token`);
    } else if (!('missing' in looked)) {
      if (looked.piece) {
        warnings.push(
          `style: "${spec.style}" cherry-picks one field — spell it on that field instead`,
        );
        const piece = looked.piece as TextField;
        if (TEXT_FIELDS.includes(piece)) {
          (out as Record<string, unknown>)[piece] = looked.value[piece];
        }
      } else {
        Object.assign(out, looked.value);
      }
    }
  }
  const setField = <F extends TextField>(field: F, value: unknown) => {
    const resolved = resolveTextField(field, value, tokens, warnings);
    if (resolved !== undefined) (out as Record<string, unknown>)[field] = resolved;
  };
  setField('family', spec.family);
  setField('fallback', spec.fallback);
  setField('weight', spec.weight);
  setField('size', spec.size);
  setField('letterSpacing', spec.letterSpacing);
  setField('case', spec.case);
  return out;
}

/** Finish a text-bearing control's type: check the required fields are all
 *  present (family, fallback, weight, size) and fill deterministic defaults
 *  for the optional ones (`style: 'normal'`, `letterSpacing: 0`,
 *  `case: 'none'`). A control that arrives incomplete is a hard compilation
 *  error — the compiled artefact must materialize exactly what the runtime
 *  will render, with no fallback to an app-level type floor. */
function completeType(
  id: TextBearingControlId,
  partial: Partial<ResolvedType>,
  errors: string[],
): ResolvedType {
  const missing: string[] = [];
  if (!partial.family) missing.push('family');
  if (!partial.fallback) missing.push('fallback');
  if (partial.weight === undefined) missing.push('weight');
  if (partial.size === undefined) missing.push('size');
  if (missing.length) {
    errors.push(
      `text-bearing control "${id}" is missing ${missing.join(', ')} — every text-bearing control must declare complete typography`,
    );
  }
  return {
    family: partial.family ?? '',
    fallback: partial.fallback ?? 'sans-serif',
    weight: partial.weight ?? 400,
    style: partial.style ?? 'normal',
    size: partial.size ?? 0,
    letterSpacing: partial.letterSpacing ?? 0,
    case: (partial.case as LabelCase | undefined) ?? 'none',
  };
}

const isTextBearing = (id: ControlId): id is TextBearingControlId =>
  (TEXT_BEARING_CONTROLS as readonly ControlId[]).includes(id);

/** The compiled type for one control, or undefined for a colour-only text
 *  control (input.placeholder, tab-bar, play-row, …). Text-bearing controls
 *  always come back complete or add an entry to `errors`. */
function typeFor(
  id: ControlId,
  spec: TypeSpec | undefined,
  tokens: ThemeTokens,
  warnings: string[],
  errors: string[],
): ResolvedType | undefined {
  const partial = spec ? resolveType(spec, tokens, warnings) : {};
  if (isTextBearing(id)) return completeType(id, partial, errors);
  return Object.keys(partial).length ? (partial as ResolvedType) : undefined;
}

function resolvePaint(
  p: PathStateOverride,
  tokens: ThemeTokens,
  warnings: string[],
): CompiledPaint {
  const paint: CompiledPaint = {};
  if (p.fill !== undefined) paint.fill = resolveColorValue(p.fill, tokens, warnings);
  if (p.contentColor !== undefined)
    paint.content = resolveColorValue(p.contentColor, tokens, warnings);
  if (p.borderColor !== undefined)
    paint.borderColor = resolveColorValue(p.borderColor, tokens, warnings);
  if (p.borderThickness !== undefined) paint.borderThickness = p.borderThickness;
  if (p.opacity !== undefined) paint.opacity = p.opacity;
  return paint;
}

/* ── Art: fetched once by URL, substituted per token set ─────────────── */

const rawCache = new Map<string, Promise<string>>();

function fetchRaw(url: string): Promise<string> {
  let pending = rawCache.get(url);
  if (!pending) {
    pending = fetch(url).then((res) => {
      if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
      return res.text();
    });
    pending.catch(() => rawCache.delete(url));
    rawCache.set(url, pending);
  }
  return pending;
}

/** Swap every `var(--color-*)` in an SVG for its literal. Pre-substitution is
 *  what keeps us honest for the Skia port, which has no CSS cascade — the art
 *  ships as a self-contained document. Unknown tokens warn and paint magenta,
 *  matching {@link resolveToken}. */
export function substituteTokens(
  svgText: string,
  tokens: ThemeTokens,
  warnings?: string[],
): string {
  return svgText.replace(/var\(--color-([a-z0-9-]+)\)/g, (_, name: string) => {
    const hex = tokens.colors[name];
    if (!hex) {
      warnings?.push(`.9.svg references undefined token --color-${name}`);
      return MAGENTA;
    }
    return hex;
  });
}

/** A minimal valid `.9.svg` that paints nothing — the graceful degradation
 *  when an asset can't be fetched, so one bad URL doesn't block the theme. */
const EMPTY_ART =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1" width="1" height="1"><svg id="0_0" x="0" y="0" width="1" height="1"/></svg>';

async function inlineArt(
  assetKey: string,
  theme: AuthoringTheme,
  warnings: string[],
): Promise<string> {
  const url = theme.assets?.[assetKey];
  if (!url) {
    warnings.push(`asset "${assetKey}" is not declared in theme.assets`);
    return EMPTY_ART;
  }
  try {
    return substituteTokens(await fetchRaw(url), theme.tokens, warnings);
  } catch (err) {
    warnings.push(`asset "${assetKey}" failed to load (${String(err)})`);
    return EMPTY_ART;
  }
}

/** A plain foreground image (icon/ornament/gem) → inlined, token-substituted
 *  SVG, or undefined on a missing/failed asset so the app's default glyph — the
 *  icon floor — shows instead. Unlike nine-slice art, a missing mark degrades
 *  to the default rather than to an empty frame. */
async function inlineImage(
  assetKey: string,
  theme: AuthoringTheme,
  warnings: string[],
): Promise<string | undefined> {
  const url = theme.assets?.[assetKey];
  if (!url) {
    warnings.push(`image asset "${assetKey}" is not declared in theme.assets`);
    return undefined;
  }
  try {
    return substituteTokens(await fetchRaw(url), theme.tokens, warnings);
  } catch (err) {
    warnings.push(`image asset "${assetKey}" failed to load (${String(err)})`);
    return undefined;
  }
}

/* ── Controls ────────────────────────────────────────────────────────── */

async function resolvePathControl(
  id: ControlId,
  control: PathControl,
  size: { width?: number; height?: number } | undefined,
  theme: AuthoringTheme,
  warnings: string[],
  errors: string[],
): Promise<CompiledPathControl> {
  const { tokens } = theme;
  const out: CompiledPathControl = {
    shape: 'Path',
    ...resolvePaint(control, tokens, warnings),
  };
  if (control.radius !== undefined) out.radius = control.radius;
  if (control.corner !== undefined) out.corner = control.corner;
  if (control.padding !== undefined) out.padding = control.padding;
  const type = typeFor(id, control.text, tokens, warnings, errors);
  if (type) out.text = type;
  if (size) out.size = size;
  if (control.image) out.image = await inlineImage(control.image, theme, warnings);
  if (control.states) {
    const states: NonNullable<CompiledPathControl['states']> = {};
    for (const [state, override] of Object.entries(control.states)) {
      const showRing =
        state === 'focused'
          ? (override as PathStateOverride & { showRing?: boolean }).showRing
          : undefined;
      const paint: CompiledPaint & { showRing?: boolean } = resolvePaint(
        override,
        tokens,
        warnings,
      );
      if (override.image)
        paint.image = await inlineImage(override.image, theme, warnings);
      if (showRing !== undefined) paint.showRing = showRing;
      (states as Partial<Record<PartState, typeof paint>>)[state as PartState] = paint;
    }
    out.states = states;
  }
  return out;
}

async function resolveAssetControl(
  id: ControlId,
  control: AssetControl,
  size: { width?: number; height?: number } | undefined,
  theme: AuthoringTheme,
  warnings: string[],
  errors: string[],
): Promise<CompiledAssetControl> {
  const { tokens } = theme;
  const out: CompiledAssetControl = {
    shape: 'Asset',
    art: await inlineArt(control.asset, theme, warnings),
  };
  if (control.contentColor !== undefined)
    out.content = resolveColorValue(control.contentColor, tokens, warnings);
  if (control.opacity !== undefined) out.opacity = control.opacity;
  const type = typeFor(id, control.text, tokens, warnings, errors);
  if (type) out.text = type;
  if (size) out.size = size;
  if (control.states) {
    const states: NonNullable<CompiledAssetControl['states']> = {};
    for (const [state, override] of Object.entries(control.states)) {
      if (!override) continue;
      const showRing =
        state === 'focused'
          ? (override as { asset?: string; showRing?: boolean }).showRing
          : undefined;
      const compiledState: { art?: string; showRing?: boolean } = {};
      if (override.asset)
        compiledState.art = await inlineArt(override.asset, theme, warnings);
      if (showRing !== undefined) compiledState.showRing = showRing;
      if (Object.keys(compiledState).length)
        (states as Partial<Record<PartState, typeof compiledState>>)[
          state as PartState
        ] = compiledState;
    }
    if (Object.keys(states).length) out.states = states;
  }
  return out;
}

async function resolveTextControl(
  id: ControlId,
  entry: TextControl & {
    leftInset?: number;
    borderColor?: ColorValue;
    images?: Record<string, string>;
  },
  theme: AuthoringTheme,
  warnings: string[],
  errors: string[],
): Promise<CompiledTextControl> {
  const { tokens } = theme;
  const out: CompiledTextControl = { shape: 'Text' };
  if (entry.contentColor !== undefined)
    out.content = resolveColorValue(entry.contentColor, tokens, warnings);
  if (entry.borderColor !== undefined)
    out.borderColor = resolveColorValue(entry.borderColor, tokens, warnings);
  const type = typeFor(id, entry.text, tokens, warnings, errors);
  if (type) out.text = type;
  if (entry.leftInset !== undefined) out.leftInset = entry.leftInset;
  if (entry.images) {
    const images: Record<string, string> = {};
    for (const [variant, key] of Object.entries(entry.images)) {
      const img = await inlineImage(key, theme, warnings);
      if (img) images[variant] = img;
    }
    if (Object.keys(images).length) out.images = images;
  }
  return out;
}

function resolveWindow(
  control: WindowControl,
  tokens: ThemeTokens,
  warnings: string[],
): CompiledWindow {
  const out: CompiledWindow = { shape: 'Window' };
  if (control.fill !== undefined)
    out.fill = resolveColorValue(control.fill, tokens, warnings);
  if (control.contentColor !== undefined)
    out.content = resolveColorValue(control.contentColor, tokens, warnings);
  if (control.borderColor !== undefined)
    out.borderColor = resolveColorValue(control.borderColor, tokens, warnings);
  return out;
}

function resolveFocusRing(
  theme: AuthoringTheme,
  warnings: string[],
): CompiledTheme['focusRing'] {
  const ring = theme.focusRing;
  const color = ring?.color
    ? resolveColorValue(ring.color, theme.tokens, warnings)
    : resolveToken('--color-accent', theme.tokens, warnings);
  return { color, width: ring?.width ?? 2, offset: ring?.offset ?? -2 };
}

/** Fixed-size controls carry a `size`; everything else in the map is fluid. */
function sizeOf(entry: unknown): { width?: number; height?: number } | undefined {
  return entry && typeof entry === 'object' && 'size' in entry
    ? (entry as { size?: { width?: number; height?: number } }).size
    : undefined;
}

export async function resolveTheme(
  theme: AuthoringTheme,
): Promise<{ compiled: CompiledTheme; warnings: string[]; errors: string[] }> {
  const warnings: string[] = [];
  const errors: string[] = [];

  const controls = {} as CompiledControls;
  await Promise.all(
    CONTROL_IDS.map(async (id: ControlId) => {
      const entry = theme.controls[id];
      let compiled: CompiledControl;
      if (entry === undefined) {
        // A custom theme stored before this control existed has no entry for
        // it. For a colour-only surface, compile it as an empty control so
        // its would-be vars are simply absent (the "unstyled" default). For a
        // text-bearing control, that would leave the runtime without complete
        // typography — surface it as an error alongside the missing-fields
        // ones from typeFor().
        if (isTextBearing(id)) {
          errors.push(
            `text-bearing control "${id}" is missing from the theme — every text-bearing control must declare complete typography`,
          );
        } else {
          warnings.push(`control "${id}" is missing from the theme; compiled unstyled`);
        }
        compiled = { shape: 'Text' };
      } else if (id === 'window') {
        compiled = resolveWindow(entry as WindowControl, theme.tokens, warnings);
      } else if ('shape' in entry && entry.shape === 'Asset') {
        compiled = await resolveAssetControl(
          id,
          entry,
          sizeOf(entry),
          theme,
          warnings,
          errors,
        );
      } else if ('shape' in entry && entry.shape === 'Path') {
        compiled = await resolvePathControl(
          id,
          entry,
          sizeOf(entry),
          theme,
          warnings,
          errors,
        );
      } else {
        compiled = await resolveTextControl(id, entry, theme, warnings, errors);
      }
      controls[id] = compiled;
    }),
  );

  const compiled: CompiledTheme = {
    label: theme.label,
    meta: theme.meta,
    mode: theme.mode,
    focusRing: resolveFocusRing(theme, warnings),
    controls,
  };

  for (const w of warnings) console.warn(`[theme] ${w}`);
  for (const e of errors) console.error(`[theme] ${e}`);
  return { compiled, warnings, errors };
}
