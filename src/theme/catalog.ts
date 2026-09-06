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

export type TypographyCapability = 'display' | 'editable';
export type SizeAxis = 'width' | 'height';

export type CatalogControl = {
  kind: ControlKind;
  required: boolean;
  states?: readonly ControlState[];
  focusRingOwner?: true;
  size?: {
    axes: readonly SizeAxis[];
    default: Partial<Record<SizeAxis, number>>;
  };
  typography?: TypographyCapability;
  leftInset?: { default: number };
  assetRequired?: boolean;
  variants?: {
    keys: readonly string[];
    projectAssetsOptional: boolean;
    compilerDefaults?: 'material-input-hints' | 'news-gems';
  };
  parts?: Readonly<Record<string, CatalogControl>>;
};

const interactive = {
  button: ['hover', 'pressed', 'focused', 'disabled'],
  input: ['focused', 'disabled'],
  tab: ['hover', 'focused', 'selected'],
  carouselNav: ['hover', 'pressed', 'focused'],
  carouselPip: ['hover', 'pressed', 'focused', 'selected'],
  switch: ['hover', 'pressed', 'focused', 'disabled', 'checked'],
  newsItem: ['hover', 'pressed', 'focused'],
  settingRow: ['hover', 'pressed', 'focused', 'selected'],
  titlebarButton: ['hover', 'pressed', 'focused'],
  scrollbarThumb: ['hover', 'pressed'],
} as const satisfies Record<string, readonly ControlState[]>;

const sized = (
  axes: readonly SizeAxis[],
  defaultSize: Partial<Record<SizeAxis, number>>,
) => ({ axes, default: defaultSize });

const text = (
  states: readonly ControlState[] = [],
  typography: TypographyCapability = 'display',
): CatalogControl => ({ kind: 'text', required: true, states, typography });

const paint = (states: readonly ControlState[]): CatalogControl => ({
  kind: 'paint',
  required: true,
  states,
});

/**
 * Version 1's component vocabulary and runtime semantics.
 *
 * Project and compiled JSON never serialise `kind`, requiredness, size
 * defaults, typography capabilities, or focus ownership. The schema
 * generator and both clients derive those facts from this catalog.
 */
export const CONTROL_CATALOG = {
  window: { kind: 'window', required: true },
  'focus-ring': { kind: 'focus-ring', required: true },
  panel: { kind: 'frame', required: true },
  button: {
    kind: 'frame',
    required: true,
    states: interactive.button,
    focusRingOwner: true,
    parts: {
      text: text(interactive.button),
    },
  },
  input: {
    kind: 'frame',
    required: true,
    states: interactive.input,
    focusRingOwner: true,
    parts: {
      label: {
        ...text(interactive.input),
        leftInset: { default: 10 },
      },
      value: text(interactive.input, 'editable'),
      placeholder: text(interactive.input),
      caret: paint(interactive.input),
    },
  },
  tab: {
    kind: 'frame',
    required: true,
    states: interactive.tab,
    focusRingOwner: true,
    parts: { text: text(interactive.tab) },
  },
  subtab: {
    kind: 'frame',
    required: true,
    states: interactive.tab,
    focusRingOwner: true,
    parts: { text: text(interactive.tab) },
  },
  carousel: {
    kind: 'frame',
    required: true,
    parts: {
      nav: {
        kind: 'image',
        required: true,
        states: interactive.carouselNav,
        focusRingOwner: true,
        size: sized(['width', 'height'], { width: 31, height: 31 }),
        assetRequired: true,
      },
      pip: {
        kind: 'image',
        required: true,
        states: interactive.carouselPip,
        focusRingOwner: true,
        size: sized(['width', 'height'], { width: 13, height: 13 }),
        assetRequired: true,
      },
    },
  },
  switch: {
    kind: 'composite',
    required: true,
    parts: {
      track: {
        kind: 'frame',
        required: true,
        states: interactive.switch,
        focusRingOwner: true,
        size: sized(['width', 'height'], { width: 34, height: 17 }),
      },
      thumb: {
        kind: 'frame',
        required: true,
        states: interactive.switch,
        size: sized(['width', 'height'], { width: 13, height: 13 }),
      },
    },
  },
  'news-item': {
    kind: 'frame',
    required: true,
    states: interactive.newsItem,
    focusRingOwner: true,
    size: sized(['height'], { height: 43 }),
    parts: {
      title: text(interactive.newsItem),
      date: text(interactive.newsItem),
      gem: {
        kind: 'variant-image',
        required: true,
        states: interactive.newsItem,
        size: sized(['width', 'height'], { width: 14, height: 14 }),
        variants: {
          keys: ['events', 'updates', 'maintenance', 'news'],
          projectAssetsOptional: true,
          compilerDefaults: 'news-gems',
        },
      },
    },
  },
  'setting-row': {
    kind: 'frame',
    required: true,
    states: interactive.settingRow,
    focusRingOwner: true,
    size: sized(['height'], { height: 43 }),
    parts: {
      label: text(interactive.settingRow),
      value: text(interactive.settingRow),
    },
  },
  titlebar: {
    kind: 'frame',
    required: true,
    size: sized(['height'], { height: 34 }),
    parts: {
      wordmark: text(),
      caption: {
        kind: 'frame',
        required: true,
        states: interactive.titlebarButton,
        focusRingOwner: true,
        size: sized(['width', 'height'], { width: 34, height: 34 }),
      },
      'caption-icon': paint(interactive.titlebarButton),
      close: {
        kind: 'frame',
        required: true,
        states: interactive.titlebarButton,
        focusRingOwner: true,
        size: sized(['width', 'height'], { width: 34, height: 34 }),
      },
      'close-icon': paint(interactive.titlebarButton),
    },
  },
  subtabs: {
    kind: 'frame',
    required: true,
    size: sized(['height'], { height: 34 }),
  },
  scrollbar: {
    kind: 'composite',
    required: true,
    parts: {
      track: {
        kind: 'frame',
        required: true,
        size: sized(['width'], { width: 8 }),
      },
      thumb: {
        kind: 'frame',
        required: true,
        states: interactive.scrollbarThumb,
        size: sized(['width'], { width: 8 }),
      },
    },
  },
  progress: {
    kind: 'composite',
    required: true,
    parts: {
      track: {
        kind: 'frame',
        required: true,
        size: sized(['height'], { height: 10 }),
      },
      indicator: { kind: 'frame', required: true },
    },
  },
  'play-row': {
    kind: 'composite',
    required: false,
    parts: {
      ornament: {
        kind: 'image',
        required: false,
        size: sized(['width', 'height'], { width: 35, height: 20 }),
        assetRequired: false,
      },
    },
  },
  'tab-bar': {
    kind: 'composite',
    required: true,
    parts: {
      hint: {
        kind: 'variant-image',
        required: true,
        size: sized(['width', 'height'], { width: 16, height: 16 }),
        variants: {
          keys: ['left-bumper', 'right-bumper', 'left-trigger', 'right-trigger'],
          projectAssetsOptional: true,
          compilerDefaults: 'material-input-hints',
        },
      },
    },
  },
  settings: {
    kind: 'composite',
    required: true,
    parts: { heading: text() },
  },
  'setting-help': {
    kind: 'composite',
    required: true,
    parts: {
      title: text(),
      body: text(),
    },
  },
} as const satisfies Readonly<Record<string, CatalogControl>>;

export type RootControlId = keyof typeof CONTROL_CATALOG;

export const ROOT_CONTROL_IDS = Object.freeze(
  Object.keys(CONTROL_CATALOG) as RootControlId[],
);

export function catalogControl(
  root: RootControlId,
  part?: string,
): CatalogControl | undefined {
  const entry: CatalogControl = CONTROL_CATALOG[root];
  return part === undefined ? entry : entry.parts?.[part];
}

export function fullControlId(root: RootControlId, part?: string): string {
  return part === undefined ? root : `${root}.${part}`;
}
