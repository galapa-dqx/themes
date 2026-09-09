import { describe, expect, it } from 'vitest';
import { produce } from 'immer';
import {
  fontLabel,
  freeName,
  renameToken,
  replaceReferences,
  tokenView,
} from './tokenView';
import { newDocument } from './projectStore';

describe('tokenView', () => {
  it('resolves per token, isolating errors and cycles, and counts uses', () => {
    const doc = {
      ...newDocument('x'.repeat(20), 'T'),
      tokens: {
        colors: {
          bg: '#123456',
          accent: '{colors.bg}',
          bad: '{colors.nope}',
          a: '{colors.b}',
          b: '{colors.a}',
          muted: {
            $type: 'mix' as const,
            inputs: ['{colors.bg}', '#ffffff'] as [string, string],
            amount: 0.5,
            space: 'oklab' as const,
          },
        },
        fonts: { body: 'gfont:Space+Grotesk', alias: '{fonts.body}' },
        typography: {
          base: { font: '{fonts.alias}', fontSize: 12 },
          h: { $extends: '{typography.base}', fontWeight: 700 },
        },
      },
      controls: { panel: { shape: 'path' as const, fill: '{colors.accent}' } },
    };
    const v = tokenView(doc);
    const byName = Object.fromEntries(v.colors.map((r) => [r.name, r]));
    expect(byName.bg.resolved.value).toBe('#123456');
    expect(byName.accent.resolved.value).toBe('#123456');
    expect(byName.accent.used).toBe(1);
    expect(byName.accent.usedBy).toEqual(['panel']);
    expect(byName.bg.usedBy).toEqual([]);
    expect(byName.bg.used).toBe(2); // accent + mix input
    expect(byName.bad.resolved.error).toMatch(/unknown token nope/);
    expect(byName.a.resolved.error).toBe('Cycle: a → b → a');
    expect(byName.bg.usedByTokens).toEqual(['colors.accent', 'colors.muted']);
    expect(byName.muted.resolved.value).toMatch(/^#[0-9a-f]{6}$/);
    expect(v.typography.find((r) => r.name === 'h')?.resolved.value).toEqual({
      font: 'gfont:Space+Grotesk',
      fontSize: 12,
      fontWeight: 700,
    });
    expect(fontLabel('gfont:Space+Grotesk')).toBe('Space Grotesk');
    expect(fontLabel('./assets/sg.ttf')).toBe('sg.ttf');
    expect(freeName({ 'color-1': 1 }, 'color')).toBe('color-2');
  });
});

describe('renameToken', () => {
  it('moves the key and rewrites references in tokens and controls', () => {
    const doc = {
      ...newDocument('x'.repeat(20), 'T'),
      tokens: {
        colors: {
          bg: '#123456',
          accent: '{colors.bg}',
          muted: {
            $type: 'mix' as const,
            inputs: ['{colors.bg}', '#ffffff'] as [string, string],
            amount: 0.5,
            space: 'oklab' as const,
          },
        },
      },
      controls: {
        panel: { shape: 'path' as const, fill: '{colors.bg}' },
        window: { fill: '{colors.accent}' },
      },
    };
    const next = produce(doc, (d) => renameToken(d, 'colors', 'bg', 'base'));
    expect(next.tokens.colors).toEqual({
      accent: '{colors.base}',
      muted: {
        $type: 'mix',
        inputs: ['{colors.base}', '#ffffff'],
        amount: 0.5,
        space: 'oklab',
      },
      base: '#123456',
    });
    expect(next.controls.panel).toEqual({
      shape: 'path',
      fill: '{colors.base}',
    });
    expect(next.controls.window).toEqual({ fill: '{colors.accent}' });
  });
});

describe('replaceReferences', () => {
  it('repoints references without touching the token itself', () => {
    const doc = {
      ...newDocument('x'.repeat(20), 'T'),
      tokens: { colors: { a: '#111111', b: '#222222', c: '{colors.a}' } },
      controls: { panel: { shape: 'path' as const, fill: '{colors.a}' } },
    };
    const next = produce(doc, (d) => replaceReferences(d, 'colors', 'a', 'b'));
    expect(next.tokens.colors).toEqual({
      a: '#111111',
      b: '#222222',
      c: '{colors.b}',
    });
    expect(next.controls.panel).toEqual({ shape: 'path', fill: '{colors.b}' });
  });
});
