/**
 * The default cover: a mock window painted from the theme's own window,
 * titlebar, panel, and button fills. `coverSvg` is pure so Node can bake the
 * first-party covers (scripts/covers.ts); the compiler rasterizes it.
 */
import type { RootControlId } from '@/theme/catalog';
import { resolveView } from './preview/resolve';
import type { Document } from './projectStore';

export const COVER_PATH = './assets/preview.svg';
export const COVER_SIZE = { width: 800, height: 600 } as const;

/** Fills for the cover mock: window, titlebar, panel, button, radius. */
export const coverOf = (doc: Document) => {
  const hex = (v: string | undefined) =>
    v && v !== 'none' && v !== '#ff00ff' ? v : undefined;
  const fill = (id: RootControlId) => {
    const v = resolveView(doc, id, 'default');
    return v.kind === 'frame' && v.frame.shape === 'path'
      ? { fill: hex(v.frame.fill), radius: v.frame.radius }
      : undefined;
  };
  const win = resolveView(doc, 'window', 'default');
  const dark = doc.metadata.chromeStyle === 'dark';
  const panel = fill('panel');
  const button = fill('button');
  const radius = button?.radius ?? panel?.radius ?? 4;
  return {
    bg:
      (win.kind === 'window' && hex(win.window.fill)) ||
      (dark ? '#1f2125' : '#e9eef6'),
    bar:
      fill('titlebar')?.fill ?? panel?.fill ?? (dark ? '#2b2e34' : '#ffffff'),
    panel: panel?.fill ?? (dark ? '#2b2e34' : '#ffffff'),
    accent: button?.fill ?? '#3b6fd6',
    border:
      (win.kind === 'window' && hex(win.window.borderColor)) || 'transparent',
    radius: radius === 'pill' ? 12 : Math.min(radius, 12),
  };
};

/** The 5a card mock as an SVG: a bar over three blocks, the middle one accented. */
export const coverSvg = (doc: Document) => {
  const c = coverOf(doc);
  const { width: w, height: h } = COVER_SIZE;
  // Proportions of the 4:3 card mock, scaled 4x.
  const pad = { x: 72, y: 56 };
  const bar = 88;
  const gap = 40;
  const top = pad.y + bar + gap;
  const colW = Math.round((w - pad.x * 2 - 32 * 2) / 3);
  const r = c.radius * 4;
  const rect = (x: number, y: number, rw: number, rh: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${rw}" height="${rh}" rx="${r}" fill="${fill}" stroke="${c.border}" stroke-width="4"/>`;
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">` +
    `<rect width="${w}" height="${h}" fill="${c.bg}"/>` +
    rect(pad.x, pad.y, w - pad.x * 2, bar, c.bar) +
    [c.panel, c.accent, c.panel]
      .map((fill, i) =>
        rect(pad.x + i * (colW + 32), top, colW, h - top - pad.y, fill),
      )
      .join('') +
    `</svg>`
  );
};
