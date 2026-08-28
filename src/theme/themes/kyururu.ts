import type { AuthoringTheme } from '../types';

/**
 * Kyururu — the reference theme and the fallback. It is authored in full, so
 * it doubles as the worked example of the format: an open colour namespace
 * named in the nine convention roles, three text styles, and every control the
 * app draws, including the pressed/disabled states that the strict doctrine
 * now requires a theme to declare rather than the app to hard-code.
 *
 * Derivation recipe (shared across the built-ins): a filled control lightens
 * on hover and darkens on press, both perceptually (oklab); a bordered control
 * washes a faint fill in; anything disabled dims to half opacity. Colours are
 * restated from colour tokens because a derivation can't reference the base
 * it overrides — the tradeoff for a resolver with no dependency graph.
 */
export const kyururu: AuthoringTheme = {
  label: 'Kyururu',
  mode: 'light',
  tokens: {
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
    text: {
      heading: { family: 'Space Grotesk', fallback: 'sans-serif', weight: 700, style: 'normal', size: 14, letterSpacing: 0, case: 'none' },
      body: { family: 'Source Sans 3', fallback: 'sans-serif', weight: 400, style: 'normal', size: 14, letterSpacing: 0, case: 'none' },
      strong: { family: 'Space Grotesk', fallback: 'sans-serif', weight: 700, style: 'normal', size: 14, letterSpacing: 0, case: 'none' },
    },
  },
  assets: {
    'play-squares': '/theme-assets/kyururu/play-squares.svg',
  },
  controls: {
    /* The app background; its content colour is the text baseline every
       themed surface inherits from. */
    window: { fill: '--color-bg', contentColor: '--color-text', borderColor: '--color-border' },

    panel: {
      shape: 'Path',
      fill: '--color-surface',
      borderColor: '--color-border',
      borderThickness: 1,
    },

    button: {
      shape: 'Path',
      radius: 0,
      fill: 'none',
      borderColor: '--color-accent',
      borderThickness: 1,
      padding: [6, 20, 6, 20],
      contentColor: '--color-accent',
      text: { style: '--text-strong', size: 16, letterSpacing: 0.4, case: 'uppercase' },
      states: {
        hover: { fill: '--color-surface-2' },
        pressed: { fill: { mix: ['--color-surface-2', '--color-accent'], amount: 0.14 } },
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
      text: { style: '--text-heading', size: 16, letterSpacing: 0.6, case: 'uppercase' },
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
      radius: 0,
      borderColor: '--color-border',
      borderThickness: 1,
      padding: 2,
    },

    pip: {
      shape: 'Path',
      size: { width: 9, height: 9 },
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
      text: { style: '--text-heading', size: 14, case: 'uppercase' },
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
      fill: '--color-surface-2',
    },
    'scrollbar.thumb': {
      shape: 'Path',
      size: { width: 8 },
      fill: '--color-muted',
    },

    'progress.track': {
      shape: 'Path',
      size: { height: 10 },
      fill: '--color-surface-2',
      borderColor: '--color-border',
      borderThickness: 1,
      padding: 2,
    },
    'progress.indicator': {
      shape: 'Path',
      fill: '--color-accent',
    },

    'play-ornament': { shape: 'Path', image: 'play-squares' },

    /* Text controls — colour and type only. */
    'input.label': {
      leftInset: 10,
      contentColor: { mix: ['--color-border', '--color-muted'], amount: 0.6 },
      text: { style: '--text-heading', size: 12, letterSpacing: 0.8 },
    },
    'news-item.date': {
      contentColor: { mix: ['--color-border', '--color-muted'], amount: 0.6 },
      text: { style: '--text-body', size: 13, letterSpacing: 0.1 },
    },
    'news-item.gem': {},
    'titlebar.wordmark': {
      contentColor: '--color-accent',
      text: { style: '--text-heading', size: 20, letterSpacing: -0.2, case: 'uppercase' },
    },
    'tab-bar': { contentColor: '--color-muted' },
    'settings.heading': {
      contentColor: '--color-muted',
      text: { style: '--text-heading', size: 16, letterSpacing: 0.8, case: 'uppercase' },
    },
    'setting-help.title': {
      contentColor: '--color-text',
      text: { style: '--text-heading', size: 16, case: 'uppercase' },
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
