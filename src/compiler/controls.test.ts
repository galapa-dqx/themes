import { NodeFileSystem } from '@effect/platform-node';
import { Cause, Effect, Exit, Layer, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import { merge, resolveControls } from './controls';
import { CompileFailed, Diagnostics } from './diagnostics';
import { fixtureProject } from './fixtures';
import { loadProject } from './project';
import { resolveTokens, toHex } from './tokens';

const layer = Layer.merge(NodeFileSystem.layer, Diagnostics.Default);

const compile = (files: Record<string, unknown>) =>
  Effect.runPromiseExit(
    Effect.gen(function* () {
      const project = yield* loadProject(
        yield* fixtureProject(['full'], files),
      );
      const tokens = yield* resolveTokens(project.tokens);
      return yield* resolveControls(project, tokens);
    }).pipe(Effect.scoped, Effect.provide(layer)),
  );

const ok = async (files: Record<string, unknown>) => {
  const exit = await compile(files);
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
  return exit.value;
};
const errors = async (files: Record<string, unknown>) => {
  const exit = await compile(files);
  const err = Exit.isFailure(exit)
    ? Option.getOrThrow(Cause.failureOption(exit.cause))
    : undefined;
  expect(err).toBeInstanceOf(CompileFailed);
  return (err as CompileFailed).diagnostics
    .filter((d) => d.severity === 'error')
    .map((d) => `${d.file}${d.path}: ${d.message}`);
};

const button = {
  shape: 'path',
  border: { color: '{colors.bg}', thickness: 2 },
  padding: [6, 10, 6, 10],
  states: {
    focused: {
      showRing: false,
      border: {
        color: {
          $type: 'mix',
          inputs: ['{colors.bg}', '#000000'],
          amount: 0.5,
          space: 'srgb',
        },
      },
    },
    hover: { fill: '{colors.text}' },
    disabled: { opacity: 0.5 },
  },
  parts: {
    text: {
      color: '{colors.text}',
      typography: { $extends: '{typography.heading}', fontSize: 16 },
      states: { hover: { color: '#000000' } },
    },
  },
};

const plainText = {
  color: '#111111',
  typography: { font: 'gfont:X', fontWeight: 400, fontSize: 12 },
};

describe('merge', () => {
  it('merges plain objects and replaces arrays, scalars, and tagged values', () => {
    expect(
      merge(
        { a: { x: 1, y: [1, 2] }, m: { $type: 'mix', amount: 1 }, s: 1 },
        { a: { y: [3] }, m: { $type: 'mix', amount: 0 }, s: 2 },
      ),
    ).toEqual({ a: { x: 1, y: [3] }, m: { $type: 'mix', amount: 0 }, s: 2 });
  });
});

describe('resolveControls', () => {
  it('materializes defaults, expands shorthands, and merges complete states', async () => {
    const theme = await ok({ 'controls/button.json': button });
    const b = theme.button;
    expect(b.shape).toBe('path');
    expect(b.radius).toBe(0);
    expect(b.corner).toBe('round');
    expect(b.fill).toBe('none');
    expect(b.border!.thickness).toEqual([2, 2, 2, 2]);
    expect(toHex(b.border!.color as never)).toBe('#123456');
    expect(b.padding).toEqual([6, 10, 6, 10]);
    expect(b.opacity).toBe(1);

    const focused = b.states!.focused;
    expect(focused.showRing).toBe(false);
    expect(toHex(focused.border!.color as never)).toBe('#091a2b');
    expect(focused.border!.thickness).toEqual([2, 2, 2, 2]);
    expect(focused.padding).toEqual([6, 10, 6, 10]);
    const hover = b.states!.hover;
    expect(toHex(hover.fill as never)).toBe('#f5fdfa');
    expect(hover).not.toHaveProperty('showRing');
    expect(b.states!.disabled.opacity).toBe(0.5);

    const text = b.parts!.text;
    expect(text.typography).toEqual({
      font: 'gfont:Space+Grotesk',
      fontWeight: 400,
      fontStyle: 'normal',
      fontAxes: {},
      fontSize: 16,
      lineHeight: 1.4,
      letterSpacing: 0,
      fontFeatures: {},
      textCase: 'uppercase',
      textDecoration: [],
    });
    expect(toHex(text.states!.hover.color as never)).toBe('#000000');
    expect(text.states!.hover.typography).toEqual(text.typography);
  });

  it('applies catalog defaults for rings, insets, window, and images', async () => {
    const theme = await ok({});
    expect(theme['focus-ring']).toEqual({
      color: expect.anything(),
      width: 3,
      offset: -2,
    });
    expect(theme.window.borderColor).toBe('none');
    expect(theme.input.parts!.label.leftInset).toBe(12);
    expect(theme.input.parts!.value).not.toHaveProperty('leftInset');
    expect(theme.input.parts!.value.typography).not.toHaveProperty('textCase');
    expect(theme.carousel.parts!.nav.asset).toBe('./assets/dot.svg');
    expect(theme['tab-bar'].parts!.hint.assets).toEqual({});
    expect(theme['tab-bar']).not.toHaveProperty('opacity');
    expect(theme['play-row'].parts!.ornament.asset).toBe('./assets/tinted.svg');
  });

  it('overlays variant asset maps key by key', async () => {
    const theme = await ok({
      'controls/news-item.json': {
        shape: 'path',
        parts: {
          title: plainText,
          date: plainText,
          gem: {
            currentColor: '#000000',
            assets: { events: '{assets.dot}', news: './assets/dot.svg' },
            states: { hover: { assets: { news: '{assets.tinted}' } } },
          },
        },
      },
    });
    const gem = theme['news-item'].parts!.gem;
    expect(gem.assets).toEqual({
      events: './assets/dot.svg',
      news: './assets/dot.svg',
    });
    expect(gem.states!.hover.assets).toEqual(gem.assets);
  });

  it('reports typography and reference problems at their path', async () => {
    const text = (typography: unknown) => ({ color: '#000000', typography });
    expect(
      await errors({
        'controls/button.json': {
          shape: 'path',
          fill: '{colors.nope}',
          states: { hover: { border: { color: '{colors.nope2}' } } },
          parts: { text: text({ font: 'gfont:X', fontWeight: 400 }) },
        },
        'controls/input.json': {
          shape: 'path',
          parts: {
            label: text({
              $extends: '{typography.heading}',
              fontAxes: { wght: 1 },
            }),
            value: text('{typography.heading}'),
            placeholder: text({
              $extends: '{typography.heading}',
              fontStyle: 'italic',
              fontAxes: { slnt: -10 },
            }),
            caret: { color: '#000000' },
          },
        },
      }),
    ).toEqual([
      'controls/button.json/fill: unknown token {colors.nope}',
      'controls/button.json/parts/text/typography: typography is missing fontSize',
      'controls/input.json/parts/label/typography/fontAxes/wght: use fontWeight instead of the wght axis',
      'controls/input.json/parts/value/typography: editable text does not support textCase or textDecoration',
      'controls/input.json/parts/placeholder/typography/fontAxes: fontStyle and ital/slnt axes both set',
    ]);
  });
});
