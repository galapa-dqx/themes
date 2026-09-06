import { describe, expect, it } from 'vitest';
import { ThemeCompilationError } from './diagnostics';
import { resolveTokens } from './tokens';

describe('resolveTokens', () => {
  it('resolves forward references across the complete graph', () => {
    const resolved = resolveTokens({
      colors: {
        foreground: '{colors.base}',
        base: '#123456',
      },
      fonts: {
        heading: '{fonts.source}',
        source: 'gfont:Space+Grotesk',
      },
      assets: {
        arrow: '{assets.source-arrow}',
        'source-arrow': './assets/arrow.svg',
      },
    });

    expect(resolved.tokens.colors.foreground).toBe('#123456');
    expect(resolved.tokens.fonts.heading).toBe('gfont:Space+Grotesk');
    expect(resolved.tokens.assets.arrow).toBe('./assets/arrow.svg');
  });

  it('resolves computed colors through other computed tokens', () => {
    const resolved = resolveTokens({
      colors: {
        start: '#ff0000',
        middle: {
          $type: 'mix',
          inputs: ['{colors.start}', '#0000ff'],
          amount: 0.5,
          space: 'oklab',
        },
        end: {
          $type: 'mix',
          inputs: ['{colors.middle}', '#ffffff'],
          amount: 0.25,
          space: 'oklch',
        },
      },
    });

    expect(resolved.tokens.colors.middle).toMatch(/^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/);
    expect(resolved.tokens.colors.end).not.toBe(resolved.tokens.colors.middle);
  });

  it('expands typography aliases and shallow extends before resolving fonts', () => {
    const resolved = resolveTokens({
      fonts: { heading: 'gfont:Space+Grotesk' },
      typography: {
        base: {
          font: '{fonts.heading}',
          fontWeight: 400,
          fontSize: 16,
        },
        strong: {
          $extends: '{typography.base}',
          fontWeight: 700,
        },
        alias: '{typography.strong}',
      },
    });

    expect(resolved.tokens.typography.alias).toEqual({
      font: 'gfont:Space+Grotesk',
      fontWeight: 700,
      fontSize: 16,
    });
  });

  it('reports the complete cycle', () => {
    expect(() =>
      resolveTokens({
        colors: {
          a: '{colors.b}',
          b: '{colors.c}',
          c: '{colors.a}',
        },
      }),
    ).toThrowError(ThemeCompilationError);

    try {
      resolveTokens({
        colors: {
          a: '{colors.b}',
          b: '{colors.a}',
        },
      });
    } catch (error) {
      expect((error as ThemeCompilationError).message).toContain(
        '{colors.a} → {colors.b} → {colors.a}',
      );
    }
  });

  it('rejects a reference to the wrong category', () => {
    expect(() =>
      resolveTokens({
        fonts: { heading: '{assets.heading}' },
      }),
    ).toThrowError(/Expected a fonts reference/);
  });
});

