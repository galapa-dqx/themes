import paper from 'paper';
import { offsetStroke } from 'paperjs-offset';
import { cellRects, parseViewBox, type SlicerDoc } from './doc';

/**
 * Paper.js slicing engine: turns a SlicerDoc into a `.9.svg` by really
 * cutting the artwork. Strokes are first outlined into fills (paperjs-offset)
 * so cuts land exactly on cell boundaries, then every filled path is
 * intersected with each cell rect. Each slice therefore carries only its own
 * geometry — unlike the old crop-style builder, which embedded the whole
 * artwork nine times behind per-cell viewBox crops.
 *
 * Theme tokens can't survive a trip through Paper.js (colours are parsed),
 * so `var(--color-*)` references are swapped for sentinel colours up front
 * and restored in the emitted text.
 */

export type SliceResult = { text: string; warnings: string[] };

const SVG_NS = 'http://www.w3.org/2000/svg';

let paperReady = false;
function paperProject(): paper.Project {
  if (!paperReady) {
    paper.setup(new paper.Size(8, 8));
    paperReady = true;
  }
  paper.project.clear();
  return paper.project;
}

function tokenSentinels(source: string) {
  const roles = [
    ...new Set(
      [...source.matchAll(/var\(--color-([a-z0-9-]+)\)/g)].map((m) => m[1]),
    ),
  ];
  const lower = source.toLowerCase();
  const map: { role: string; hex: string }[] = [];
  let n = 0;
  for (const role of roles) {
    let hex: string;
    do {
      n += 1;
      hex = `#01${((n >> 8) & 255).toString(16).padStart(2, '0')}${(n & 255)
        .toString(16)
        .padStart(2, '0')}`;
    } while (lower.includes(hex));
    map.push({ role, hex });
  }
  const prepared = source.replace(
    /var\(--color-([a-z0-9-]+)\)/g,
    (_, role: string) => map.find((m) => m.role === role)!.hex,
  );
  // Paper may emit sentinels back as hex or rgb(); restore both spellings.
  const restore = (text: string) =>
    map.reduce((acc, { role, hex }) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      const token = `var(--color-${role})`;
      return acc
        .replace(new RegExp(hex, 'gi'), token)
        .replaceAll(`rgb(${r},${g},${b})`, token)
        .replaceAll(`rgb(${r}, ${g}, ${b})`, token);
    }, text);
  return { prepared, restore };
}

/** Root-relative import prep: shift a non-zero viewBox origin to 0 0 and
 *  drop the root width/height so Paper imports geometry 1:1. */
function normalizeForImport(svgText: string, minX: number, minY: number, w: number, h: number): string {
  const dom = new DOMParser().parseFromString(svgText, 'image/svg+xml');
  if (dom.querySelector('parsererror')) throw new Error('source SVG is not well-formed');
  const root = dom.documentElement;
  root.removeAttribute('width');
  root.removeAttribute('height');
  root.setAttribute('viewBox', `0 0 ${w} ${h}`);
  if (minX !== 0 || minY !== 0) {
    const g = dom.createElementNS(SVG_NS, 'g');
    g.setAttribute('transform', `translate(${-minX} ${-minY})`);
    while (root.firstChild) g.appendChild(root.firstChild);
    root.appendChild(g);
  }
  return new XMLSerializer().serializeToString(root);
}

function flattenColor(
  color: paper.Color | null,
  warnings: Set<string>,
): paper.Color | null {
  if (!color) return null;
  if (color.type === 'gradient') {
    warnings.add('gradient fill flattened to its first stop');
    return color.gradient.stops[0].color;
  }
  return color;
}

type Piece = { item: paper.PathItem; opacity: number };

function collectPieces(
  root: paper.Item,
  w: number,
  h: number,
  warnings: Set<string>,
): Piece[] {
  const pieces: Piece[] = [];
  // Paper models the imported svg's viewport as a clip mask; that one is
  // redundant here (we clip to cells anyway) and shouldn't warn.
  const isViewportMask = (item: paper.Item) => {
    const b = item.bounds;
    return (
      Math.abs(b.x) < 0.01 &&
      Math.abs(b.y) < 0.01 &&
      Math.abs(b.width - w) < 0.01 &&
      Math.abs(b.height - h) < 0.01
    );
  };
  const visit = (item: paper.Item, opacity: number) => {
    const eff = opacity * (item.opacity ?? 1);
    switch (item.className) {
      case 'Group':
      case 'Layer': {
        for (const child of item.children ?? []) {
          if (child.clipMask) {
            if (!isViewportMask(child)) {
              warnings.add('clipping masks are not supported; mask ignored');
            }
            continue;
          }
          visit(child, eff);
        }
        break;
      }
      case 'Shape':
        visit((item as paper.Shape).toPath(false), eff);
        break;
      case 'Path':
      case 'CompoundPath': {
        const path = item as paper.Path | paper.CompoundPath;
        const fill = flattenColor(path.fillColor, warnings);
        const stroke = flattenColor(path.strokeColor, warnings);
        if (fill) {
          const clone = path.clone({ insert: false }) as paper.PathItem;
          clone.strokeColor = null;
          clone.fillColor = fill;
          pieces.push({ item: clone, opacity: eff });
        }
        if (stroke && (path.strokeWidth ?? 0) > 0) {
          if (path.dashArray?.length) {
            warnings.add('dashed strokes are outlined as solid');
          }
          let cap = path.strokeCap;
          if (cap === 'square') {
            warnings.add('square stroke caps are outlined as butt caps');
            cap = 'butt';
          }
          try {
            const outline = offsetStroke(path, path.strokeWidth / 2, {
              join: path.strokeJoin as 'miter' | 'bevel' | 'round',
              cap: cap as 'butt' | 'round',
              insert: false,
            });
            outline.fillColor = stroke;
            outline.strokeColor = null;
            pieces.push({ item: outline, opacity: eff });
          } catch {
            warnings.add('a stroke could not be outlined; it was skipped');
          }
        }
        break;
      }
      default:
        warnings.add(`${item.className} elements cannot be sliced; skipped`);
    }
  };
  visit(root, 1);
  return pieces;
}

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Attributes Paper emits at their SVG defaults; pure noise in the output. */
const JUNK_ATTRS = ['font-family', 'font-weight', 'font-size', 'text-anchor'];
const STROKE_ATTRS = [
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
];

function exportPiece(item: paper.PathItem): string {
  const el = item.exportSVG({ precision: 4 }) as SVGElement;
  const clean = (node: Element) => {
    node.removeAttribute('xmlns');
    for (const attr of JUNK_ATTRS) {
      if (node.getAttribute(attr) === 'none') node.removeAttribute(attr);
    }
    if (node.getAttribute('style') === 'mix-blend-mode: normal') {
      node.removeAttribute('style');
    }
    if (node.getAttribute('stroke-dasharray') === '') {
      node.removeAttribute('stroke-dasharray');
    }
    if ((node.getAttribute('stroke') ?? 'none') === 'none') {
      for (const attr of STROKE_ATTRS) node.removeAttribute(attr);
    }
    for (const child of node.children) clean(child);
  };
  clean(el);
  return el.outerHTML;
}

export function sliceNineSvg(doc: SlicerDoc): SliceResult {
  const warnings = new Set<string>();
  const [minX, minY, w, h] = parseViewBox(doc.source);

  const threeCols = doc.grid !== '1x3';
  const threeRows = doc.grid !== '3x1';
  const { left, right, top, bottom } = doc.bands;
  if (threeCols && left + right >= w) {
    throw new Error(`left+right bands (${left}+${right}) must be < width (${w})`);
  }
  if (threeRows && top + bottom >= h) {
    throw new Error(`top+bottom bands (${top}+${bottom}) must be < height (${h})`);
  }
  const o = doc.outset;
  const frame = {
    x: o.left,
    y: o.top,
    w: w - o.left - o.right,
    h: h - o.top - o.bottom,
  };
  if (frame.w <= 0 || frame.h <= 0) throw new Error('outsets exceed the artwork size');
  const c = doc.content;
  const content = {
    x: frame.x + c.left,
    y: frame.y + c.top,
    w: frame.w - c.left - c.right,
    h: frame.h - c.top - c.bottom,
  };
  if (content.w < 0 || content.h < 0) {
    throw new Error('content insets exceed the frame size');
  }

  const { prepared, restore } = tokenSentinels(doc.source);
  const project = paperProject();
  const imported = project.importSVG(
    normalizeForImport(prepared, minX, minY, w, h),
    { expandShapes: true },
  );
  if (!imported) throw new Error('Paper.js could not import the source SVG');

  const pieces = collectPieces(imported, w, h, warnings);
  if (pieces.length === 0) warnings.add('no sliceable geometry found');

  const cellLines: string[] = [];
  // Clip a hair outside the cell: exactly-coincident edges send Paper's
  // boolean ops degenerate, and the slice's viewport crops the overhang
  // at render time anyway.
  const CLIP_EPS = 0.01;
  for (const cell of cellRects(doc, w, h)) {
    const clip = new paper.Path.Rectangle({
      point: [cell.x - CLIP_EPS, cell.y - CLIP_EPS],
      size: [cell.w + CLIP_EPS * 2, cell.h + CLIP_EPS * 2],
      insert: false,
    });
    const parts: string[] = [];
    for (const { item, opacity } of pieces) {
      let part: paper.PathItem;
      try {
        part = item.intersect(clip, { insert: false });
      } catch {
        warnings.add('a path could not be intersected with a cell; skipped');
        continue;
      }
      const area = (part as paper.Path | paper.CompoundPath).area ?? 0;
      if (part.isEmpty() || Math.abs(area) < 1e-6) {
        part.remove();
        continue;
      }
      if (opacity < 1) part.opacity = opacity;
      parts.push(exportPiece(part));
      part.remove();
    }
    const key = `${cell.col}_${cell.row}`;
    const rep = doc.repeat[key];
    const attrs = [
      (cell.stretchX || cell.stretchY) && rep && rep !== 'stretch'
        ? ` data-slice-repeat="${rep}"`
        : '',
      // Tiled slices ignore preserveAspectRatio; don't emit a dead attribute
      // (covers imported files that carried both).
      (!cell.stretchX || !cell.stretchY) &&
      doc.aspect[key] &&
      (rep ?? 'stretch') === 'stretch'
        ? ' preserveAspectRatio="xMidYMid meet"'
        : '',
    ].join('');
    cellLines.push(
      [
        `  <svg id="${key}" x="${fmt(cell.x)}" y="${fmt(cell.y)}" width="${fmt(cell.w)}" height="${fmt(cell.h)}" viewBox="${fmt(cell.x)} ${fmt(cell.y)} ${fmt(cell.w)} ${fmt(cell.h)}"${attrs}>`,
        ...parts.map((p) => `    ${p}`),
        '  </svg>',
      ].join('\n'),
    );
  }
  project.clear();

  const hasOutset = o.top || o.right || o.bottom || o.left;
  const rects = [
    hasOutset
      ? `  <rect id="frame" x="${fmt(frame.x)}" y="${fmt(frame.y)}" width="${fmt(frame.w)}" height="${fmt(frame.h)}" fill="none"/>`
      : '',
    `  <rect id="content" x="${fmt(content.x)}" y="${fmt(content.y)}" width="${fmt(content.w)}" height="${fmt(content.h)}" fill="none"/>`,
  ].filter(Boolean);

  const text = restore(
    [
      `<svg xmlns="${SVG_NS}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" width="${fmt(w * doc.scale)}" height="${fmt(h * doc.scale)}">`,
      ...rects,
      ...cellLines,
      '</svg>',
      '',
    ].join('\n'),
  );
  return { text, warnings: [...warnings] };
}
