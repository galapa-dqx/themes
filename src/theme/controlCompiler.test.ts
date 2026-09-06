import { describe, expect, it } from 'vitest';
import { CONTROL_CATALOG, type CatalogControl } from './catalog';
import {
  compileThemeControls,
  type ThemeResourceCompiler,
} from './controlCompiler';
import type { ProjectModel } from './schema';
import { resolveTokens } from './tokens';
import { validateCompiledTheme } from './validation';

const fontPath = './assets/fonts/0123456789ab.ttf';
const svgPath = './assets/0123456789ab.svg';

const resources: ThemeResourceCompiler = {
  compileAsset: async () => ({ path: svgPath, usesCurrentColor: false }),
  compileBuiltInAsset: async () => ({
    path: svgPath,
    usesCurrentColor: true,
  }),
  compileFont: async () => fontPath,
};

function control(entry: CatalogControl): Record<string, unknown> {
  let value: Record<string, unknown>;
  switch (entry.kind) {
    case 'composite':
      value = {};
      break;
    case 'window':
      value = { fill: '#101010' };
      break;
    case 'focus-ring':
      value = { color: '#ff00ff' };
      break;
    case 'frame':
      value = { shape: 'path' };
      break;
    case 'text':
      value = {
        color: '#ffffff',
        typography: {
          font: '{fonts.body}',
          fontWeight: 400,
          fontSize: 14,
        },
      };
      break;
    case 'paint':
      value = { color: '#ffffff' };
      break;
    case 'image':
      value = entry.assetRequired ? { asset: './assets/art.svg' } : {};
      break;
    case 'variant-image':
      value = { currentColor: '#ffffff' };
      break;
  }
  if (entry.parts) {
    value.parts = Object.fromEntries(
      Object.entries(entry.parts)
        .filter(([, part]) => part.required)
        .map(([name, part]) => [name, control(part)]),
    );
  }
  return value;
}

function project(): ProjectModel {
  return {
    metadata: {
      formatVersion: 1,
      id: 'app.galapa.themes.0123456789abcdefghij',
      name: 'Compiler test',
      author: { name: 'Galapa' },
      updates: null,
      chromeStyle: 'dark',
    },
    tokens: { fonts: { body: 'gfont:Inter' } },
    controls: Object.fromEntries(
      Object.entries(CONTROL_CATALOG)
        .filter(([, entry]) => entry.required)
        .map(([id, entry]) => [id, control(entry)]),
    ),
  };
}

describe('compileThemeControls', () => {
  it('materializes defaults, built-in variants, and typography', async () => {
    const source = project();
    const result = await compileThemeControls(
      source,
      resolveTokens(source.tokens),
      resources,
    );

    expect(result.controls.panel).toMatchObject({
      shape: 'path',
      radius: 0,
      corner: 'round',
      fill: 'none',
      border: { color: 'none', thickness: [0, 0, 0, 0] },
      padding: [0, 0, 0, 0],
      opacity: 1,
    });
    expect(result.controls.button).toMatchObject({
      parts: {
        text: {
          color: '#ffffff',
          typography: {
            font: fontPath,
            fontWeight: 400,
            fontStyle: 'normal',
            fontSize: 14,
            lineHeight: 1,
            letterSpacing: 0,
            textCase: 'none',
            textDecoration: [],
            fontFeatures: {},
          },
        },
      },
    });
    expect(result.controls['tab-bar']).toMatchObject({
      parts: {
        hint: {
          assets: {
            'left-bumper': svgPath,
            'right-bumper': svgPath,
            'left-trigger': svgPath,
            'right-trigger': svgPath,
          },
        },
      },
    });
    expect(validateCompiledTheme(result.controls)).toEqual([]);
  });

  it('deep-merges a project state and emits a complete state surface', async () => {
    const source = project();
    source.controls.button = {
      ...(source.controls.button as Record<string, unknown>),
      shape: 'path',
      border: { color: '#ff0000', thickness: 2 },
      states: { hover: { border: { color: '#00ff00' } } },
    };
    const result = await compileThemeControls(
      source,
      resolveTokens(source.tokens),
      resources,
    );
    expect(result.controls.button).toMatchObject({
      states: {
        hover: {
          radius: 0,
          corner: 'round',
          fill: 'none',
          border: { color: '#00ff00', thickness: [2, 2, 2, 2] },
          opacity: 1,
        },
      },
    });
  });
});

