import type { AuthoringTheme } from '../types';

/**
 * Kyururu — the reference theme and the fallback. It is authored in full, so
 * it doubles as the worked example of the format: an open palette named in the
 * nine convention roles, three font roles, and every control the app draws,
 * including the pressed/disabled states that the strict doctrine now requires
 * a theme to declare rather than the app to hard-code.
 *
 * Derivation recipe (shared across the built-ins): a filled control lightens
 * on hover and darkens on press, both perceptually (oklab); a bordered control
 * washes a faint fill in; anything disabled dims to half opacity. Colours are
 * restated from palette tokens because a derivation can't reference the base
 * it overrides — the tradeoff for a resolver with no dependency graph.
 */
export const kyururu: AuthoringTheme = {
  label: 'Kyururu',
  mode: 'light',
  palette: {
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
    body: { family: 'Source Sans 3', fallback: 'sans-serif', weight: 400 },
    strong: { family: 'Space Grotesk', fallback: 'sans-serif', weight: 700 },
  },
  assets: {
    'play-squares': '/theme-assets/kyururu/play-squares.svg',
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
      radius: 0,
      fill: 'none',
      borderColor: '--theme-accent',
      borderThickness: 1,
      padding: [6, 20, 6, 20],
      contentColor: '--theme-accent',
      text: { role: 'strong', size: 16, letterSpacing: 0.4, case: 'uppercase' },
      states: {
        hover: { fill: '--theme-surface-2' },
        pressed: { fill: { mix: ['--theme-surface-2', '--theme-accent'], amount: 0.14 } },
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
      text: { role: 'heading', size: 16, letterSpacing: 0.6, case: 'uppercase' },
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
      size: { width: 9, height: 9 },
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
      fill: '--theme-surface-2',
    },
    'scrollbar.thumb': {
      shape: 'Path',
      size: { width: 8 },
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

    'play-ornament': { shape: 'Path', image: 'play-squares' },

    /* Text controls — colour and type only. */
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
      text: { role: 'heading', size: 20, letterSpacing: -0.2, case: 'uppercase' },
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
