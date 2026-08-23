import type { AuthoringTheme } from '../types';

/* Duston — dark amber built-in, filled-pill buttons. */
export const duston: AuthoringTheme = {
  label: 'Duston',
  mode: 'dark',
  palette: {
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
  fonts: {
    heading: {
      family: 'Crimson Pro',
      fallback: 'serif',
      weight: 700,
    },
    body: {
      family: 'Source Sans 3',
      fallback: 'sans-serif',
      weight: 400,
    },
    strong: {
      family: 'Crimson Pro',
      fallback: 'serif',
      weight: 700,
    },
  },
  controls: {
    /* The app background; its content colour is the text baseline every
       themed surface inherits from. */
    window: { fill: '--theme-bg', contentColor: '--theme-text', borderColor: '--theme-border' },

    panel: {
      shape: 'Path',
      fill: '--theme-surface',
      borderColor: '--theme-border',
      borderThickness: 1,
    },

    button: {
      shape: 'Path',
      radius: 'pill',
      fill: '--theme-accent',
      padding: [6, 20, 6, 20],
      contentColor: '--theme-surface',
      text: { role: 'strong', size: 16, letterSpacing: 0.6, case: 'uppercase' },
      states: {
        hover: { fill: { mix: ['--theme-accent', '#ffffff'], amount: 0.12 } },
        pressed: { fill: { mix: ['--theme-accent', '#000000'], amount: 0.12 } },
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
      text: { role: 'heading', size: 16, letterSpacing: 0.8, case: 'uppercase' },
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
      radius: 0,
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
      borderColor: '--theme-muted',
      borderThickness: 1,
      contentColor: '--theme-muted',
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
      text: { role: 'strong', size: 16, letterSpacing: 0.4 },
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
      text: { role: 'heading', size: 14, case: 'uppercase' },
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
      corner: 'bevel',
      radius: 5,
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: [2, 2.83, 2, 2.83], // 2 × √2 across the 45° ends
    },
    'progress.indicator': {
      shape: 'Path',
      corner: 'bevel',
      radius: 3,
      fill: '--theme-accent',
    },

    /* Text controls — colour and type only. */
    'play-ornament': { shape: 'Path' },
    'input.label': {
      leftInset: 10,
      contentColor: { mix: ['--theme-border', '--theme-muted'], amount: 0.6 },
      text: { role: 'heading', size: 12, letterSpacing: 0.8 },
    },
    'news-item.date': {
      contentColor: { mix: ['--theme-border', '--theme-muted'], amount: 0.6 },
      text: { role: 'body', size: 13, letterSpacing: 0.1 },
    },
    'news-item.gem': {},
    'titlebar.wordmark': {
      contentColor: '--theme-accent',
      text: { role: 'heading', size: 20, letterSpacing: 0.4, case: 'uppercase' },
    },
    'tab-bar': { contentColor: '--theme-muted' },
    'settings.heading': {
      contentColor: '--theme-muted',
      text: { role: 'heading', size: 16, letterSpacing: 0.8, case: 'uppercase' },
    },
    'setting-help.title': {
      contentColor: '--theme-text',
      text: { role: 'heading', size: 16, case: 'uppercase' },
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
