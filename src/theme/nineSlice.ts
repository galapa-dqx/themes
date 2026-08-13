import type { Edges } from './geometry';
import type { ThemeColors } from './themes';

/**
 * `.9.svg` profile parser.
 *
 * The profile (everything intrinsic to the art lives in the file):
 *  - nested `<svg id="col_row" x y width height>` viewports carry the slices;
 *    grid dimensions are inferred from the ids and must be 1 or 3 per axis
 *  - `<rect id="content">` marks the safe area for hosted content
 *  - `<rect id="frame">` marks the layout box; artwork outside it is outset
 *    (overdraw painted beyond the host's bounds, à la border-image-outset).
 *    Absent frame = the whole viewBox, i.e. no outset
 *  - root `viewBox` vs `width`/`height` is the authored→logical scale
 *  - hosts smaller than the caps must shrink ALL fixed tracks by the single
 *    border-image factor f = min(1, w/(left+right), h/(top+bottom)), so
 *    corners scale uniformly and never distort or letterbox
 *  - `preserveAspectRatio` per slice controls cap behaviour (default: none)
 *    where a region can stretch off-aspect: 3×1/1×3 caps, 1×1 stamps, and
 *    natural-size-centred edge ornaments
 *  - `data-slice-repeat` per slice: stretch (default), repeat, round or
 *    space — the CSS border-image-repeat vocabulary. Tiled slices ignore
 *    preserveAspectRatio
 *  - colours reference `var(--theme-*)` tokens, substituted against the
 *    palette at load (pre-substitution keeps us honest for the Skia port,
 *    which has no CSS cascade)
 */

export type RepeatMode = 'stretch' | 'repeat' | 'round' | 'space';

export const REPEAT_MODES: RepeatMode[] = ['stretch', 'repeat', 'round', 'space'];

export type SliceCell = {
  col: number;
  row: number;
  /** Logical size of this slice (authored units x root scale). */
  w: number;
  h: number;
  /** viewBox to render the slice with (authored, or derived local box). */
  vb: string;
  par: string;
  repeat: RepeatMode;
  markup: string;
};

export type SliceSet = {
  cols: number;
  rows: number;
  /** Fixed track sizes in logical px; null = stretch track. */
  colSizes: (number | null)[];
  rowSizes: (number | null)[];
  /** Content-box insets from the frame, logical px: [top, right, bottom, left]. */
  content: Edges;
  /** Painted overdraw beyond the frame, logical px: [top, right, bottom, left]. */
  outset: Edges;
  cells: SliceCell[];
  /** Non-fatal profile issues found while parsing. */
  warnings: string[];
};

export function substituteTokens(
  svgText: string,
  colors: ThemeColors,
  warnings?: string[],
): string {
  return svgText.replace(/var\(--theme-([a-z0-9-]+)\)/g, (_, role: string) => {
    const hex = colors[role as keyof ThemeColors];
    if (!hex) {
      const msg = `references unknown token --theme-${role}`;
      warnings?.push(msg);
      console.warn(`[theme] .9.svg ${msg}`);
      return '#ff00ff';
    }
    return hex;
  });
}

export function parseNineSlice(svgText: string, colors: ThemeColors): SliceSet {
  const warnings: string[] = [];
  const doc = new DOMParser().parseFromString(
    substituteTokens(svgText, colors, warnings),
    'image/svg+xml',
  );
  const root = doc.documentElement;
  if (root.tagName !== 'svg') throw new Error('not an SVG document');

  const viewBox = (root.getAttribute('viewBox') ?? '').split(/[\s,]+/).map(Number);
  if (viewBox.length !== 4 || viewBox.some(Number.isNaN)) {
    throw new Error('root must declare a viewBox');
  }
  const [minX, minY, vbW, vbH] = viewBox;
  const scale = (Number(root.getAttribute('width')) || vbW) / vbW;

  const sliceEls = [...root.querySelectorAll('svg[id]')].filter((el) =>
    /^\d+_\d+$/.test(el.id),
  );
  if (sliceEls.length === 0) throw new Error('no id="col_row" slices found');

  let cols = 0;
  let rows = 0;
  const cells: SliceCell[] = sliceEls.map((el) => {
    const [col, row] = el.id.split('_').map(Number);
    cols = Math.max(cols, col + 1);
    rows = Math.max(rows, row + 1);
    const vbCellW = Number(el.getAttribute('width'));
    const vbCellH = Number(el.getAttribute('height'));
    let repeat = (el.getAttribute('data-slice-repeat') ?? 'stretch') as RepeatMode;
    if (!REPEAT_MODES.includes(repeat)) {
      const msg = `slice ${el.id}: unknown data-slice-repeat="${repeat}"; using stretch`;
      warnings.push(msg);
      console.warn(`[theme] ${msg}`);
      repeat = 'stretch';
    }
    return {
      col,
      row,
      w: vbCellW * scale,
      h: vbCellH * scale,
      vb: el.getAttribute('viewBox') ?? `0 0 ${vbCellW} ${vbCellH}`,
      par: el.getAttribute('preserveAspectRatio') ?? 'none',
      repeat,
      markup: el.innerHTML,
    };
  });

  if (![1, 3].includes(cols) || ![1, 3].includes(rows)) {
    throw new Error(`grid must be 1 or 3 per axis, got ${cols}x${rows}`);
  }
  if (cells.length !== cols * rows) {
    throw new Error(`expected ${cols * rows} slices, found ${cells.length}`);
  }

  const trackSizes = (count: number, axis: 'w' | 'h') =>
    Array.from({ length: count }, (_, i) => {
      if (count === 1 || i === 1) return null; // stretch track
      const cell = cells.find((c) => (axis === 'w' ? c.col : c.row) === i);
      return cell ? cell[axis] : 0;
    });

  let frame = { x: minX, y: minY, w: vbW, h: vbH };
  const frameRect = doc.getElementById('frame');
  if (frameRect) {
    frame = {
      x: Number(frameRect.getAttribute('x')),
      y: Number(frameRect.getAttribute('y')),
      w: Number(frameRect.getAttribute('width')),
      h: Number(frameRect.getAttribute('height')),
    };
  }
  let outset: Edges = [
    (frame.y - minY) * scale,
    (minX + vbW - (frame.x + frame.w)) * scale,
    (minY + vbH - (frame.y + frame.h)) * scale,
    (frame.x - minX) * scale,
  ];
  if (outset.some((v) => v < 0)) {
    const msg = 'frame extends outside the viewBox; outset clamped to 0';
    warnings.push(msg);
    console.warn(`[theme] .9.svg ${msg}`);
    outset = outset.map((v) => Math.max(0, v)) as Edges;
  }

  let content: Edges = [0, 0, 0, 0];
  const contentRect = doc.getElementById('content');
  if (contentRect) {
    const x = Number(contentRect.getAttribute('x'));
    const y = Number(contentRect.getAttribute('y'));
    const w = Number(contentRect.getAttribute('width'));
    const h = Number(contentRect.getAttribute('height'));
    content = [
      (y - frame.y) * scale,
      (frame.x + frame.w - (x + w)) * scale,
      (frame.y + frame.h - (y + h)) * scale,
      (x - frame.x) * scale,
    ];
  }

  return {
    cols,
    rows,
    colSizes: trackSizes(cols, 'w'),
    rowSizes: trackSizes(rows, 'h'),
    content,
    outset,
    cells,
    warnings,
  };
}

const cache = new Map<string, Promise<SliceSet>>();

export function loadSliceSet(url: string, colors: ThemeColors): Promise<SliceSet> {
  const key = `${url}|${Object.values(colors).join(',')}`;
  let pending = cache.get(key);
  if (!pending) {
    pending = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`${res.status} fetching ${url}`);
        return res.text();
      })
      .then((text) => parseNineSlice(text, colors));
    pending.catch(() => cache.delete(key));
    cache.set(key, pending);
  }
  return pending;
}
