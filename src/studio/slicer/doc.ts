/**
 * Slicer document model. A SlicerDoc is everything the studio slicer edits:
 * the unsliced artwork plus the cut geometry, all in the artwork's viewBox
 * units. sliceEngine.ts renders a doc to a `.9.svg`; importNineSliceDoc
 * reverses an existing file back into a doc for re-editing.
 */

import { REPEAT_MODES, type RepeatMode } from '@/theme/nineSlice';

export { REPEAT_MODES };
export type { RepeatMode };

export type BuildGrid = '3x3' | '3x1' | '1x3';
export type Box = { top: number; right: number; bottom: number; left: number };

export const ZERO_BOX: Box = { top: 0, right: 0, bottom: 0, left: 0 };

export type SlicerDoc = {
  /** Unsliced artwork (full SVG text; token colours allowed). */
  source: string;
  /** Authored→logical scale, re-emitted as root width/height on export. */
  scale: number;
  grid: BuildGrid;
  /** Cap band sizes, measured inward from the painted area's edges. */
  bands: Box;
  /** Outset: how far the painted area overhangs the layout frame. */
  outset: Box;
  /** Content-box insets, measured from the frame edges. */
  content: Box;
  /** data-slice-repeat per stretch cell, keyed "col_row". */
  repeat: Record<string, RepeatMode>;
  /** Aspect-locked cells (preserveAspectRatio="xMidYMid meet"), keyed "col_row". */
  aspect: Record<string, boolean>;
};

export type CellRect = {
  col: number;
  row: number;
  /** Position relative to the viewBox origin, in viewBox units. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** Whether the cell's grid track stretches on each axis. */
  stretchX: boolean;
  stretchY: boolean;
};

const SLICE_ID = /^(\d+)_(\d+)$/;

export function parseSvgRoot(source: string): Element {
  const dom = new DOMParser().parseFromString(source, 'image/svg+xml');
  if (dom.querySelector('parsererror')) throw new Error('SVG is not well-formed XML');
  const root = dom.documentElement;
  if (root.tagName !== 'svg') throw new Error('not an SVG document');
  return root;
}

export function parseViewBox(source: string): [number, number, number, number] {
  const root = parseSvgRoot(source);
  const vb = (root.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) {
    return vb as [number, number, number, number];
  }
  const w = Number(root.getAttribute('width'));
  const h = Number(root.getAttribute('height'));
  if (w > 0 && h > 0) return [0, 0, w, h];
  throw new Error('source needs a viewBox (or width/height)');
}

/** Child markup of the source's root svg, for direct display in a host svg. */
export function innerMarkup(source: string): string {
  try {
    return parseSvgRoot(source).innerHTML;
  } catch {
    return '';
  }
}

export function defaultDoc(source: string): SlicerDoc {
  let vb: [number, number, number, number] = [0, 0, 96, 96];
  let scale = 1;
  try {
    vb = parseViewBox(source);
    const width = Number(parseSvgRoot(source).getAttribute('width'));
    if (width > 0) scale = width / vb[2];
  } catch {
    // Engine/preview will surface the parse error; keep editable defaults.
  }
  const band = Math.max(1, Math.round(Math.min(vb[2], vb[3]) / 4));
  return {
    source,
    scale,
    grid: '3x3',
    bands: { top: band, right: band, bottom: band, left: band },
    outset: { ...ZERO_BOX },
    content: { top: band, right: band, bottom: band, left: band },
    repeat: {},
    aspect: {},
  };
}

/** Cell rectangles for the doc's grid, relative to the viewBox origin. */
export function cellRects(doc: SlicerDoc, w: number, h: number): CellRect[] {
  const threeCols = doc.grid !== '1x3';
  const threeRows = doc.grid !== '3x1';
  const xs = threeCols ? [0, doc.bands.left, w - doc.bands.right, w] : [0, w];
  const ys = threeRows ? [0, doc.bands.top, h - doc.bands.bottom, h] : [0, h];
  const cells: CellRect[] = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      cells.push({
        col,
        row,
        x: xs[col],
        y: ys[row],
        w: xs[col + 1] - xs[col],
        h: ys[row + 1] - ys[row],
        stretchX: threeCols ? col === 1 : true,
        stretchY: threeRows ? row === 1 : true,
      });
    }
  }
  return cells;
}

const NAMES_3X3 = [
  ['Top-left corner', 'Top edge', 'Top-right corner'],
  ['Left edge', 'Center', 'Right edge'],
  ['Bottom-left corner', 'Bottom edge', 'Bottom-right corner'],
];

export function cellName(cell: CellRect, grid: BuildGrid): string {
  if (grid === '3x3') return NAMES_3X3[cell.row][cell.col];
  if (grid === '3x1') return ['Left cap', 'Middle', 'Right cap'][cell.col];
  return ['Top cap', 'Middle', 'Bottom cap'][cell.row];
}

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Rebuild a SlicerDoc from an existing `.9.svg` so it can be re-edited. */
export function importNineSliceDoc(text: string): {
  doc: SlicerDoc;
  warnings: string[];
} {
  const warnings: string[] = [];
  const dom = new DOMParser().parseFromString(text, 'image/svg+xml');
  if (dom.querySelector('parsererror')) throw new Error('not well-formed XML');
  const root = dom.documentElement;
  if (root.tagName !== 'svg') throw new Error('not an SVG document');
  const vb = (root.getAttribute('viewBox') ?? '')
    .split(/[\s,]+/)
    .filter(Boolean)
    .map(Number);
  if (vb.length !== 4 || vb.some((n) => !Number.isFinite(n))) {
    throw new Error('root must declare a viewBox');
  }
  const [minX, minY, w, h] = vb;
  const widthAttr = Number(root.getAttribute('width'));
  const scale = widthAttr > 0 ? widthAttr / w : 1;

  type ImportCell = {
    col: number;
    row: number;
    x: number;
    y: number;
    w: number;
    h: number;
    vb: number[];
    el: Element;
  };
  const cells: ImportCell[] = [];
  for (const el of root.querySelectorAll('svg[id]')) {
    const m = SLICE_ID.exec(el.id);
    if (!m) continue;
    const cw = Number(el.getAttribute('width'));
    const ch = Number(el.getAttribute('height'));
    const cvb = (el.getAttribute('viewBox') ?? '')
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    cells.push({
      col: Number(m[1]),
      row: Number(m[2]),
      x: Number(el.getAttribute('x')) || 0,
      y: Number(el.getAttribute('y')) || 0,
      w: cw,
      h: ch,
      vb: cvb.length === 4 ? cvb : [0, 0, cw, ch],
      el,
    });
  }
  if (cells.length === 0) throw new Error('no id="col_row" slices found');
  const cols = Math.max(...cells.map((c) => c.col)) + 1;
  const rows = Math.max(...cells.map((c) => c.row)) + 1;
  if (![1, 3].includes(cols) || ![1, 3].includes(rows) || cols * rows === 1) {
    throw new Error(`grid must be 3×3, 3×1 or 1×3; got ${cols}×${rows}`);
  }
  if (cells.length !== cols * rows) {
    throw new Error(`expected ${cols * rows} slices, found ${cells.length}`);
  }
  const grid: BuildGrid = cols === 3 && rows === 3 ? '3x3' : cols === 3 ? '3x1' : '1x3';

  const at = (col: number, row: number) =>
    cells.find((c) => c.col === col && c.row === row)!;
  const bands: Box = {
    left: cols === 3 ? at(0, 0).w : 0,
    right: cols === 3 ? at(2, 0).w : 0,
    top: rows === 3 ? at(0, 0).h : 0,
    bottom: rows === 3 ? at(0, 2).h : 0,
  };

  const readRect = (id: string) => {
    const el = dom.getElementById(id);
    if (!el) return null;
    return {
      x: Number(el.getAttribute('x')) || 0,
      y: Number(el.getAttribute('y')) || 0,
      w: Number(el.getAttribute('width')) || 0,
      h: Number(el.getAttribute('height')) || 0,
    };
  };
  const frameR = readRect('frame') ?? { x: minX, y: minY, w, h };
  const outset: Box = {
    top: frameR.y - minY,
    right: minX + w - (frameR.x + frameR.w),
    bottom: minY + h - (frameR.y + frameR.h),
    left: frameR.x - minX,
  };
  if (Object.values(outset).some((v) => v < 0)) {
    warnings.push('frame extends outside the viewBox; outset clamped to 0');
    for (const side of ['top', 'right', 'bottom', 'left'] as const) {
      outset[side] = Math.max(0, outset[side]);
    }
  }
  const contentR = readRect('content');
  const content: Box = contentR
    ? {
        top: contentR.y - frameR.y,
        right: frameR.x + frameR.w - (contentR.x + contentR.w),
        bottom: frameR.y + frameR.h - (contentR.y + contentR.h),
        left: contentR.x - frameR.x,
      }
    : { ...ZERO_BOX };
  if (!contentR) warnings.push('no content rect; content insets default to 0');

  const repeat: Record<string, RepeatMode> = {};
  const aspect: Record<string, boolean> = {};
  for (const c of cells) {
    const key = `${c.col}_${c.row}`;
    const rep = c.el.getAttribute('data-slice-repeat');
    if (rep && rep !== 'stretch') {
      if ((REPEAT_MODES as string[]).includes(rep)) repeat[key] = rep as RepeatMode;
      else warnings.push(`slice ${key}: unknown repeat "${rep}" ignored`);
    }
    const par = c.el.getAttribute('preserveAspectRatio');
    if (par && par !== 'none') aspect[key] = true;
  }

  // Reassemble the unsliced artwork. Each cell's viewBox maps onto its rect;
  // emit a transform wrapper where that mapping isn't the identity. Files
  // from the old crop-style builder hold the full artwork in every cell, so
  // identical identity-mapped cells collapse to a single copy.
  const EPS = 1e-6;
  const sorted = [...cells].sort((a, b) => a.row - b.row || a.col - b.col);
  const firstMarkup = sorted[0].el.innerHTML;
  let identicalCrops = true;
  const parts = sorted.map((c) => {
    const [vx, vy, vw, vh] = c.vb;
    const sx = c.w / vw;
    const sy = c.h / vh;
    const tx = c.x - vx * sx;
    const ty = c.y - vy * sy;
    const identity =
      Math.abs(sx - 1) < EPS &&
      Math.abs(sy - 1) < EPS &&
      Math.abs(tx) < EPS &&
      Math.abs(ty) < EPS;
    if (!identity || c.el.innerHTML !== firstMarkup) identicalCrops = false;
    if (identity) return c.el.innerHTML;
    const scalePart =
      Math.abs(sx - 1) < EPS && Math.abs(sy - 1) < EPS
        ? ''
        : ` scale(${fmt(sx)} ${fmt(sy)})`;
    return `<g transform="translate(${fmt(tx)} ${fmt(ty)})${scalePart}">${c.el.innerHTML}</g>`;
  });
  const inner = identicalCrops ? [firstMarkup] : parts;
  const source = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${w} ${h}">`,
    ...inner.map((p) => `  ${p.trim()}`),
    '</svg>',
    '',
  ].join('\n');

  return {
    doc: { source, scale, grid, bands, outset, content, repeat, aspect },
    warnings,
  };
}

export type PaletteEntry =
  | { kind: 'literal'; value: string }
  | { kind: 'token'; role: string };

const COLOR_ATTRS = ['fill', 'stroke', 'stop-color'];
const NON_COLORS = new Set([
  'none',
  'transparent',
  'currentcolor',
  'inherit',
  'context-fill',
  'context-stroke',
]);

/** Every distinct paint in the artwork: theme tokens and literal colours. */
export function extractPalette(source: string): PaletteEntry[] {
  let root: Element;
  try {
    root = parseSvgRoot(source);
  } catch {
    return [];
  }
  const seen = new Map<string, PaletteEntry>();
  const add = (raw: string | null) => {
    const value = raw?.trim();
    if (!value) return;
    const lower = value.toLowerCase();
    if (NON_COLORS.has(lower) || lower.startsWith('url(')) return;
    const token = /^var\(--color-([a-z0-9-]+)\)$/.exec(lower);
    const key = token ? `t:${token[1]}` : `l:${lower}`;
    if (!seen.has(key)) {
      seen.set(
        key,
        token ? { kind: 'token', role: token[1] } : { kind: 'literal', value },
      );
    }
  };
  for (const el of [root, ...root.querySelectorAll('*')]) {
    for (const attr of COLOR_ATTRS) add(el.getAttribute(attr));
    const style = el.getAttribute('style');
    if (!style) continue;
    for (const decl of style.split(';')) {
      const [prop, ...rest] = decl.split(':');
      if (prop && COLOR_ATTRS.includes(prop.trim().toLowerCase())) {
        add(rest.join(':'));
      }
    }
  }
  return [...seen.values()];
}

/** Swap one paint value for another wherever it's used as a colour. */
export function replaceColor(source: string, from: string, to: string): string {
  const esc = from.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return source
    .replace(new RegExp(`(=\\s*"\\s*)${esc}(\\s*")`, 'gi'), `$1${to}$2`)
    .replace(new RegExp(`(=\\s*'\\s*)${esc}(\\s*')`, 'gi'), `$1${to}$2`)
    .replace(new RegExp(`(:\\s*)${esc}(\\s*[;"'])`, 'gi'), `$1${to}$2`);
}
