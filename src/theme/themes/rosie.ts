import type { AuthoringTheme } from '../types';

/* Rosie — dark teal built-in, filled-pill buttons. */
export const rosie: AuthoringTheme = {
  label: 'Rosie',
  mode: 'dark',
  palette: {
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
    heading: {
      family: 'Inter',
      fallback: 'sans-serif',
      weight: 400,
    },
    body: {
      family: 'Source Sans 3',
      fallback: 'sans-serif',
      weight: 400,
    },
    strong: {
      family: 'Inter',
      fallback: 'sans-serif',
      weight: 400,
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
      text: { role: 'strong', size: 16, case: 'uppercase' },
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
        focused: { borderColor: '--theme-accent', borderThickness: 2 },
        disabled: { opacity: 0.5 },
      },
    },

    tab: {
      shape: 'Path',
      contentColor: '--theme-muted',
      borderColor: 'none',
      borderThickness: [0, 0, 2, 0],
      padding: [0, 10, 0, 10],
      text: { role: 'heading', size: 16, case: 'uppercase' },
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
      fill: '--theme-surface-2',
      borderColor: '--theme-border',
      borderThickness: 1,
      padding: 2,
    },
    'progress.indicator': {
      shape: 'Path',
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
      text: { role: 'body', size: 13 },
    },
    'news-item.gem': {},
    'titlebar.wordmark': {
      contentColor: '--theme-accent',
      text: { role: 'heading', size: 20, case: 'uppercase' },
    },
    'tab-bar': { contentColor: '--theme-muted' },
    'settings.heading': {
      contentColor: '--theme-muted',
      text: { role: 'heading', size: 16, case: 'uppercase' },
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
