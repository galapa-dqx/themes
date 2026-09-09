import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { CONTROL_CATALOG } from '@/theme/catalog';
import { newDocument, type Document } from '@/editor/projectStore';
import { focusRingOf, MAGENTA, resolveView, statesOf } from './resolve';

const json = (path: string) =>
  JSON.parse(readFileSync(`themes/anlucia/${path}`, 'utf8'));
const anlucia: Document = {
  ...newDocument('a'.repeat(20), 'Anlucia'),
  tokens: json('tokens.json'),
  controls: {
    button: json('controls/button.json'),
    input: json('controls/input.json'),
    'focus-ring': json('controls/focus-ring.json'),
  },
};

describe('resolveView', () => {
  it('merges states and applies defaults', () => {
    const base = resolveView(anlucia, 'button', 'default');
    if (base.kind !== 'frame' || base.frame.shape !== 'path') throw new Error();
    expect(base.frame.fill).toBe('#b87228');
    expect(base.frame.radius).toBe('pill');
    expect(base.frame.padding).toEqual([6, 20, 6, 20]);
    expect(base.frame.border).toEqual({
      color: 'none',
      thickness: [0, 0, 0, 0],
    });
    const hover = resolveView(anlucia, 'button', 'hover');
    if (hover.kind !== 'frame' || hover.frame.shape !== 'path')
      throw new Error();
    expect(hover.frame.fill).toMatch(/^#[0-9a-f]{6}$/);
    expect(hover.frame.fill).not.toBe('#b87228');
    expect(hover.frame.radius).toBe('pill');
    const disabled = resolveView(anlucia, 'button', 'disabled');
    if (disabled.kind !== 'frame') throw new Error();
    expect(disabled.frame.opacity).toBe(0.5);
    expect(disabled.showRing).toBeUndefined();
    const text = base.parts.text;
    if (text.kind !== 'text') throw new Error();
    expect(text.text.color).toBe('#fffaf3');
    expect(text.text.typography).toMatchObject({
      font: 'gfont:Crimson+Pro',
      fontWeight: 700,
      fontSize: 16,
      textCase: 'uppercase',
    });
  });

  it('honours showRing and per-part defaults', () => {
    const focused = resolveView(anlucia, 'input', 'focused');
    if (focused.kind !== 'frame' || focused.frame.shape !== 'path')
      throw new Error();
    expect(focused.showRing).toBe(false);
    expect(focused.frame.border.thickness).toEqual([2, 2, 2, 2]);
    expect(focused.frame.border.color).toBe('#b87228');
    const label = focused.parts.label;
    if (label.kind !== 'text') throw new Error();
    expect(label.text.leftInset).toBe(10);
    expect(resolveView(anlucia, 'input', 'default').showRing).toBeUndefined();
  });

  it('paints missing references magenta and keeps absent values absent', () => {
    const doc: Document = {
      ...anlucia,
      controls: {
        panel: { shape: 'path', fill: '{colors.nope}' },
        'news-item': {
          shape: 'path',
          parts: { gem: { assets: { events: '{assets.nope}' } } },
        } as never,
      },
    };
    const panel = resolveView(doc, 'panel', 'default');
    if (panel.kind !== 'frame' || panel.frame.shape !== 'path')
      throw new Error();
    expect(panel.frame.fill).toBe(MAGENTA);
    const gem = resolveView(doc, 'news-item', 'default').parts.gem;
    if (gem.kind !== 'variant-image') throw new Error();
    expect(gem.variant.assets.events).toBeUndefined();
    expect(gem.variant.builtin.events).toContain('<svg');
    expect(gem.variant.size).toEqual({ width: 14, height: 14 });
    const title = resolveView(doc, 'news-item', 'default').parts.title;
    if (title.kind !== 'text') throw new Error();
    expect(title.text.color).toBeUndefined();
    expect(focusRingOf(doc)).toEqual({ color: MAGENTA, width: 2, offset: -2 });
    expect(focusRingOf(anlucia)).toEqual({
      color: '#b87228',
      width: 2,
      offset: -2,
    });
  });

  it('unions part states for composites', () => {
    expect(statesOf(CONTROL_CATALOG.switch)).toEqual([
      'hover',
      'pressed',
      'focused',
      'checked',
      'disabled',
    ]);
    expect(statesOf(CONTROL_CATALOG.carousel)).toEqual([
      'hover',
      'pressed',
      'focused',
      'selected',
    ]);
    expect(statesOf(CONTROL_CATALOG.panel)).toEqual([]);
  });
});
