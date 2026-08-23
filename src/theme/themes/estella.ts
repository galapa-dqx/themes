import type { AuthoringTheme } from '../types';

/* Estella — a bordered, natural-case, italic-heading theme. */
export const estella: AuthoringTheme = {
  label: 'Estella',
  mode: 'light',
  palette: {
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
    heading: { family: 'Playfair Display', fallback: 'serif', weight: 600, style: 'italic' },
    body: { family: 'Source Sans 3', fallback: 'sans-serif', weight: 400 },
    strong: { family: 'Playfair Display', fallback: 'serif', weight: 700 },
  },
  controls: {
    window: { fill: '--theme-bg', contentColor: '--theme-text', borderColor: '--theme-border' },

    panel: {
      shape: 'Path',
      fill: '--theme-surface',
      borderColor: '--theme-border',
      borderThickness: 1,
    },

    button: {
      shape: 'Path',
      radius: 4,
      fill: 'none',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: [6, 20, 6, 20],
      contentColor: '--theme-accent',
      text: { role: 'strong', size: 16, letterSpacing: 0.2, case: 'uppercase' },
      states: {
        hover: { borderColor: '--theme-accent' },
        pressed: { fill: { alpha: '--theme-accent', value: 0.08 } },
        disabled: { opacity: 0.5 },
      },
    },

    input: {
      shape: 'Path',
      borderColor: '--theme-border',
      contentColor: '--theme-text',
      borderThickness: 1,
      padding: [6, 10, 6, 10],
      text: { role: 'body', size: 16 },
      states: {
        focused: {
          showRing: false,
          borderColor: '--theme-accent',
          borderThickness: 2,
        },
        disabled: { opacity: 0.5 },
      },
    },

    tab: {
      shape: 'Path',
      contentColor: '--theme-muted',
      borderColor: 'none',
      borderThickness: [0, 0, 2, 0],
      padding: [0, 10, 0, 10],
      text: { role: 'heading', size: 14, letterSpacing: 0.3 },
      states: {
        hover: { contentColor: '--theme-accent' },
        selected: { contentColor: '--theme-accent', borderColor: '--theme-accent' },
      },
    },

    subtab: {
      shape: 'Path',
      contentColor: '--theme-muted',
      borderColor: 'none',
      borderThickness: [0, 0, 2, 0],
      padding: [0, 10, 0, 10],
      text: { role: 'heading', size: 14, case: 'uppercase' },
      states: {
        hover: { contentColor: '--theme-accent' },
        selected: { contentColor: '--theme-accent', borderColor: '--theme-accent' },
      },
    },

    carousel: {
      shape: 'Path',
      radius: 4,
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: 2,
    },

    pip: {
      shape: 'Path',
      size: { width: 13, height: 13 },
      corner: 'bevel',
      radius: 6.5,
      fill: 'none',
      borderColor: '--theme-border',
      borderThickness: 1,
      states: {
        selected: { fill: '--theme-accent', borderColor: '--theme-accent' },
      },
    },

    'switch.track': {
      shape: 'Path',
      size: { width: 34, height: 17 },
      radius: 'pill',
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: 2,
      states: {
        disabled: { opacity: 0.5 },
      },
    },
    'switch.thumb': {
      shape: 'Path',
      size: { width: 13, height: 13 },
      radius: 'pill',
      fill: '--theme-border',
      states: {
        checked: { fill: '--theme-accent' },
      },
    },

    'carousel.nav': {
      shape: 'Path',
      size: { width: 31, height: 31 },
      radius: 'pill',
      fill: '--theme-surface',
      borderColor: '--theme-border',
      borderThickness: 1,
      contentColor: '--theme-border',
      states: {
        hover: { borderColor: '--theme-accent', contentColor: '--theme-accent' },
      },
    },

    'titlebar.caption': {
      shape: 'Path',
      size: { width: 34, height: 34 },
      contentColor: '--theme-muted',
      states: {
        hover: { fill: '--theme-surface' },
      },
    },
    'titlebar.close': {
      shape: 'Path',
      size: { width: 34, height: 34 },
      contentColor: '--theme-danger',
      states: {
        hover: { fill: '--theme-danger', contentColor: '--theme-surface' },
      },
    },

    'news-item': {
      shape: 'Path',
      size: { height: 43 },
      fill: '--theme-surface',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: [0, 12, 0, 12],
      contentColor: '--theme-muted',
      text: { role: 'strong', size: 16 },
      states: {
        hover: { borderColor: '--theme-muted' },
      },
    },

    'setting-row': {
      shape: 'Path',
      size: { height: 43 },
      fill: '--theme-surface',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: [0, 13, 0, 13],
      contentColor: '--theme-muted',
      text: { role: 'heading', size: 14 },
      states: {
        selected: {
          borderColor: '--theme-accent',
          borderThickness: 2,
          contentColor: '--theme-accent',
        },
      },
    },

    titlebar: {
      shape: 'Path',
      size: { height: 34 },
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: [0, 0, 1, 0],
      padding: [0, 0, 0, 23],
    },

    subtabs: {
      shape: 'Path',
      size: { height: 34 },
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: [0, 0, 1, 0],
    },

    'scrollbar.track': {
      shape: 'Path',
      size: { width: 8 },
      corner: 'bevel',
      radius: 4,
      fill: '--theme-surface-2',
    },
    'scrollbar.thumb': {
      shape: 'Path',
      size: { width: 8 },
      corner: 'bevel',
      radius: 4,
      fill: '--theme-muted',
    },

    'progress.track': {
      shape: 'Path',
      size: { height: 10 },
      radius: 'pill',
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: 2,
    },
    'progress.indicator': {
      shape: 'Path',
      radius: 'pill',
      fill: '--theme-accent',
    },

    /* Text controls — colour and type only. */
    'play-ornament': { shape: 'Path' },
    'input.label': {
      leftInset: 10,
      contentColor: { mix: ['--theme-border', '--theme-muted'], amount: 0.6 },
      text: { role: 'heading', size: 12 },
    },
    'news-item.date': {
      contentColor: { mix: ['--theme-border', '--theme-muted'], amount: 0.6 },
      text: { role: 'body', size: 13, letterSpacing: 0.1 },
    },
    'news-item.gem': {},
    'titlebar.wordmark': {
      contentColor: '--theme-accent',
      text: { role: 'heading', size: 20 },
    },
    'tab-bar': { contentColor: '--theme-muted' },
    'settings.heading': {
      contentColor: '--theme-muted',
      text: { role: 'heading', size: 16, letterSpacing: 0.2 },
    },
    'setting-help.title': {
      contentColor: '--theme-text',
      text: { role: 'heading', size: 16 },
    },
    'setting-help.body': {
      contentColor: '--theme-text',
      text: { role: 'body', size: 13 },
    },
    'input.placeholder': {
      contentColor: { alpha: '--theme-muted', value: 0.6 },
    },
    'input.caret': { contentColor: '--theme-accent' },
    'play-row': { contentColor: '--theme-border' },
  },
};
