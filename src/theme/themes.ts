import type { CSSProperties } from 'react';
import {
  compileGeometry,
  resolveGeometry,
  type ThemeGeometry,
} from './geometry';

export type ThemeColors = {
  bg: string;
  surface: string;
  'surface-2': string;
  border: string;
  text: string;
  muted: string;
  accent: string;
  success: string;
  danger: string;
};
export type ThemeMode = 'light' | 'dark';

/** One font role: family plus the weight/style "filter" the theme applies. */
export type ThemeFont = {
  family: string;
  fallback: 'serif' | 'sans-serif';
  weight: number;
  style?: 'italic';
};

export type ThemeFonts = {
  heading: ThemeFont;
  body: ThemeFont;
  /** Emphasis text (news titles, buttons); defaults to `heading`. Lets a
   *  theme split chrome type (e.g. italic) from bold emphasis type. */
  strong?: ThemeFont;
};

/** Text-transform applied to headings/labels (Figma's upper/lower "filter"). */
export type LabelCase = 'uppercase' | 'lowercase' | 'capitalize' | 'none';

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

export type Theme = {
  label: string;
  meta?: ThemeMeta;
  mode: ThemeMode;
  colors: ThemeColors;
  fonts: ThemeFonts;
  /** Corner radius (px) for panels, cards, and inputs (Figma "Rounding"). */
  rounding: number;
  labelCase: LabelCase;
  /** Text-transform for input field labels (design: Anlucia uses UPPER). */
  fieldLabelCase?: LabelCase;
  /** Window-tab font size override in px (design: Estella uses 14). */
  tabSize?: number;
  /** Decorations. `play`: URL of a token-coloured SVG flanking the Play
   *  button, `null` to hide, undefined for the default flourish. */
  ornaments?: { play?: string | null };
  /** Asset key → URL. Referenced by geometry entries with shape 'Asset'. */
  assets?: Record<string, string>;
  /** Per-part geometry overrides; anything absent uses DEFAULT_GEOMETRY. */
  geometry?: ThemeGeometry;
};

const CRIMSON: ThemeFont = { family: 'Crimson Pro', fallback: 'serif', weight: 700 };
const SOURCE_SANS: ThemeFont = { family: 'Source Sans 3', fallback: 'sans-serif', weight: 400 };
const DEFAULT_FONTS: ThemeFonts = { heading: CRIMSON, body: SOURCE_SANS };

export const THEMES = {
  rosie: {
    label: 'Rosie',
    mode: 'dark',
    colors: {
      bg: '#060d0b',
      surface: '#0c1814',
      'surface-2': '#142018',
      border: '#203828',
      text: '#c8e8de',
      muted: '#508870',
      accent: '#18b090',
      success: '#4caf82',
      danger: '#e05c6a',
    },
    fonts: {
      heading: { family: 'Inter', fallback: 'sans-serif', weight: 400 },
      body: SOURCE_SANS,
    },
    rounding: 0,
    labelCase: 'uppercase',
  },
  asbal: {
    label: 'Asbal',
    mode: 'dark',
    colors: {
      bg: '#0d0608',
      surface: '#150b10',
      'surface-2': '#1e1018',
      border: '#3a1a28',
      text: '#f0e0e8',
      muted: '#9a6878',
      accent: '#c82040',
      success: '#4caf82',
      danger: '#e07040',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  duston: {
    label: 'Duston',
    mode: 'dark',
    colors: {
      bg: '#141008',
      surface: '#1c170a',
      'surface-2': '#261e10',
      border: '#3c3018',
      text: '#e8dcc8',
      muted: '#8a7858',
      accent: '#a87830',
      success: '#4a8a3a',
      danger: '#c04030',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  fostail: {
    label: 'Fostail',
    mode: 'dark',
    colors: {
      bg: '#0d0b14',
      surface: '#131020',
      'surface-2': '#1a1530',
      border: '#2c2545',
      text: '#d8d0f0',
      muted: '#7870a8',
      accent: '#9068e0',
      success: '#4caf82',
      danger: '#e05c6a',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  lushenda: {
    label: 'Lushenda',
    mode: 'dark',
    colors: {
      bg: '#0a0810',
      surface: '#130f1e',
      'surface-2': '#1c1630',
      border: '#362248',
      text: '#ecd8f8',
      muted: '#7848a8',
      accent: '#2aac58',
      success: '#4caf82',
      danger: '#e05c6a',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  aurelia: {
    label: 'Aurelia',
    mode: 'light',
    colors: {
      bg: '#f6eedb',
      surface: '#fdf8ec',
      'surface-2': '#efe3c4',
      border: '#c2a05a',
      text: '#3a2a10',
      muted: '#8a6c38',
      accent: '#a83232',
      success: '#4a7a2a',
      danger: '#c03020',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
    assets: {
      'panel-ornate': '/theme-assets/aurelia/panel.9.svg',
    },
    geometry: {
      panel: { shape: 'Asset', asset: 'panel-ornate' },
      button: {
        shape: 'Path',
        radius: 6,
        corner: 'bevel',
        fill: '--theme-accent',
        contentColor: '--theme-surface',
        borderColor: '--theme-border',
        borderThickness: 1,
        transition: { duration: 120 },
      },
      pip: {
        shape: 'Path',
        fill: 'none',
        borderColor: '--theme-muted',
        borderThickness: 1,
        states: {
          selected: { fill: '--theme-accent', borderColor: '--theme-accent' },
        },
      },
      'switch.thumb': {
        shape: 'Path',
        radius: 'pill',
        fill: '--theme-muted',
        states: { checked: { fill: '--theme-accent' } },
        transition: { duration: 150 },
      },
      'news-item': {
        shape: 'Path',
        fill: '--theme-surface',
        borderColor: '--theme-border',
        borderThickness: 1,
        contentColor: '--theme-muted',
        states: { hover: { borderColor: '--theme-accent' } },
        transition: { duration: 120 },
      },
    },
  },
  anlucia: {
    label: 'Anlucia',
    mode: 'light',
    colors: {
      bg: '#fdf6ec',
      surface: '#fffaf3',
      'surface-2': '#f2e6d2',
      border: '#dccaac',
      text: '#2c1a08',
      muted: '#8a6e52',
      accent: '#b87228',
      success: '#4a7a2a',
      danger: '#c03020',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
    fieldLabelCase: 'uppercase',
    ornaments: { play: '/theme-assets/anlucia/sword.svg' },
  },
  estella: {
    label: 'Estella',
    mode: 'light',
    colors: {
      bg: '#eef4f8',
      surface: '#f5f9fc',
      'surface-2': '#dde8f0',
      border: '#b8ccd8',
      text: '#0e1e28',
      muted: '#4a6a80',
      accent: '#3878aa',
      success: '#2a7a3a',
      danger: '#c04040',
    },
    fonts: {
      heading: {
        family: 'Playfair Display',
        fallback: 'serif',
        weight: 600,
        style: 'italic',
      },
      body: SOURCE_SANS,
      strong: { family: 'Playfair Display', fallback: 'serif', weight: 700 },
    },
    rounding: 4,
    labelCase: 'none',
    tabSize: 14,
    geometry: {
      button: {
        shape: 'Path',
        radius: 4,
        fill: 'none',
        borderColor: '--theme-border',
        borderThickness: 1,
        contentColor: '--theme-accent',
        states: { hover: { borderColor: '--theme-accent' } },
        transition: { duration: 120 },
      },
    },
  },
  kyururu: {
    label: 'Kyururu',
    mode: 'light',
    colors: {
      bg: '#edfaf5',
      surface: '#f5fdfa',
      'surface-2': '#d8f4ec',
      border: '#a8e0cc',
      text: '#0a2820',
      muted: '#3a7860',
      accent: '#22aa78',
      success: '#2a8a4a',
      danger: '#c03040',
    },
    fonts: {
      heading: { family: 'Space Grotesk', fallback: 'sans-serif', weight: 700 },
      body: SOURCE_SANS,
    },
    rounding: 0,
    labelCase: 'uppercase',
    ornaments: { play: '/theme-assets/kyururu/play-squares.svg' },
    geometry: {
      button: {
        shape: 'Path',
        radius: 0,
        fill: 'none',
        borderColor: '--theme-accent',
        borderThickness: 1,
        contentColor: '--theme-accent',
        states: { hover: { fill: '--theme-surface-2' } },
        transition: { duration: 120 },
      },
    },
  },
  maille: {
    label: 'Maille',
    mode: 'light',
    colors: {
      bg: '#fdf0f2',
      surface: '#fff5f7',
      'surface-2': '#f0dfe2',
      border: '#dcc8cc',
      text: '#2a1018',
      muted: '#8a5868',
      accent: '#b05870',
      success: '#2a7a3a',
      danger: '#c03030',
    },
    fonts: DEFAULT_FONTS,
    rounding: 4,
    labelCase: 'uppercase',
  },
  mereade: {
    label: 'Mereade',
    mode: 'light',
    colors: {
      bg: '#fff5ed',
      surface: '#fff9f5',
      'surface-2': '#ffe8d8',
      border: '#f0c8a8',
      text: '#2a1008',
      muted: '#8a5830',
      accent: '#d06820',
      success: '#2a7a3a',
      danger: '#c03030',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  seraphi: {
    label: 'Seraphi',
    mode: 'light',
    colors: {
      bg: '#fdf8e0',
      surface: '#fffcf0',
      'surface-2': '#f8edbc',
      border: '#e0cc70',
      text: '#1a1600',
      muted: '#b07028',
      accent: '#3a6abf',
      success: '#2a7a3a',
      danger: '#c04040',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
  yuliza: {
    label: 'Yuliza',
    mode: 'light',
    colors: {
      bg: '#edf2fa',
      surface: '#f5f8ff',
      'surface-2': '#dce5f5',
      border: '#b8c8e8',
      text: '#081030',
      muted: '#3a5080',
      accent: '#2854c8',
      success: '#2a7a3a',
      danger: '#c04040',
    },
    fonts: DEFAULT_FONTS,
    rounding: 0,
    labelCase: 'uppercase',
  },
} satisfies Record<string, Theme>;

/**
 * The `Apply` loop: every palette entry becomes an `--app-<role>` property,
 * and the non-color tokens (fonts, rounding, label case) ride along so
 * component CSS can stay entirely variable-driven.
 */
export function themeStyle(theme: Theme): CSSProperties {
  const { heading, body } = theme.fonts;
  const strong = theme.fonts.strong ?? heading;
  return {
    ...Object.fromEntries(
      Object.entries(theme.colors).map(([role, hex]) => [`--app-${role}`, hex]),
    ),
    ...compileGeometry(resolveGeometry(theme.geometry)),
    '--app-font-heading': `'${heading.family}', ${heading.fallback}`,
    '--app-heading-weight': `${heading.weight}`,
    '--app-heading-style': heading.style ?? 'normal',
    '--app-font-strong': `'${strong.family}', ${strong.fallback}`,
    '--app-strong-weight': `${strong.weight}`,
    '--app-strong-style': strong.style ?? 'normal',
    '--app-font-body': `'${body.family}', ${body.fallback}`,
    '--app-body-weight': `${body.weight}`,
    '--app-radius': `${theme.rounding}px`,
    '--app-label-case': theme.labelCase,
    '--app-field-label-case': theme.fieldLabelCase ?? 'none',
    ...(theme.tabSize ? { '--app-tab-size': `${theme.tabSize}px` } : {}),
  } as CSSProperties;
}
