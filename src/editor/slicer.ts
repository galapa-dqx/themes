/**
 * Cuts an Asset into a nine-slice SVG by really slicing the geometry with
 * Paper.js. Strokes are first outlined into fills (paperjs-offset) so cuts
 * land exactly on cell boundaries, then every filled path is intersected
 * with each cell, so each slice carries only its own geometry.
 *
 * Paints can't survive a trip through Paper (colors are parsed), so
 * `{colors.x}` references and `currentColor` are swapped for sentinel colors
 * up front and restored in the emitted text.
 */
import { Data, Effect } from 'effect';
import paper from 'paper';
import { offsetStroke } from 'paperjs-offset';
import { cells, normalize, rects, type Asset, type Rect } from './nineSlice';

export class SliceError extends Data.TaggedError('SliceError')<{
  readonly message: string;
}> {}
export interface Cut {
  readonly text: string;
  readonly warnings: string[];
}

const SVG_NS = 'http://www.w3.org/2000/svg';
const PAINT = /\{colors\.[a-z0-9-]+\}|currentColor/g;
const fmt = (v: number) => String(Math.round(v * 1000) / 1000);

/** Swaps token and keyword paints for unique sentinel colors, and back. */
const sentinels = (source: string) => {
  const paints = [...new Set(source.match(PAINT) ?? [])];
  const lower = source.toLowerCase();
  const map = paints.map((paint, i) => {
    let n = i;
    let hex: string;
    do {
      n += 1;
      hex = `#01${(n >> 8).toString(16).padStart(2, '0')}${(n & 255).toString(16).padStart(2, '0')}`;
    } while (lower.includes(hex));
    return { paint, hex };
  });
  const prepared = source.replace(
    PAINT,
    (m) => map.find((e) => e.paint === m)!.hex,
  );
  // Paper may emit sentinels back as hex or rgb(); restore both spellings.
  const restore = (text: string) =>
    map.reduce((acc, { paint, hex }) => {
      const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
      return acc
        .replace(new RegExp(hex, 'gi'), paint)
        .replaceAll(`rgb(${r},${g},${b})`, paint)
        .replaceAll(`rgb(${r}, ${g}, ${b})`, paint);
    }, text);
  return { prepared, restore };
};

let ready = false;
const project = () => {
  if (!ready) {
    paper.setup(new paper.Size(8, 8));
    ready = true;
  }
  paper.project.clear();
  return paper.project;
};

const flattenColor = (color: paper.Color | null, warnings: Set<string>) => {
  if (color?.type === 'gradient') {
    warnings.add('gradient fill flattened to its first stop');
    return color.gradient.stops[0].color;
  }
  return color;
};

type Piece = { item: paper.PathItem; opacity: number };

/** Every filled shape of the artwork, strokes outlined into fills. */
const collectPieces = (
  root: paper.Item,
  w: number,
  h: number,
  warnings: Set<string>,
) => {
  const pieces: Piece[] = [];
  // Paper models the imported svg's viewport as a clip mask; that one is
  // redundant here (we clip to cells anyway) and shouldn't warn.
  const isViewport = (item: paper.Item) => {
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
      case 'Layer':
        for (const child of item.children ?? []) {
          if (child.clipMask) {
            if (!isViewport(child))
              warnings.add('clipping masks are not supported; mask ignored');
            continue;
          }
          visit(child, eff);
        }
        break;
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
          if (path.dashArray?.length)
            warnings.add('dashed strokes are outlined as solid');
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
};

/** Attributes Paper emits at their SVG defaults; pure noise in the output. */
const JUNK = ['font-family', 'font-weight', 'font-size', 'text-anchor'];
const STROKE = [
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
];

const exportPiece = (item: paper.PathItem) => {
  const el = item.exportSVG({ precision: 4 }) as SVGElement;
  const clean = (node: Element) => {
    node.removeAttribute('xmlns');
    for (const attr of JUNK)
      if (node.getAttribute(attr) === 'none') node.removeAttribute(attr);
    if (node.getAttribute('style') === 'mix-blend-mode: normal')
      node.removeAttribute('style');
    if (node.getAttribute('stroke-dasharray') === '')
      node.removeAttribute('stroke-dasharray');
    if ((node.getAttribute('stroke') ?? 'none') === 'none')
      for (const attr of STROKE) node.removeAttribute(attr);
    for (const child of node.children) clean(child);
  };
  clean(el);
  return el.outerHTML;
};

const rect = (id: string, [x, y, w, h]: Rect) =>
  `<rect id="${id}" x="${fmt(x)}" y="${fmt(y)}" width="${fmt(w)}" height="${fmt(h)}" fill="none"/>`;

/** The file for an asset: its artwork as-is, or the nine-slice document when sliced. */
export const cutAsset = (asset: Asset): Cut => {
  if (!asset.slicing) return { text: asset.art, warnings: [] };
  const [, , w, h] = asset.viewBox;
  const s = normalize(asset.slicing, asset.viewBox);
  const { frame, content } = rects(asset.viewBox, s);
  const { prepared, restore } = sentinels(asset.art);
  const p = project();
  const imported = p.importSVG(prepared, { expandShapes: true });
  if (!imported) throw new Error('Paper.js could not import the artwork');
  const warnings = new Set<string>();
  const pieces = collectPieces(imported, w, h, warnings);
  if (pieces.length === 0) warnings.add('no sliceable geometry found');

  // Clip a hair outside the cell: exactly-coincident edges send Paper's
  // boolean ops degenerate, and the slice's viewport crops the overhang.
  const EPS = 0.01;
  const slices = cells(asset.viewBox, s).map(({ col, row, rect: r, fixed }) => {
    const clip = new paper.Path.Rectangle({
      point: [r[0] - EPS, r[1] - EPS],
      size: [r[2] + EPS * 2, r[3] + EPS * 2],
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
      if (!part.isEmpty() && Math.abs(area) >= 1e-6) {
        if (opacity < 1) part.opacity = opacity;
        parts.push(exportPiece(part));
      }
      part.remove();
    }
    const repeat =
      !fixed && s.repeat !== 'stretch'
        ? ` data-slice-repeat="${s.repeat}"`
        : '';
    return `<svg id="${col}_${row}" x="${fmt(r[0])}" y="${fmt(r[1])}" width="${fmt(r[2])}" height="${fmt(r[3])}" viewBox="${r.map(fmt).join(' ')}"${repeat}>${parts.join('')}</svg>`;
  });
  p.clear();
  const text = restore(
    `<svg xmlns="${SVG_NS}" viewBox="0 0 ${fmt(w)} ${fmt(h)}">${rect('frame', frame)}${rect('content', content)}${slices.join('')}</svg>\n`,
  );
  return { text, warnings: [...warnings] };
};

export class Slicer extends Effect.Service<Slicer>()('Slicer', {
  // ponytail: Paper.js on the main thread. Move to a Worker with OffscreenCanvas if cutting ever stalls the UI.
  succeed: {
    cut: (asset: Asset) =>
      Effect.try({
        try: () => cutAsset(asset),
        catch: (e) => new SliceError({ message: (e as Error).message }),
      }),
  },
}) {}
