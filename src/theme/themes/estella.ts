import type { AuthoringTheme } from '../types';

/* Estella — a bordered, natural-case, italic-heading theme. */
export const estella: AuthoringTheme = {
  label: 'Estella',
  mode: 'light',
  tokens: {
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
    text: {
      heading: { family: 'Playfair Display', fallback: 'serif', weight: 600, style: 'italic', size: 14, letterSpacing: 0, case: 'none' },
      body: { family: 'Source Sans 3', fallback: 'sans-serif', weight: 400, style: 'normal', size: 14, letterSpacing: 0, case: 'none' },
      strong: { family: 'Playfair Display', fallback: 'serif', weight: 700, style: 'normal', size: 14, letterSpacing: 0, case: 'none' },
    },
  },
  controls: {
    window: { fill: '--color-bg', contentColor: '--color-text', borderColor: '--color-border' },

    panel: {
      shape: 'Path',
      fill: '--color-surface',
      borderColor: '--color-border',
      borderThickness: 1,
    },

    button: {
      shape: 'Path',
      radius: 4,
      fill: 'none',
      borderColor: '--color-border',
      borderThickness: 1,
      padding: [6, 20, 6, 20],
      contentColor: '--color-accent',
      text: { style: '--text-strong', size: 16, letterSpacing: 0.2, case: 'uppercase' },
      states: {
        hover: { borderColor: '--color-accent' },
        pressed: { fill: { alpha: '--color-accent', value: 0.08 } },
        disabled: { opacity: 0.5 },
      },
    },

    input: {
      shape: 'Path',
      borderColor: '--color-border',
      contentColor: '--color-text',
      borderThickness: 1,
      padding: [6, 10, 6, 10],
      text: { style: '--text-body', size: 16 },
      states: {
        focused: {
          showRing: false,
          borderColor: '--color-accent',
          borderThickness: 2,
        },
        disabled: { opacity: 0.5 },
      },
    },

    tab: {
      shape: 'Path',
      contentColor: '--color-muted',
      borderColor: 'none',
      borderThickness: [0, 0, 2, 0],
      padding: [0, 10, 0, 10],
      text: { style: '--text-heading', size: 14, letterSpacing: 0.3 },
      states: {
        hover: { contentColor: '--color-accent' },
        selected: { contentColor: '--color-accent', borderColor: '--color-accent' },
      },
    },

    subtab: {
      shape: 'Path',
      contentColor: '--color-muted',
      borderColor: 'none',
      borderThickness: [0, 0, 2, 0],
      padding: [0, 10, 0, 10],
      text: { style: '--text-heading', size: 14, case: 'uppercase' },
      states: {
        hover: { contentColor: '--color-accent' },
        selected: { contentColor: '--color-accent', borderColor: '--color-accent' },
      },
    },

    carousel: {
      shape: 'Path',
      radius: 4,
      borderColor: '--color-border',
      borderThickness: 1,
      padding: 2,
    },

    pip: {
      shape: 'Path',
      size: { width: 13, height: 13 },
      corner: 'bevel',
      radius: 6.5,
      fill: 'none',
      borderColor: '--color-border',
      borderThickness: 1,
      states: {
        selected: { fill: '--color-accent', borderColor: '--color-accent' },
      },
    },

    'switch.track': {
      shape: 'Path',
      size: { width: 34, height: 17 },
      radius: 'pill',
      fill: '--color-surface-2',
      borderColor: '--color-border',
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
      fill: '--color-border',
      states: {
        checked: { fill: '--color-accent' },
      },
    },

    'carousel.nav': {
      shape: 'Path',
      size: { width: 31, height: 31 },
      radius: 'pill',
      fill: '--color-surface',
      borderColor: '--color-border',
      borderThickness: 1,
      contentColor: '--color-border',
      states: {
        hover: { borderColor: '--color-accent', contentColor: '--color-accent' },
      },
    },

    'titlebar.caption': {
      shape: 'Path',
      size: { width: 34, height: 34 },
      contentColor: '--color-muted',
      states: {
        hover: { fill: '--color-surface' },
      },
    },
    'titlebar.close': {
      shape: 'Path',
      size: { width: 34, height: 34 },
      contentColor: '--color-danger',
      states: {
        hover: { fill: '--color-danger', contentColor: '--color-surface' },
      },
    },

    'news-item': {
      shape: 'Path',
      size: { height: 43 },
      fill: '--color-surface',
      borderColor: '--color-border',
      borderThickness: 1,
      padding: [0, 12, 0, 12],
      contentColor: '--color-muted',
      text: { style: '--text-strong', size: 16 },
      states: {
        hover: { borderColor: '--color-muted' },
      },
    },

    'setting-row': {
      shape: 'Path',
      size: { height: 43 },
      fill: '--color-surface',
      borderColor: '--color-border',
      borderThickness: 1,
      padding: [0, 13, 0, 13],
      contentColor: '--color-muted',
      text: { style: '--text-heading', size: 14 },
      states: {
        selected: {
          borderColor: '--color-accent',
          borderThickness: 2,
          contentColor: '--color-accent',
        },
      },
    },

    titlebar: {
      shape: 'Path',
      size: { height: 34 },
      fill: '--color-surface-2',
      borderColor: '--color-border',
      borderThickness: [0, 0, 1, 0],
      padding: [0, 0, 0, 23],
    },

    subtabs: {
      shape: 'Path',
      size: { height: 34 },
      fill: '--color-surface-2',
      borderColor: '--color-border',
      borderThickness: [0, 0, 1, 0],
    },

    'scrollbar.track': {
      shape: 'Path',
      size: { width: 8 },
      corner: 'bevel',
      radius: 4,
      fill: '--color-surface-2',
    },
    'scrollbar.thumb': {
      shape: 'Path',
      size: { width: 8 },
      corner: 'bevel',
      radius: 4,
      fill: '--color-muted',
    },

    'progress.track': {
      shape: 'Path',
      size: { height: 10 },
      radius: 'pill',
      fill: '--color-surface-2',
      borderColor: '--color-border',
      borderThickness: 1,
      padding: 2,
    },
    'progress.indicator': {
      shape: 'Path',
      radius: 'pill',
      fill: '--color-accent',
    },

    /* Text controls — colour and type only. */
    'play-ornament': { shape: 'Path' },
    'input.label': {
      leftInset: 10,
      contentColor: { mix: ['--color-border', '--color-muted'], amount: 0.6 },
      text: { style: '--text-heading', size: 12 },
    },
    'news-item.date': {
      contentColor: { mix: ['--color-border', '--color-muted'], amount: 0.6 },
      text: { style: '--text-body', size: 13, letterSpacing: 0.1 },
    },
    'news-item.gem': {},
    'titlebar.wordmark': {
      contentColor: '--color-accent',
      text: { style: '--text-heading', size: 20 },
    },
    'tab-bar': { contentColor: '--color-muted' },
    'settings.heading': {
      contentColor: '--color-muted',
      text: { style: '--text-heading', size: 16, letterSpacing: 0.2 },
    },
    'setting-help.title': {
      contentColor: '--color-text',
      text: { style: '--text-heading', size: 16 },
    },
    'setting-help.body': {
      contentColor: '--color-text',
      text: { style: '--text-body', size: 13 },
    },
    'input.placeholder': {
      contentColor: { alpha: '--color-muted', value: 0.6 },
    },
    'input.caret': { contentColor: '--color-accent' },
    'play-row': { contentColor: '--color-border' },
  },
};
