/**
 * The theme file format — vocabulary only, no logic and no data.
 *
 * There are two shapes of theme, and the whole system is the arrow between
 * them:
 *
 *   AuthoringTheme  ──resolve()──▶  CompiledTheme  ──themeStyle()──▶  CSS vars
 *    palette tokens                  literal colours                  --g-<control>-*
 *    font roles                      literal fonts                    --app-focus-*
 *    mix / alpha derivations         inlined art
 *    asset URLs                      self-contained
 *
 * An *authoring* theme is what a designer writes and the Studio edits: it
 * names colours in an open palette, names fonts in open roles, and lets a
 * control derive a colour from a palette token (lighten/darken/tint/fade).
 * A *compiled* theme is what the engine renders: every indirection is gone —
 * no palette, no font roles, no derivations, no external art. Every control
 * carries literal values, so the renderer performs zero lookups. That's the
 * whole point: the eventual Avalonia/Skia engine has no CSS cascade and no
 * palette to consult, so resolution happens once, ahead of it.
 *
 * The compiled format is the contract with that engine; the authoring format
 * is the contract with the Studio and with custom-theme storage. Both stay
 * JSON-serialisable.
 */

/* ── Shared vocabulary ───────────────────────────────────────────────── */

/** A literal colour the engine can paint without resolving anything:
 *  '#b87228', 'transparent', 'rgba(0 0 0 / 0.5)'. */
export type LiteralColor = string;

/** A palette reference, resolved against the authoring theme's own palette.
 *  'none' is the explicit transparent, kept distinct from "unspecified". */
export type ThemeToken = `--theme-${string}` | 'none';

/** CSS order: [top, right, bottom, left]. */
export type Edges = [number, number, number, number];

/** The same order, named — for UI that edits an `Edges` tuple side by side. */
export const SIDES = ['top', 'right', 'bottom', 'left'] as const;
export type Side = (typeof SIDES)[number];

/** Corner vocabulary borrowed wholesale from CSS `corner-shape`. */
export type CornerShape = 'round' | 'bevel' | 'scoop' | 'notch' | 'squircle';

/** Text-transform (Figma's upper/lower "filter"). */
export type LabelCase = 'uppercase' | 'lowercase' | 'capitalize' | 'none';

export type PartState =
  | 'hover'
  | 'pressed'
  | 'focused'
  | 'disabled'
  | 'selected'
  | 'checked';

/* ── Authoring: colour derivations ───────────────────────────────────── */

/** An input to a derivation: a palette token, or a bare literal. Literals let
 *  a lighten/darken reach for white/black without inventing a palette role. */
export type Operand = ThemeToken | LiteralColor;

/**
 * A colour a control asks for, in authoring form. Either a palette token, or
 * one derivation over palette tokens — a closed, JSON-shaped operation set, so
 * it survives to the Skia port as data rather than as a string grammar to
 * re-parse. Deliberately one level deep, and deliberately palette-only (no
 * self- or cross-control reference): the resolver is a flat map with no
 * dependency graph and no cycle detection.
 *
 *  - `mix`: blend two operands by `amount` (0 = first, 1 = second). Default
 *    space is oklab — perceptual, which is what `filter: brightness()` was
 *    reaching for and getting muddily wrong in sRGB.
 *  - `alpha`: make one operand translucent to `value` (0..1). Distinct from a
 *    control's `opacity`, which dims the whole composited control.
 */
export type ColorValue =
  | ThemeToken
  | { mix: [Operand, Operand]; amount: number; space?: 'oklab' | 'srgb' }
  | { alpha: Operand; value: number };

/* ── Authoring: fonts ────────────────────────────────────────────────── */

/** One font role: family plus the weight/style "filter" the theme applies. */
export type ThemeFont = {
  family: string;
  fallback: 'serif' | 'sans-serif';
  weight: number;
  style?: 'italic';
};

/** Open set of named font roles (convention: heading / body / strong). A
 *  control's `text.role` names one; nothing outside authoring reads these. */
export type ThemeFonts = Record<string, ThemeFont>;

/** Type a control asks for, in authoring form: a font role plus optional size
 *  and case overrides. Resolves to a {@link ResolvedType} with the role's
 *  family/weight/style inlined. */
export type TypeSpec = {
  /** Key into `theme.fonts`; omitted leaves the app's static type floor. */
  role?: string;
  /** Size in logical px; omitted leaves the app's `--text-*` floor. */
  size?: number;
  /** Additional tracking in logical px. */
  letterSpacing?: number;
  case?: LabelCase;
};

/* ── Authoring: controls ─────────────────────────────────────────────── */

export type PathStateOverride = {
  fill?: ColorValue;
  borderColor?: ColorValue;
  contentColor?: ColorValue;
  borderThickness?: number | Edges;
  /** Dims the whole composited control (children and slice art included) —
   *  the mechanism the deleted `opacity: 0.5` disabled rules used. */
  opacity?: number;
  /** Swap the foreground mark for this state (e.g. a pip's selected art).
   *  Key into `theme.assets`; @see PathControl.image. */
  image?: string;
};

export type PathControl = {
  shape: 'Path';
  /** Corner radius in logical px; 'pill' = stadium at any size. @default 0 */
  radius?: number | 'pill';
  /** @default 'round' */
  corner?: CornerShape;
  /** @default 'none' (transparent) */
  fill?: ColorValue;
  /** @default 'none' (transparent) */
  borderColor?: ColorValue;
  /** Uniform or per-edge stroke width. Drawn on the frame layer, which is out
   *  of flow, so a state that thickens it never shifts content. @default 0 */
  borderThickness?: number | Edges;
  /** Content insets — the Path spelling of the `.9.svg`'s <rect id="content">.
   *  Omit to leave the host's own padding alone. */
  padding?: number | Edges;
  /** Text/icon colour inside the part. @default inherit */
  contentColor?: ColorValue;
  /** @default 1 */
  opacity?: number;
  /** Type of the control's own text. @default the app's static type floor. */
  text?: TypeSpec;
  /** A foreground mark drawn inside the control — an icon, ornament or glyph,
   *  distinct from an Asset's nine-slice *surface*. Key into `theme.assets`;
   *  the SVG is inlined and token-substituted, then tinted by `currentColor`
   *  (so it follows the content colour and its states). Where a control leaves
   *  this silent, the app draws its own default glyph (the "icon floor"). */
  image?: string;
  states?: Partial<Record<PartState, PathStateOverride>>;
};

export type AssetControl = {
  shape: 'Asset';
  /** Key into `theme.assets`; the `.9.svg` carries all remaining semantics —
   *  including the content insets, which come from its content rect. */
  asset: string;
  /** Text/icon colour inside the part — the one thing the art can't carry,
   *  since the slices never see the hosted content. @default inherit */
  contentColor?: ColorValue;
  /** @default 1 */
  opacity?: number;
  text?: TypeSpec;
  /** Per-state art: a whole second `.9.svg` that crossfades over the base. */
  states?: Partial<Record<PartState, { asset?: string }>>;
};

export type Control = PathControl | AssetControl;

/** A text-only control: no frame, just a colour and optional type. */
export type TextControl = { contentColor?: ColorValue; text?: TypeSpec };

/** The window is special: it frames the whole app and maps to a native window,
 *  which has no corners, states or nine-slice art to give — only its surface
 *  fill, the text colour it establishes, and the border that wraps everything.
 *  So it gets exactly those three, and nothing that would silently do nothing. */
export type WindowControl = {
  fill?: ColorValue;
  contentColor?: ColorValue;
  borderColor?: ColorValue;
};

/* Size mix-ins. A control that is fixed in an axis carries an optional metric
 * for it; the theme supplies the number where today's hardcoded px was the
 * intended design, and the component reads it as `--g-<id>-w` / `-h`. */
type FixedSize = { size?: { width: number; height: number } };
type FixedHeight = { size?: { height: number } };
type FixedWidth = { size?: { width: number } };
/** How far from the frame's left corner a seated label starts. */
type LeftInset = { leftInset?: number };

/**
 * The surfaces the app renders, each typed by what it actually is — a Path/
 * Asset control, a text-only control, and whether it is fixed-size. This map
 * is the single source of truth for the control vocabulary: a theme can't
 * invent a surface the app doesn't draw, and TypeScript enumerates exactly
 * what each theme is missing.
 */
export type ThemeControls = {
  /* the app frame — a special control (@see WindowControl), rendered directly
     by AppShell + the OS window frame, not via <Themed> */
  window: WindowControl;

  /* fluid — sized by content and padding */
  panel: Control;
  button: Control;
  input: Control;
  tab: Control;
  carousel: Control;

  /* fixed in both axes */
  pip: Control & FixedSize;
  'switch.track': Control & FixedSize;
  'switch.thumb': Control & FixedSize;
  'carousel.nav': Control & FixedSize;
  'titlebar.caption': Control & FixedSize;
  'titlebar.close': Control & FixedSize;

  /* fixed height, fluid width */
  'news-item': Control & FixedHeight;
  'setting-row': Control & FixedHeight;
  titlebar: Control & FixedHeight;
  subtabs: Control & FixedHeight;

  /* fixed width, fluid height */
  'scrollbar.track': Control & FixedWidth;
  'scrollbar.thumb': Control & FixedWidth;

  /* the progress bar: a fixed-height trough, and the fill inside it. The fill
     is fluid in both axes on purpose — its width is the value, and its height
     is whatever the trough's own padding leaves, the same inset the switch's
     track holds its thumb at.

     One wrinkle where the trough is chamfered (`corner: 'bevel'`): padding is
     measured along the axis, but the eye reads the gap *perpendicular* to the
     edge, and across a 45° end that is only 1/√2 of the number — an even 2 all
     round renders as 2 on the flats and 1.41 at the points. A bevelled theme
     therefore scales its left/right padding by √2, which is why the built-ins
     spell a 2px inset as [2, 2.83, 2, 2.83]. Round corners need no correction:
     concentric arcs are already an even distance apart. */
  'progress.track': Control & FixedHeight;
  'progress.indicator': Control;

  /* pure art — a themeable mark with an app-drawn default */
  'play-ornament': Control & FixedSize; // flanks the Play button (default: Flourish)

  /* text controls */
  'input.label': TextControl & LeftInset; // seated in the input's top stroke
  'news-item.date': TextControl;
  /** stroke colour (fill stays the app-owned --cat-*), plus optional per-
   *  category art: a category name → asset key. A category left unset falls
   *  back to the app's CategoryShape. */
  'news-item.gem': { borderColor?: ColorValue; images?: Record<string, string> };
  'titlebar.wordmark': TextControl;
  'tab-bar': TextControl;
  'settings.heading': TextControl;
  'setting-help.title': TextControl;
  'setting-help.body': TextControl;
  'input.placeholder': TextControl;
  'input.caret': TextControl;
  'play-row': TextControl;
};

export type ControlId = keyof ThemeControls;

/**
 * A runtime list of every control id, for UI that has to enumerate them (the
 * Studio's picker) — `keyof` gives no runtime value. The two assertions keep
 * it honest in both directions: `satisfies` rejects an id that isn't a
 * control, and the completeness check below rejects a control left out.
 */
export const CONTROL_IDS = [
  'window',
  'panel',
  'button',
  'input',
  'tab',
  'carousel',
  'pip',
  'switch.track',
  'switch.thumb',
  'carousel.nav',
  'titlebar.caption',
  'titlebar.close',
  'news-item',
  'setting-row',
  'titlebar',
  'subtabs',
  'scrollbar.track',
  'scrollbar.thumb',
  'progress.track',
  'progress.indicator',
  'play-ornament',
  'input.label',
  'news-item.date',
  'news-item.gem',
  'titlebar.wordmark',
  'tab-bar',
  'settings.heading',
  'setting-help.title',
  'setting-help.body',
  'input.placeholder',
  'input.caret',
  'play-row',
] as const satisfies readonly ControlId[];

// Fails to compile if a control id is missing from CONTROL_IDS above.
type _MissingControlId = Exclude<ControlId, (typeof CONTROL_IDS)[number]>;
const _assertComplete: _MissingControlId extends never ? true : never = true;
void _assertComplete;

/* ── Authoring: theme ────────────────────────────────────────────────── */

/** Open palette: role name → literal colour. The nine built-in roles (bg,
 *  surface, surface-2, border, text, muted, accent, success, danger) are
 *  convention, not schema — a fork adds, removes or renames freely. */
export type ThemePalette = Record<string, LiteralColor>;

export type ThemeMode = 'light' | 'dark';

/** Release/bundling metadata — everything a theme needs beyond its looks. */
export type ThemeMeta = {
  description?: string;
  maintainer?: string;
  version?: string;
  /** Where bundled releases check for updates. */
  updateUrl?: string;
  /** Preview image (data URL or path). */
  previewImage?: string;
};

/** The focus indicator. It is the one thing the app draws that no theme need
 *  declare: `undefined` gives the default accent ring; an object overrides it;
 *  `null` opts out entirely. */
export type FocusRing = {
  color?: ColorValue;
  width?: number;
  offset?: number;
};

export type AuthoringTheme = {
  label: string;
  meta?: ThemeMeta;
  mode: ThemeMode;
  palette: ThemePalette;
  fonts: ThemeFonts;
  /** @see FocusRing — undefined = default ring, null = no ring. */
  focusRing?: FocusRing | null;
  /** Asset key → URL. Referenced by controls (nine-slice `Asset` surfaces, or
   *  plain-image `image`/`images` marks). */
  assets?: Record<string, string>;
  /** The theme's component designs — every control it wants to render. */
  controls: ThemeControls;
};

/* ── Compiled: the engine's view ─────────────────────────────────────── */

/** Type with the font role inlined — family/fallback/weight/style are now
 *  literal, the way the engine needs them. All optional: a control may
 *  override only `case` or `size` and leave the rest at the app's type floor,
 *  in which case the family group is simply absent. */
export type ResolvedType = {
  family?: string;
  fallback?: string;
  weight?: number;
  style?: string;
  size?: number;
  letterSpacing?: number;
  case?: LabelCase;
};

/** Paint, fully resolved. Every colour is a literal; absence means the
 *  compiler will fill the unstyled default (transparent / inherit / 0 / 1). */
export type CompiledPaint = {
  fill?: LiteralColor;
  content?: LiteralColor | 'inherit';
  borderColor?: LiteralColor;
  borderThickness?: number | Edges;
  opacity?: number;
  /** The foreground mark, inlined and token-substituted (base or per-state).
   *  Read by <ThemedArt>, not compiled to a CSS var. */
  image?: string;
};

type CompiledSize = { width?: number; height?: number };

export type CompiledPathControl = CompiledPaint & {
  shape: 'Path';
  radius?: number | 'pill';
  corner?: CornerShape;
  padding?: number | Edges;
  text?: ResolvedType;
  size?: CompiledSize;
  states?: Partial<Record<PartState, CompiledPaint>>;
};

export type CompiledAssetControl = {
  shape: 'Asset';
  /** The `.9.svg` text, fetched and token-substituted — self-contained. */
  art: string;
  content?: LiteralColor | 'inherit';
  opacity?: number;
  text?: ResolvedType;
  size?: CompiledSize;
  states?: Partial<Record<PartState, { art: string }>>;
};

export type CompiledTextControl = {
  shape: 'Text';
  content?: LiteralColor | 'inherit';
  borderColor?: LiteralColor;
  text?: ResolvedType;
  leftInset?: number;
  /** Per-variant foreground art, inlined and token-substituted (the news gem's
   *  category → SVG map). Read by <ThemedArt>. */
  images?: Record<string, string>;
};

/** The window, resolved. Its literals become `--g-window-fill/-content/-bc`,
 *  read by AppShell and the OS window frame. */
export type CompiledWindow = {
  shape: 'Window';
  fill?: LiteralColor;
  content?: LiteralColor | 'inherit';
  borderColor?: LiteralColor;
};

export type CompiledControl =
  | CompiledPathControl
  | CompiledAssetControl
  | CompiledTextControl
  | CompiledWindow;

export type CompiledControls = Record<ControlId, CompiledControl>;

export type CompiledTheme = {
  label: string;
  meta?: ThemeMeta;
  mode: ThemeMode;
  /** Resolved focus indicator, or `null` when the theme opts out. */
  focusRing: { color: LiteralColor; width: number; offset: number } | null;
  controls: CompiledControls;
};
