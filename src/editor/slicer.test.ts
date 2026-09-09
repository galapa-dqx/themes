// @vitest-environment jsdom
import { beforeAll, describe, expect, it } from 'vitest';
import { compileSvg } from '@/compiler/svg';
import { defaultSlicing, parseAsset, type Slicing } from './nineSlice';

const ART = `<svg xmlns="http://www.w3.org/2000/svg" width="80" height="40">
  <defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs>
  <rect width="80" height="40" rx="8" fill="{colors.bg}" stroke="currentColor" stroke-width="2"/>
  <circle cx="40" cy="20" r="6" fill="url(#g)" opacity=".5"/>
</svg>`;
const valid = (svg: string) =>
  compileSvg(svg, { profile: 'nine-slice', colors: { bg: '#123456' } });

let cutAsset: typeof import('./slicer').cutAsset;
beforeAll(async () => {
  // Paper.js wants a 2D context at load; jsdom has none, and geometry never draws.
  const ctx: Record<string, unknown> = {};
  HTMLCanvasElement.prototype.getContext = (() =>
    new Proxy(ctx, {
      get: (t, k) => (k in t ? t[k as string] : () => undefined),
      set: (t, k, v) => ((t[k as string] = v), true),
    })) as never;
  ({ cutAsset } = await import('./slicer'));
});

describe('slicer', () => {
  it('cuts artwork into a valid nine-slice, keeping token and keyword paints', () => {
    const asset = parseAsset(ART);
    const { text, warnings } = cutAsset({
      ...asset,
      slicing: defaultSlicing(asset.viewBox),
    });
    expect(valid(text).content).toEqual([10, 10, 60, 20]);
    expect(text.match(/<svg id="\d_\d"/g)).toHaveLength(9);
    expect(text).toContain('fill="{colors.bg}"');
    expect(text).toContain('fill="currentColor"');
    expect(text).not.toContain('stroke=');
    expect(warnings).toEqual(['gradient fill flattened to its first stop']);
    // Each cell only carries geometry that lies inside it.
    const corner = /<svg id="0_0"[^>]*>(.*?)<\/svg>/.exec(text)![1];
    expect(corner).not.toContain('currentColor'.repeat(2));
    expect(corner.match(/<path/g)!.length).toBeLessThanOrEqual(2);
  });

  it('re-opens its own output with the same slicing', () => {
    const asset = parseAsset(ART);
    const slicing: Slicing = {
      slices: { top: 8, right: 12, bottom: 8, left: 12 },
      overdraw: { top: 2, right: 2, bottom: 2, left: 2 },
      content: { top: 4, right: 10, bottom: 4, left: 10 },
      repeat: 'repeat',
    };
    const first = cutAsset({ ...asset, slicing }).text;
    expect(valid(first).content).toEqual([12, 6, 56, 28]);
    expect(first.match(/data-slice-repeat/g)).toHaveLength(5);
    const again = parseAsset(first);
    expect(again.slicing).toEqual(slicing);
    expect(() => valid(cutAsset(again).text)).not.toThrow();
  });

  it('supports 3x1 and 1x1 topologies and plain output', () => {
    const asset = parseAsset(ART);
    const base = defaultSlicing(asset.viewBox);
    const caps = cutAsset({
      ...asset,
      slicing: { ...base, slices: { top: 0, right: 10, bottom: 0, left: 10 } },
    }).text;
    expect(caps.match(/<svg id="\d_\d"/g)).toHaveLength(3);
    expect(() => valid(caps)).not.toThrow();
    const one = cutAsset({
      ...asset,
      slicing: { ...base, slices: { top: 0, right: 0, bottom: 0, left: 0 } },
    }).text;
    expect(one.match(/<svg id="\d_\d"/g)).toHaveLength(1);
    expect(() => valid(one)).not.toThrow();
    expect(cutAsset(asset).text).toBe(asset.art);
  });
});
