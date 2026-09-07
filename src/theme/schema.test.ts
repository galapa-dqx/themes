import { describe, expect, test } from 'vitest';
import Value from 'typebox/value';
import type { TSchema } from 'typebox';
import {
  CONTROL_CATALOG,
  STATE_PRIORITY,
  type CatalogEntry,
} from './catalog.ts';
import {
  CompiledMetadataSchema,
  CompiledThemeSchema,
  ProjectControlSchemas,
  ProjectMetadataSchema,
  ProjectTokensSchema,
} from './schema.ts';

const errors = (schema: TSchema, value: unknown) =>
  [...Value.Errors(schema, value)].map(
    (e) => `${e.instancePath}: ${e.message}`,
  );
const ok = (schema: TSchema, value: unknown) =>
  expect(errors(schema, value)).toEqual([]);
const bad = (schema: TSchema, value: unknown) =>
  expect(Value.Check(schema, value)).toBe(false);

const button = {
  $schema:
    'https://galapa-dqx.github.io/themes/theme-project/controls/button.schema.json',
  shape: 'path',
  border: { color: '{colors.border}', thickness: 2 },
  padding: [6, 10, 6, 10],
  states: {
    focused: {
      showRing: false,
      border: {
        color: {
          $type: 'mix',
          inputs: ['{colors.border}', '#000000'],
          amount: 0.12,
          space: 'oklab',
        },
        thickness: 2,
      },
    },
    disabled: { opacity: 0.5 },
  },
  parts: {
    text: {
      color: '{colors.text}',
      typography: { $extends: '{typography.heading}', fontSize: 16 },
    },
  },
};

const compiledButtonState = {
  shape: 'path',
  radius: 0,
  corner: 'round',
  fill: 'none',
  border: { color: '#c2a05a', thickness: [2, 2, 2, 2] },
  padding: [6, 10, 6, 10],
  opacity: 1,
};
const compiledButton = {
  ...compiledButtonState,
  parts: {
    text: {
      color: '#f5fdfa',
      opacity: 1,
      typography: {
        font: './assets/fonts/0123456789ab.ttf',
        fontWeight: 700,
        fontStyle: 'normal',
        fontSize: 16,
        letterSpacing: 0,
        lineHeight: 1.4,
        textCase: 'uppercase',
        textDecoration: [],
        fontFeatures: {},
      },
    },
  },
};

describe('catalog', () => {
  test('states are known priorities', () => {
    const walk = (e: CatalogEntry) => {
      for (const s of e.states ?? []) expect(STATE_PRIORITY).toContain(s);
      for (const p of Object.values(e.parts ?? {})) walk(p);
    };
    Object.values(CONTROL_CATALOG).forEach(walk);
  });
});

describe('project schemas', () => {
  const B = ProjectControlSchemas.button;
  test('spec button example validates', () => ok(B, button));
  test('unknown property rejected', () => bad(B, { ...button, kind: 'frame' }));
  test('shape immutable across states', () =>
    bad(B, { ...button, states: { hover: { shape: 'asset' } } }));
  test('padding rejected on asset branch, currentColor on path branch', () => {
    bad(B, {
      shape: 'asset',
      asset: './assets/b.9.svg',
      padding: 2,
      parts: button.parts,
    });
    bad(B, { ...button, currentColor: '#ffffff' });
    ok(B, {
      shape: 'asset',
      asset: '{assets.frame}',
      currentColor: '#fff000',
      parts: button.parts,
    });
  });
  test('showRing only for focus owners in focused', () => {
    bad(B, { ...button, states: { hover: { showRing: false } } });
    bad(B, {
      ...button,
      parts: {
        text: {
          ...button.parts.text,
          states: { focused: { showRing: false } },
        },
      },
    });
  });
  test('leftInset only on input.label; editable typography rejects textCase', () => {
    const I = ProjectControlSchemas.input;
    const t = { color: '#000000', typography: '{typography.body}' };
    const parts = {
      label: { ...t, leftInset: 12 },
      value: t,
      placeholder: t,
      caret: { color: '#000000' },
    };
    ok(I, { shape: 'path', parts });
    bad(I, {
      shape: 'path',
      parts: { ...parts, value: { ...t, leftInset: 1 } },
    });
    bad(I, {
      shape: 'path',
      parts: { ...parts, value: { ...t, typography: { textCase: 'none' } } },
    });
  });
  test('size axes per role', () => {
    ok(ProjectControlSchemas['news-item'], {
      shape: 'path',
      size: { height: 40 },
      parts: {
        title: { color: '#000000', typography: '{typography.x}' },
        date: { color: '#000000', typography: '{typography.x}' },
        gem: {},
      },
    });
    bad(ProjectControlSchemas['news-item'], {
      shape: 'path',
      size: { width: 40 },
    });
    bad(ProjectControlSchemas.panel, { shape: 'path', size: { height: 1 } });
  });
  test('optional roots and variant maps', () => {
    ok(ProjectControlSchemas['play-row'], {});
    ok(ProjectControlSchemas['tab-bar'], {
      parts: {
        hint: {
          assets: { 'left-bumper': './assets/lb.svg' },
          currentColor: '{colors.x}',
        },
      },
    });
    bad(ProjectControlSchemas['tab-bar'], {
      parts: { hint: { assets: { nope: './assets/lb.svg' } } },
    });
  });
  test('asset paths', () => {
    const P = ProjectControlSchemas.carousel;
    const nav = (asset: string) => ({
      shape: 'path',
      parts: { nav: { asset }, pip: { asset } },
    });
    ok(P, nav('./assets/nav/arrow.svg'));
    for (const p of [
      './assets/../x.svg',
      './assets/A.svg',
      'assets/a.svg',
      './assets/a%2e.svg',
      './assets/a.png',
    ])
      bad(P, nav(p));
  });
  test('metadata and tokens', () => {
    ok(ProjectMetadataSchema, {
      formatVersion: 1,
      id: 'app.galapa.themes.abcdefghij0123456789',
      name: 'Anlucia',
      author: { name: 'Galapa Team', url: 'https://galapa.app/' },
      updates: null,
      previewImage: './assets/preview.png',
      chromeStyle: 'light',
    });
    bad(ProjectMetadataSchema, {
      formatVersion: 2,
      id: 'app.galapa.themes.x',
      name: 'a',
      author: { name: 'a' },
      updates: null,
      chromeStyle: 'light',
    });
    ok(ProjectTokensSchema, {});
    ok(ProjectTokensSchema, {
      colors: {
        bg: '#edfaf5',
        mix: {
          $type: 'mix',
          inputs: ['{colors.bg}', '#00000080'],
          amount: 0.5,
          space: 'lch',
        },
      },
      fonts: { heading: 'gfont:Space+Grotesk' },
      assets: { logo: './assets/logo.svg' },
      typography: {
        heading: {
          font: '{fonts.heading}',
          fontWeight: 700,
          fontAxes: { wdth: 90 },
          fontFeatures: { liga: true, ss03: 1 },
        },
      },
    });
    bad(ProjectTokensSchema, { colors: { BadName: '#000000' } });
  });
});

describe('compiled schemas', () => {
  test('complete theme with complete states', () => {
    const theme = {
      ...Object.fromEntries(Object.keys(CONTROL_CATALOG).map((k) => [k, {}])),
      button: {
        ...compiledButton,
        states: { focused: { ...compiledButtonState, showRing: true } },
      },
    };
    const B = CompiledThemeSchema.properties.button as TSchema;
    ok(B, theme.button);
    bad(B, { ...compiledButton, states: { focused: { showRing: true } } });
    bad(B, { ...compiledButton, states: { focused: compiledButtonState } });
    bad(B, {
      ...compiledButton,
      border: { color: '{colors.x}', thickness: [2, 2, 2, 2] },
    });
    bad(B, { ...compiledButton, padding: 2 });
    bad(CompiledThemeSchema, { ...theme, panel: undefined });
  });
  test('metadata omits formatVersion and $schema', () => {
    const m = {
      id: 'app.galapa.themes.abcdefghij0123456789',
      name: 'A',
      author: { name: 'G' },
      updates: {
        url: 'https://themes.galapa.app/x/download',
        frequency: 'daily',
      },
      chromeStyle: 'dark',
      previewImage: './assets/0123456789ab.jpg',
    };
    ok(CompiledMetadataSchema, m);
    bad(CompiledMetadataSchema, { ...m, formatVersion: 1 });
  });
});
