/**
 * The theme file format — vocabulary only, no logic and no data.
 *
 * There are two shapes of theme, and the whole system is the arrow between
 * them:
 *
 *   AuthoringTheme  ──resolve()──▶  CompiledTheme  ──themeStyle()──▶  CSS vars
 *    tokens.colors                   literal colours                  --g-<control>-*
 *    tokens.text                     literal fonts                    --app-focus-*
 *    mix / alpha derivations         inlined art
 *    asset URLs                      self-contained
 *
 * An *authoring* theme is what a designer writes and the Studio edits: it
 * declares a single `tokens` surface with two namespaces — `colors` (literal
 * colour by name) and `text` (complete text style by name) — and lets a
 * control refer to one, cherry-pick one field of one, or spell literals
 * inline. Colours support one level of derivation (`mix` / `alpha`); text has
 * none. A *compiled* theme is what the engine renders: every indirection is
 * gone — no tokens, no derivations, no external art. Every control carries
 * literal values, so the renderer performs zero lookups. That's the whole
 * point: the eventual Avalonia/Skia engine has no CSS cascade and no token
 * table to consult, so resolution happens once, ahead of it.
 *
 * The compiled format is the contract with that engine; the authoring format
 * is the contract with the Studio and with custom-theme storage. Both stay
 * JSON-serialisable.
 */

/* ── Shared vocabulary ───────────────────────────────────────────────── */

/** A literal colour the engine can paint without resolving anything:
 *  '#b87228', 'transparent', 'rgba(0 0 0 / 0.5)'. */
export type LiteralColor = string;

/** A colour-token reference, resolved against `theme.tokens.colors`. 'none' is
 *  the explicit transparent, kept distinct from "unspecified". */
export type ColorTokenRef = `--color-${string}` | 'none';

/** A whole text-style reference — `--text-<name>` names an entry in
 *  `theme.tokens.text` and expands to all seven typography fields. */
export type TextTokenRef = `--text-${string}`;

/** The seven fields a text token carries; also the pieces a control can
 *  cherry-pick from one. */
export type TextField =
  | 'family'
  | 'fallback'
  | 'weight'
  | 'style'
  | 'size'
  | 'letterSpacing'
  | 'case';

/** A cherry-pick reference — `--text-<name>:<field>` names one field of one
 *  text token. The `:` selector avoids colliding with the dot in control ids
 *  (`switch.thumb`). */
export type TextPieceRef = `--text-${string}:${TextField}`;


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

/** An input to a derivation: a colour token, or a bare literal. Literals let
 *  a lighten/darken reach for white/black without inventing a token name. */
export type Operand = ColorTokenRef | LiteralColor;

/**
 * A colour a control asks for, in authoring form. Either a `tokens.colors`
 * reference, or one derivation over such references — a closed, JSON-shaped
 * operation set, so it survives to the Skia port as data rather than as a
 * string grammar to re-parse. Deliberately one level deep, and deliberately
 * token-only for the derivation inputs (no self- or cross-control reference):
 * the resolver is a flat map with no dependency graph and no cycle detection.
 *
 *  - `mix`: blend two operands by `amount` (0 = first, 1 = second). Default
 *    space is oklab — perceptual, which is what `filter: brightness()` was
 *    reaching for and getting muddily wrong in sRGB.
 *  - `alpha`: make one operand translucent to `value` (0..1). Distinct from a
 *    control's `opacity`, which dims the whole composited control.
 */
export type ColorValue =
  | ColorTokenRef
  | { mix: [Operand, Operand]; amount: number; space?: 'oklab' | 'srgb' }
  | { alpha: Operand; value: number };

/* ── Authoring: text styles ──────────────────────────────────────────── */

/** Type a control asks for, in authoring form. Three shapes are legal:
 *
 *  - A whole-token reference:            `text: '--text-heading'`
 *  - Whole-token plus inline overrides:  `text: { style: '--text-heading', size: 20 }`
 *  - Assembled from fields:              `text: { family: '--text-heading:family', size: 20, case: 'uppercase' }`
 *
 *  The `style` field, when set, names a complete text token from
 *  `theme.tokens.text` — the seven fields are inlined and any sibling fields
 *  override on top. Every other field is either a literal, or a piece
 *  reference (`--text-<name>:<field>`) that cherry-picks that one field from
 *  a text token. Roles are gone; there is only the token vocabulary.
 *
 *  After resolution every text-bearing control carries a complete
 *  {@link ResolvedType}, regardless of how the reference was assembled — see
 *  {@link TEXT_BEARING_CONTROLS} and the resolver's completeness check. */
export type TypeSpec =
  | TextTokenRef
  | {
      /** Start from this whole text token. Fields below override. */
      style?: TextTokenRef;
      family?: string | TextPieceRef;
      fallback?: 'serif' | 'sans-serif' | TextPieceRef;
      weight?: number | TextPieceRef;
      size?: number | TextPieceRef;
      letterSpacing?: number | TextPieceRef;
      case?: LabelCase | TextPieceRef;
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

/** Only the focused state may decide whether the app-owned focus ring is
 *  drawn. Keeping this inside `focused` makes suppressing the ring an explicit
 *  promise that the same state supplies another visible focus treatment. */
export type FocusedStateOverride<T extends object> = T & {
  showRing?: boolean;
};

export type ControlStates<T extends object> = {
  [State in PartState]?: State extends 'focused'
    ? FocusedStateOverride<T>
    : T;
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
  states?: ControlStates<PathStateOverride>;
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
  states?: ControlStates<{ asset?: string }>;
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
  /** The top-level window tabs (Launcher / Settings). Compiled separately from
   *  {@link ThemeControls.subtab} so the two rows are independently themeable
   *  — a font-size floor never falls back across them. */
  tab: Control;
  /** The Settings section tabs. Its own compiled control so runtimes never
   *  reach for a heading role or a --text-md floor to size it. */
  subtab: Control;
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
  'subtab',
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

/**
 * The controls that render their own text — the ones a compiled theme must
 * carry complete typography for. Everything else in the model either has no
 * text (a scrollbar thumb, a switch track), or is a text-adjacent leaf that
 * borrows its font from a parent control (an input placeholder inherits the
 * input's font; a play-row provides only colour). The resolver rejects a
 * theme whose text-bearing control lacks a family/weight/size after roles
 * and inline literals compose — see {@link ResolvedType}.
 */
export const TEXT_BEARING_CONTROLS = [
  'button',
  'input',
  'tab',
  'subtab',
  'news-item',
  'setting-row',
  'input.label',
  'news-item.date',
  'titlebar.wordmark',
  'settings.heading',
  'setting-help.title',
  'setting-help.body',
] as const satisfies readonly ControlId[];

export type TextBearingControlId = (typeof TEXT_BEARING_CONTROLS)[number];

/* ── Authoring: tokens ───────────────────────────────────────────────── */

/** A complete text style — the same seven fields the runtime materializes,
 *  chosen at authoring time and stored under a name in `theme.tokens.text`.
 *  A text token is complete on purpose: a control that references one gets
 *  literal typography with no extra fields required. Same shape as
 *  {@link ResolvedType}, and they resolve to it byte-for-byte on the whole-
 *  token reference path. */
export type TextStyle = {
  family: string;
  fallback: 'serif' | 'sans-serif';
  weight: number;
  style: 'normal' | 'italic';
  size: number;
  letterSpacing: number;
  case: LabelCase;
};

/** The unified authoring vocabulary. Two namespaces, both open — a fork adds,
 *  renames or removes freely, exactly as the old palette / fonts pair did. */
export type ThemeTokens = {
  /** Name → literal colour. The nine convention names (bg, surface, surface-2,
   *  border, text, muted, accent, success, danger) match the old palette. */
  colors: Record<string, LiteralColor>;
  /** Name → complete text style. Referenced as `--text-<name>` (whole) or
   *  `--text-<name>:<field>` (piece). */
  text: Record<string, TextStyle>;
};

export type ThemeMode = 'light' | 'dark';

/** Release/bundling metadata — everything a theme needs beyond its looks. */
export type ThemeMeta = {
  description?: string;
  maintainer?: string;
  /** Where bundled releases check for updates. */
  updateUrl?: string;
  /** Preview image (data URL or path). */
  previewImage?: string;
};

/** The app-owned focus indicator style. Omit it for the default accent ring or
 *  provide an object to restyle it. Individual controls may suppress it only
 *  from a focused state that supplies another visible focus treatment. */
export type FocusRing = {
  color?: ColorValue;
  width?: number;
  offset?: number;
};

export type AuthoringTheme = {
  label: string;
  meta?: ThemeMeta;
  mode: ThemeMode;
  /** The theme's authoring vocabulary: literal colours by name, complete text
   *  styles by name. Controls reference these; nothing outside authoring
   *  reads them. */
  tokens: ThemeTokens;
  /** @see FocusRing — undefined = default ring. */
  focusRing?: FocusRing;
  /** Asset key → URL. Referenced by controls (nine-slice `Asset` surfaces, or
   *  plain-image `image`/`images` marks). */
  assets?: Record<string, string>;
  /** The theme's component designs — every control it wants to render. */
  controls: ThemeControls;
};

/* ── Compiled: the engine's view ─────────────────────────────────────── */

/** Type after token references and inline literals have composed — every
 *  field is a literal the engine renders from directly. A text-bearing
 *  control (see {@link TEXT_BEARING_CONTROLS}) carries a complete
 *  `ResolvedType` after compilation, with no field allowed to fall back to an
 *  app-level floor. Same shape as {@link TextStyle}: a whole-token reference
 *  passes through byte-for-byte. */
export type ResolvedType = {
  family: string;
  fallback: string;
  weight: number;
  style: string;
  size: number;
  letterSpacing: number;
  case: LabelCase;
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

export type CompiledFocusedState<T extends object> = T & {
  showRing?: boolean;
};

export type CompiledControlStates<T extends object> = {
  [State in PartState]?: State extends 'focused'
    ? CompiledFocusedState<T>
    : T;
};

type CompiledSize = { width?: number; height?: number };

export type CompiledPathControl = CompiledPaint & {
  shape: 'Path';
  radius?: number | 'pill';
  corner?: CornerShape;
  padding?: number | Edges;
  text?: ResolvedType;
  size?: CompiledSize;
  states?: CompiledControlStates<CompiledPaint>;
};

export type CompiledAssetControl = {
  shape: 'Asset';
  /** The `.9.svg` text, fetched and token-substituted — self-contained. */
  art: string;
  content?: LiteralColor | 'inherit';
  opacity?: number;
  text?: ResolvedType;
  size?: CompiledSize;
  states?: CompiledControlStates<{ art?: string }>;
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
  /** Resolved app-owned focus indicator style. */
  focusRing: { color: LiteralColor; width: number; offset: number };
  controls: CompiledControls;
};
