/**
 * Theme component geometry — the msstyles/CSS-inspired surface system.
 *
 * Two shapes cover everything. `Path` is a parameterised rounded rectangle;
 * `Asset` is a sliced `.9.svg` (see nineSlice.ts for the profile). Everything
 * intrinsic to art lives in the asset file (slice boxes, content rect,
 * per-slice repeat + preserveAspectRatio, root viewBox scale); the JSON side
 * only picks which surfaces a component wears, and when.
 *
 * Path parts compile to `--g-<part>-*` custom properties. Component CSS
 * consumes them with fallbacks equal to the pre-geometry look, so a missing
 * entry degrades to the app default by construction.
 *
 * Data in this module must stay JSON-serialisable — it is the prototype of
 * the theme file format the eventual Avalonia/Skia engine will load.
 */

/** Colour token, resolved against the theme palette (`--theme-x` → `--app-x`). */
export type ThemeToken = `--theme-${string}` | 'none';

/** CSS order: [top, right, bottom, left]. */
export type Edges = [number, number, number, number];

/** Corner vocabulary borrowed wholesale from CSS `corner-shape`. */
export type CornerShape = 'round' | 'bevel' | 'scoop' | 'notch' | 'squircle';

export type PartState =
  | 'hover'
  | 'pressed'
  | 'focused'
  | 'disabled'
  | 'selected'
  | 'checked';

export type PathStateOverride = {
  fill?: ThemeToken;
  borderColor?: ThemeToken;
  contentColor?: ThemeToken;
  borderThickness?: number | Edges;
};

type PartBase = {
  /** Property-lerp (Path) / crossfade (Asset) timing between states. */
  transition?: { duration: number; easing?: string };
};

export type PathPart = PartBase & {
  shape: 'Path';
  /** Corner radius in logical px; 'pill' = stadium at any size. @default 0 */
  radius?: number | 'pill';
  /** @default 'round' */
  corner?: CornerShape;
  fill?: ThemeToken;
  borderColor?: ThemeToken;
  /** Uniform or per-edge stroke width, drawn inside the layout box. */
  borderThickness?: number | Edges;
  /** Text/icon colour inside the part. */
  contentColor?: ThemeToken;
  states?: Partial<Record<PartState, PathStateOverride>>;
};

export type AssetPart = PartBase & {
  shape: 'Asset';
  /** Key into `theme.assets`; the `.9.svg` carries all remaining semantics. */
  asset: string;
  states?: Partial<Record<PartState, { asset?: string }>>;
};

export type Part = PathPart | AssetPart;

/** Part ids are open strings; dots namespace sub-parts ("switch.thumb"). */
export type ThemeGeometry = Record<string, Part>;

/**
 * App-default geometry: the shipped Figma look, expressed as parts. Themes
 * override per entry (whole-entry replacement — no deep merge, no chain).
 */
export const DEFAULT_GEOMETRY: ThemeGeometry = {
  panel: {
    shape: 'Path',
    fill: '--theme-surface',
    borderColor: '--theme-border',
    borderThickness: 1,
  },
  'news-item': {
    shape: 'Path',
    fill: '--theme-surface',
    borderColor: '--theme-border',
    borderThickness: 1,
    contentColor: '--theme-muted',
    states: { hover: { borderColor: '--theme-muted' } },
    transition: { duration: 120 },
  },
  'setting-row': {
    shape: 'Path',
    fill: '--theme-surface',
    borderColor: '--theme-border',
    borderThickness: 1,
    contentColor: '--theme-muted',
    states: {
      selected: { borderColor: '--theme-accent', contentColor: '--theme-accent' },
    },
    transition: { duration: 120 },
  },
  titlebar: {
    shape: 'Path',
    fill: '--theme-surface-2',
    borderColor: '--theme-border',
    borderThickness: [0, 0, 1, 0],
  },
  tab: {
    shape: 'Path',
    contentColor: '--theme-muted',
    borderColor: 'none',
    borderThickness: [0, 0, 2, 0],
    states: {
      hover: { contentColor: '--theme-accent' },
      selected: { contentColor: '--theme-accent', borderColor: '--theme-accent' },
    },
    transition: { duration: 120 },
  },
  button: {
    shape: 'Path',
    radius: 'pill',
    fill: '--theme-accent',
    contentColor: '--theme-surface',
    transition: { duration: 120 },
  },
  input: {
    shape: 'Path',
    borderColor: '--theme-border',
    contentColor: '--theme-text',
    borderThickness: 1,
    states: { focused: { borderColor: '--theme-accent', borderThickness: 2 } },
  },
  'switch.track': {
    shape: 'Path',
    radius: 'pill',
    fill: '--theme-surface-2',
  },
  'switch.thumb': {
    shape: 'Path',
    radius: 'pill',
    fill: '--theme-border',
    states: { checked: { fill: '--theme-accent' } },
    transition: { duration: 150 },
  },
  'scrollbar.track': { shape: 'Path', fill: '--theme-surface-2' },
  'scrollbar.thumb': { shape: 'Path', fill: '--theme-muted' },
  pip: {
    shape: 'Path',
    fill: 'none',
    borderColor: '--theme-border',
    borderThickness: 1,
    states: {
      selected: { fill: '--theme-accent', borderColor: '--theme-accent' },
    },
  },
  carousel: {
    shape: 'Path',
    borderColor: '--theme-border',
    borderThickness: 1,
  },
};

const KNOWN_COLOR_TOKENS = new Set([
  'bg',
  'surface',
  'surface-2',
  'border',
  'text',
  'muted',
  'accent',
  'success',
  'danger',
]);

function color(token: ThemeToken): string {
  if (token === 'none') return 'transparent';
  const role = token.slice('--theme-'.length);
  if (!KNOWN_COLOR_TOKENS.has(role)) {
    console.warn(`[theme] unknown colour token "${token}"`);
  }
  return `var(--app-${role})`;
}

const px = (n: number) => `${n}px`;

/** Merge app defaults with a theme's overrides (whole-entry replacement). */
export function resolveGeometry(overrides?: ThemeGeometry): ThemeGeometry {
  return overrides ? { ...DEFAULT_GEOMETRY, ...overrides } : DEFAULT_GEOMETRY;
}

/**
 * Compile Path parts to custom properties:
 *   --g-<part>-fill / -bc / -content    colours
 *   --g-<part>-bw (+ -bw-t/r/b/l)       border widths
 *   --g-<part>-radius / -corner         shape
 *   --g-<part>-t / -te                  transition
 * State overrides emit the same names suffixed `-<state>`.
 * Part ids have '.' flattened to '-'.
 */
export function compileGeometry(geometry: ThemeGeometry): Record<string, string> {
  const vars: Record<string, string> = {};

  const emitPath = (
    prefix: string,
    part: Pick<PathPart, keyof PathStateOverride> & Partial<PathPart>,
  ) => {
    if (part.fill !== undefined) vars[`${prefix}-fill`] = color(part.fill);
    if (part.borderColor !== undefined) vars[`${prefix}-bc`] = color(part.borderColor);
    if (part.contentColor !== undefined) vars[`${prefix}-content`] = color(part.contentColor);
    if (part.borderThickness !== undefined) {
      const bt = part.borderThickness;
      const edges: Edges = typeof bt === 'number' ? [bt, bt, bt, bt] : bt;
      vars[`${prefix}-bw`] = edges.map(px).join(' ');
      const [t, r, b, l] = edges;
      vars[`${prefix}-bw-t`] = px(t);
      vars[`${prefix}-bw-r`] = px(r);
      vars[`${prefix}-bw-b`] = px(b);
      vars[`${prefix}-bw-l`] = px(l);
    }
  };

  for (const [id, part] of Object.entries(geometry)) {
    if (part.shape !== 'Path') continue;
    const prefix = `--g-${id.replaceAll('.', '-')}`;
    emitPath(prefix, part);
    if (part.radius !== undefined) {
      vars[`${prefix}-radius`] = part.radius === 'pill' ? '999px' : px(part.radius);
    }
    if (part.corner !== undefined) vars[`${prefix}-corner`] = part.corner;
    if (part.transition) {
      vars[`${prefix}-t`] = `${part.transition.duration}ms`;
      vars[`${prefix}-te`] = part.transition.easing ?? 'ease';
    }
    for (const [state, override] of Object.entries(part.states ?? {})) {
      emitPath(`${prefix}-${state}`, override);
    }
  }
  return vars;
}
