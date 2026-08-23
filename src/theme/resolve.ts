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
  LiteralColor,
  Operand,
  PartState,
  PathControl,
  PathStateOverride,
  ResolvedType,
  ThemeFonts,
  ThemePalette,
  TextControl,
  TypeSpec,
  WindowControl,
} from './types';
import { CONTROL_IDS } from './types';

/**
 * The resolver: an authoring theme in, a compiled theme out. This is the one
 * step the eventual Skia engine cannot skip — it turns every indirection an
 * author writes (palette tokens, font roles, mix/alpha derivations, external
 * art) into the literal values the engine renders from. After this runs, no
 * `--theme-*` token, no font-role name, and no asset URL survives; a compiled
 * theme is self-contained.
 *
 * It is async because inlining art means fetching it. That's the price of a
 * self-contained bundle, and the right shape given themes ship with an
 * `updateUrl`. The colour maths (culori) run in the browser rather than a
 * build script, because the Studio re-resolves on every keystroke.
 */

const MAGENTA = '#ff00ff';

const isToken = (op: Operand): boolean =>
  op === 'none' || op.startsWith('--theme-');

/** A palette token → its literal, or magenta + a warning when the token names
 *  a role this theme's palette doesn't define (the honest failure the old
 *  substituteTokens used, kept for the same reason). */
function resolveToken(
  token: string,
  palette: ThemePalette,
  warnings: string[],
): LiteralColor {
  if (token === 'none') return 'transparent';
  const role = token.slice('--theme-'.length);
  const hex = palette[role];
  if (!hex) {
    warnings.push(`references undefined palette token --theme-${role}`);
    return MAGENTA;
  }
  return hex;
}

const resolveOperand = (
  op: Operand,
  palette: ThemePalette,
  warnings: string[],
): LiteralColor => (isToken(op) ? resolveToken(op, palette, warnings) : op);

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
  palette: ThemePalette,
  warnings: string[],
): LiteralColor {
  if (typeof cv === 'string') return resolveToken(cv, palette, warnings);
  if ('mix' in cv) {
    const [a, b] = cv.mix.map((op) => resolveOperand(op, palette, warnings));
    // culori spells sRGB 'rgb'; our authoring vocabulary says 'srgb'.
    const mode = cv.space === 'srgb' ? 'rgb' : 'oklab';
    return format(interpolate([a, b], mode)(cv.amount), warnings);
  }
  const base = parse(resolveOperand(cv.alpha, palette, warnings));
  return format(base ? { ...base, alpha: cv.value } : undefined, warnings);
}

function resolveType(
  spec: TypeSpec,
  fonts: ThemeFonts,
  warnings: string[],
): ResolvedType | undefined {
  const out: ResolvedType = {};
  if (spec.role) {
    const font = fonts[spec.role];
    if (!font) warnings.push(`references undefined font role "${spec.role}"`);
    else {
      out.family = font.family;
      out.fallback = font.fallback;
      out.weight = font.weight;
      out.style = font.style ?? 'normal';
    }
  }
  if (spec.size !== undefined) out.size = spec.size;
  if (spec.letterSpacing !== undefined) out.letterSpacing = spec.letterSpacing;
  if (spec.case !== undefined) out.case = spec.case;
  return Object.keys(out).length ? out : undefined;
}

function resolvePaint(
  p: PathStateOverride,
  palette: ThemePalette,
  warnings: string[],
): CompiledPaint {
  const paint: CompiledPaint = {};
  if (p.fill !== undefined) paint.fill = resolveColorValue(p.fill, palette, warnings);
  if (p.contentColor !== undefined)
    paint.content = resolveColorValue(p.contentColor, palette, warnings);
  if (p.borderColor !== undefined)
    paint.borderColor = resolveColorValue(p.borderColor, palette, warnings);
  if (p.borderThickness !== undefined) paint.borderThickness = p.borderThickness;
  if (p.opacity !== undefined) paint.opacity = p.opacity;
  return paint;
}

function assertVisibleFocusReplacement(
  state: string,
  override: Record<string, unknown>,
  visibleFields: readonly string[],
): void {
  if (state !== 'focused' || override.showRing !== false) return;
  if (visibleFields.some((field) => override[field] !== undefined)) return;
  throw new Error(
    'focused.showRing=false requires a visible focused-state override',
  );
}

/* ── Art: fetched once by URL, substituted per palette ───────────────── */

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

/** Swap every `var(--theme-*)` in an SVG for its literal. Pre-substitution is
 *  what keeps us honest for the Skia port, which has no CSS cascade — the art
 *  ships as a self-contained document. Unknown tokens warn and paint magenta,
 *  matching {@link resolveToken}. */
export function substituteTokens(
  svgText: string,
  palette: ThemePalette,
  warnings?: string[],
): string {
  return svgText.replace(/var\(--theme-([a-z0-9-]+)\)/g, (_, role: string) => {
    const hex = palette[role];
    if (!hex) {
      warnings?.push(`.9.svg references undefined token --theme-${role}`);
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
    return substituteTokens(await fetchRaw(url), theme.palette, warnings);
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
    return substituteTokens(await fetchRaw(url), theme.palette, warnings);
  } catch (err) {
    warnings.push(`image asset "${assetKey}" failed to load (${String(err)})`);
    return undefined;
  }
}

/* ── Controls ────────────────────────────────────────────────────────── */

async function resolvePathControl(
  control: PathControl,
  size: { width?: number; height?: number } | undefined,
  theme: AuthoringTheme,
  fonts: ThemeFonts,
  warnings: string[],
): Promise<CompiledPathControl> {
  const { palette } = theme;
  const out: CompiledPathControl = {
    shape: 'Path',
    ...resolvePaint(control, palette, warnings),
  };
  if (control.radius !== undefined) out.radius = control.radius;
  if (control.corner !== undefined) out.corner = control.corner;
  if (control.padding !== undefined) out.padding = control.padding;
  if (control.text) out.text = resolveType(control.text, fonts, warnings);
  if (size) out.size = size;
  if (control.image) out.image = await inlineImage(control.image, theme, warnings);
  if (control.states) {
    const states: NonNullable<CompiledPathControl['states']> = {};
    for (const [state, override] of Object.entries(control.states)) {
      const showRing =
        state === 'focused'
          ? (override as PathStateOverride & { showRing?: boolean }).showRing
          : undefined;
      assertVisibleFocusReplacement(state, override, [
        'fill',
        'borderColor',
        'contentColor',
        'borderThickness',
        'opacity',
        'image',
      ]);
      const paint: CompiledPaint & { showRing?: boolean } = resolvePaint(
        override,
        palette,
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
  control: AssetControl,
  size: { width?: number; height?: number } | undefined,
  theme: AuthoringTheme,
  fonts: ThemeFonts,
  warnings: string[],
): Promise<CompiledAssetControl> {
  const out: CompiledAssetControl = {
    shape: 'Asset',
    art: await inlineArt(control.asset, theme, warnings),
  };
  if (control.contentColor !== undefined)
    out.content = resolveColorValue(control.contentColor, theme.palette, warnings);
  if (control.opacity !== undefined) out.opacity = control.opacity;
  if (control.text) out.text = resolveType(control.text, fonts, warnings);
  if (size) out.size = size;
  if (control.states) {
    const states: NonNullable<CompiledAssetControl['states']> = {};
    for (const [state, override] of Object.entries(control.states)) {
      if (!override) continue;
      const showRing =
        state === 'focused'
          ? (override as { asset?: string; showRing?: boolean }).showRing
          : undefined;
      assertVisibleFocusReplacement(state, override, ['asset']);
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
  entry: TextControl & {
    leftInset?: number;
    borderColor?: ColorValue;
    images?: Record<string, string>;
  },
  theme: AuthoringTheme,
  fonts: ThemeFonts,
  warnings: string[],
): Promise<CompiledTextControl> {
  const { palette } = theme;
  const out: CompiledTextControl = { shape: 'Text' };
  if (entry.contentColor !== undefined)
    out.content = resolveColorValue(entry.contentColor, palette, warnings);
  if (entry.borderColor !== undefined)
    out.borderColor = resolveColorValue(entry.borderColor, palette, warnings);
  if (entry.text) out.text = resolveType(entry.text, fonts, warnings);
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
  palette: ThemePalette,
  warnings: string[],
): CompiledWindow {
  const out: CompiledWindow = { shape: 'Window' };
  if (control.fill !== undefined)
    out.fill = resolveColorValue(control.fill, palette, warnings);
  if (control.contentColor !== undefined)
    out.content = resolveColorValue(control.contentColor, palette, warnings);
  if (control.borderColor !== undefined)
    out.borderColor = resolveColorValue(control.borderColor, palette, warnings);
  return out;
}

function resolveFocusRing(
  theme: AuthoringTheme,
  warnings: string[],
): CompiledTheme['focusRing'] {
  const ring = theme.focusRing;
  const color = ring?.color
    ? resolveColorValue(ring.color, theme.palette, warnings)
    : resolveToken('--theme-accent', theme.palette, warnings);
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
): Promise<{ compiled: CompiledTheme; warnings: string[] }> {
  const warnings: string[] = [];
  const { fonts } = theme;

  const controls = {} as CompiledControls;
  await Promise.all(
    CONTROL_IDS.map(async (id: ControlId) => {
      const entry = theme.controls[id];
      let compiled: CompiledControl;
      if (entry === undefined) {
        // A custom theme stored before this control existed has no entry for
        // it. Compile it as an empty control rather than throwing: every var
        // it would emit is then simply absent, which is exactly the "unstyled"
        // the compiler resolves silence to everywhere else.
        warnings.push(`control "${id}" is missing from the theme; compiled unstyled`);
        compiled = { shape: 'Text' };
      } else if (id === 'window') {
        compiled = resolveWindow(entry as WindowControl, theme.palette, warnings);
      } else if ('shape' in entry && entry.shape === 'Asset') {
        compiled = await resolveAssetControl(
          entry,
          sizeOf(entry),
          theme,
          fonts,
          warnings,
        );
      } else if ('shape' in entry && entry.shape === 'Path') {
        compiled = await resolvePathControl(entry, sizeOf(entry), theme, fonts, warnings);
      } else {
        compiled = await resolveTextControl(entry, theme, fonts, warnings);
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
  return { compiled, warnings };
}
