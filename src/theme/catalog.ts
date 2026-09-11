/**
 * Version 1 control catalog: the runtime semantics that project and compiled
 * JSON never serialize (kind, requiredness, states, size axes and application
 * defaults, focus-ring ownership, typography capability, variant keys).
 * `schema.ts` derives every per-control schema from this table.
 */

export const STATE_PRIORITY = [
  'disabled',
  'checked',
  'selected',
  'pressed',
  'hover',
  'focused',
] as const;

export type ControlState = (typeof STATE_PRIORITY)[number];

export type ControlKind =
  | 'composite'
  | 'frame'
  | 'image'
  | 'variant-image'
  | 'paint'
  | 'text'
  | 'window'
  | 'focus-ring';

export type CatalogEntry = {
  kind: ControlKind;
  required: boolean;
  states?: readonly ControlState[];
  focusRingOwner?: true;
  /** Permitted size axes with the application's non-serialized default DIPs. */
  size?: { width?: number; height?: number };
  /** TextControl only. */
  typography?: 'display' | 'editable';
  /** TextControl only: permitted `leftInset` with its project default. */
  leftInset?: number;
  /** ImageControl only: `asset` may be omitted (nothing is rendered). */
  assetOptional?: true;
  /** VariantImageControl only: closed variant keys, all optional in a project. */
  variants?: readonly string[];
  /** VariantImageControl only: the part may straddle its owner's left edge or sit inside it. */
  placement?: true;
  parts?: Readonly<Record<string, CatalogEntry>>;
};

const S = {
  button: ['hover', 'pressed', 'focused', 'disabled'],
  input: ['focused', 'disabled'],
  tab: ['hover', 'focused', 'selected'],
  nav: ['hover', 'pressed', 'focused'],
  pip: ['hover', 'pressed', 'focused', 'selected'],
  switch: ['hover', 'pressed', 'focused', 'disabled', 'checked'],
  newsItem: ['hover', 'pressed', 'focused'],
  settingRow: ['hover', 'pressed', 'focused', 'selected'],
  titlebarButton: ['hover', 'pressed', 'focused'],
  scrollbarThumb: ['hover', 'pressed'],
} as const satisfies Record<string, readonly ControlState[]>;

const frame = (extra: Partial<CatalogEntry> = {}): CatalogEntry => ({
  kind: 'frame',
  required: true,
  ...extra,
});
const text = (
  states?: readonly ControlState[],
  extra: Partial<CatalogEntry> = {},
): CatalogEntry => ({
  kind: 'text',
  required: true,
  typography: 'display',
  states,
  ...extra,
});
const paint = (states: readonly ControlState[]): CatalogEntry => ({
  kind: 'paint',
  required: true,
  states,
});
const composite = (
  parts: Record<string, CatalogEntry>,
  required = true,
): CatalogEntry => ({ kind: 'composite', required, parts });

export const CONTROL_CATALOG = {
  window: { kind: 'window', required: true },
  'focus-ring': { kind: 'focus-ring', required: true },
  panel: frame(),
  button: frame({
    states: S.button,
    focusRingOwner: true,
    parts: { text: text(S.button) },
  }),
  input: frame({
    states: S.input,
    focusRingOwner: true,
    parts: {
      label: text(S.input, { leftInset: 10 }),
      value: text(S.input, { typography: 'editable' }),
      placeholder: text(S.input),
      caret: paint(S.input),
    },
  }),
  tab: frame({
    states: S.tab,
    focusRingOwner: true,
    parts: { text: text(S.tab) },
  }),
  subtab: frame({
    states: S.tab,
    focusRingOwner: true,
    parts: { text: text(S.tab) },
  }),
  carousel: frame({
    parts: {
      nav: {
        kind: 'image',
        required: true,
        states: S.nav,
        focusRingOwner: true,
        size: { width: 31, height: 31 },
      },
      pip: {
        kind: 'image',
        required: true,
        states: S.pip,
        focusRingOwner: true,
        size: { width: 13, height: 13 },
      },
    },
  }),
  switch: composite({
    track: frame({
      states: S.switch,
      focusRingOwner: true,
      size: { width: 34, height: 17 },
    }),
    thumb: frame({ states: S.switch, size: { width: 13, height: 13 } }),
  }),
  'news-item': frame({
    states: S.newsItem,
    focusRingOwner: true,
    size: { height: 43 },
    parts: {
      title: text(S.newsItem),
      date: text(S.newsItem),
      gem: {
        kind: 'variant-image',
        required: true,
        states: S.newsItem,
        size: { width: 14, height: 14 },
        variants: ['events', 'updates', 'maintenance', 'news'],
        placement: true,
      },
    },
  }),
  'setting-row': frame({
    states: S.settingRow,
    focusRingOwner: true,
    size: { height: 43 },
    parts: { label: text(S.settingRow), value: text(S.settingRow) },
  }),
  titlebar: frame({
    size: { height: 34 },
    parts: {
      wordmark: text(),
      caption: frame({
        states: S.titlebarButton,
        focusRingOwner: true,
        size: { width: 34, height: 34 },
      }),
      'caption-icon': paint(S.titlebarButton),
      close: frame({
        states: S.titlebarButton,
        focusRingOwner: true,
        size: { width: 34, height: 34 },
      }),
      'close-icon': paint(S.titlebarButton),
    },
  }),
  subtabs: frame({ size: { height: 34 } }),
  scrollbar: composite({
    track: frame({ size: { width: 8 } }),
    thumb: frame({ states: S.scrollbarThumb, size: { width: 8 } }),
  }),
  progress: composite({
    track: frame({ size: { height: 10 } }),
    indicator: frame(),
  }),
  'play-row': composite(
    {
      ornament: {
        kind: 'image',
        required: false,
        assetOptional: true,
        size: { width: 35, height: 20 },
      },
    },
    false,
  ),
  'tab-bar': composite({
    hint: {
      kind: 'variant-image',
      required: true,
      size: { width: 16, height: 16 },
      variants: [
        'left-bumper',
        'right-bumper',
        'left-trigger',
        'right-trigger',
      ],
    },
  }),
  settings: composite({ heading: text() }),
  'setting-help': composite({ title: text(), body: text() }),
} as const satisfies Record<string, CatalogEntry>;

export type RootControlId = keyof typeof CONTROL_CATALOG;
export const ROOT_CONTROL_IDS = Object.keys(CONTROL_CATALOG) as RootControlId[];
