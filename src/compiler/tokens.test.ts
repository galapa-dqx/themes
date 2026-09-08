import { Cause, Effect, Exit, Option } from 'effect';
import { describe, expect, it } from 'vitest';
import type { Static } from 'typebox';
import type { ColorMix, ProjectTokens } from '@/theme/schema';
import { CompileFailed, Diagnostics } from './diagnostics';
import { resolveTokens, toHex, TokenError } from './tokens';

type Mix = Static<typeof ColorMix>;

const resolve = (tokens: ProjectTokens) =>
  Effect.runPromiseExit(
    resolveTokens(tokens).pipe(Effect.provide(Diagnostics.Default)),
  );
const ok = async (tokens: ProjectTokens) => {
  const exit = await resolve(tokens);
  if (Exit.isFailure(exit)) throw Cause.squash(exit.cause);
  return exit.value;
};
const errors = async (tokens: ProjectTokens) => {
  const exit = await resolve(tokens);
  const err = Exit.isFailure(exit)
    ? Option.getOrThrow(Cause.failureOption(exit.cause))
    : undefined;
  expect(err).toBeInstanceOf(CompileFailed);
  return (err as CompileFailed).diagnostics.map(
    (d) => `${d.path}: ${d.message}`,
  );
};

const mix = (
  a: string,
  b: string,
  amount: number,
  space: Mix['space'] = 'srgb',
): Mix => ({ $type: 'mix', inputs: [a, b], amount, space });

describe('resolveTokens', () => {
  it('resolves forward references and chained mixes', async () => {
    const t = await ok({
      colors: {
        a: '{colors.b}',
        b: mix('{colors.c}', '#ffffff', 0.5),
        c: '#000000',
        d: mix('{colors.b}', '#000000', 1),
      },
    });
    expect(toHex(t.color('{colors.a}'))).toBe('#808080');
    expect(toHex(t.color('{colors.d}'))).toBe('#000000');
    expect(toHex(t.color(mix('{colors.c}', '#ffffff', 0)))).toBe('#000000');
  });

  it('premultiplies alpha but not hue, and keeps alpha in the output', async () => {
    const t = await ok({});
    expect(toHex(t.color(mix('#ff000000', '#0000ffff', 0.5)))).toBe(
      '#0000ff80',
    );
    // Shorter hue path between red (h=29) and blue (h=264) in oklch goes via magenta.
    const h = t.color(mix('#ff0000', '#0000ff', 0.5, 'oklch')) as {
      h?: number;
    };
    expect(((h.h! % 360) + 360) % 360).toBeCloseTo(326.6, 0);
  });

  it('gamut-maps out-of-sRGB results at the boundary', async () => {
    const t = await ok({});
    // Mixing in lab can overshoot sRGB; result must still be a valid hex.
    const hex = toHex(t.color(mix('#00ff00', '#ff00ff', 0.5, 'lab')));
    expect(hex).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('resolves fonts, assets, and typography through aliases and $extends', async () => {
    const t = await ok({
      fonts: { body: 'gfont:Inter', alias: '{fonts.body}' },
      assets: { dot: './assets/dot.svg', alias: '{assets.dot}' },
      typography: {
        base: { font: '{fonts.alias}', fontWeight: 400, fontSize: 12 },
        heading: { $extends: '{typography.base}', fontWeight: 700 },
        loud: { $extends: '{typography.heading}', textCase: 'uppercase' },
      },
    });
    expect(t.font('{fonts.alias}')).toBe('gfont:Inter');
    expect(t.font('./assets/x.ttf')).toBe('./assets/x.ttf');
    expect(t.asset('{assets.alias}')).toBe('./assets/dot.svg');
    expect(t.typography('{typography.loud}')).toEqual({
      font: 'gfont:Inter',
      fontWeight: 700,
      fontSize: 12,
      textCase: 'uppercase',
    });
    expect(
      t.typography({ $extends: '{typography.base}', fontSize: 20 }),
    ).toEqual({ font: 'gfont:Inter', fontWeight: 400, fontSize: 20 });
    expect(() => t.color('{colors.nope}')).toThrow(TokenError);
  });

  it('reports cycles with their chain, unknown tokens, and category mismatches', async () => {
    expect(
      await errors({
        colors: {
          a: '{colors.b}',
          b: mix('{colors.c}', '#000000', 0.5),
          c: '{colors.a}',
          lone: '{colors.missing}',
        },
        fonts: { f: '{fonts.f}' },
        typography: {
          x: { $extends: '{typography.y}' },
          y: { $extends: '{typography.x}' },
          z: { font: '{fonts.nope}' },
        },
      }),
    ).toEqual([
      '/colors/c: reference cycle: {colors.a} -> {colors.b} -> {colors.c} -> {colors.a}',
      '/colors/lone: unknown token {colors.missing}',
      '/fonts/f: reference cycle: {fonts.f} -> {fonts.f}',
      '/typography/y/$extends: reference cycle: {typography.x} -> {typography.y} -> {typography.x}',
      '/typography/z/font: unknown token {fonts.nope}',
    ]);
    expect(await errors({ colors: { a: '{assets.a}' as never } })).toEqual([
      '/colors/a: expected a colors reference, got {assets.a}',
    ]);
  });
});
