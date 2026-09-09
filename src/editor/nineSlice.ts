/**
 * Authoring model for nine-slice SVGs (spec "Nine-slice assets"): the
 * unsliced artwork plus slice tracks, overdraw, and content insets, all in
 * root viewBox units with the origin at 0 0. `parseAsset` reads plain and
 * sliced files back into the model; the Slicer service cuts a model into a
 * file.
 */
import { optimize, type XastChild, type XastElement } from 'svgo/browser';

export type Rect = [x: number, y: number, width: number, height: number];
export type Box = { top: number; right: number; bottom: number; left: number };
export type Side = keyof Box;
export type Repeat = 'stretch' | 'repeat' | 'round' | 'space';
export const REPEATS: Repeat[] = ['stretch', 'repeat', 'round', 'space'];
export const SIDES: Side[] = ['top', 'right', 'bottom', 'left'];

export interface Slicing {
  /** Edge track sizes; both sides 0 means one track on that axis. */
  slices: Box;
  /** Root viewBox → layout frame. */
  overdraw: Box;
  /** Layout frame → content rectangle. */
  content: Box;
  /** Repeat mode of every cell that is not a fixed corner. */
  repeat: Repeat;
}

export interface Asset {
  /** Always `0 0 w h`: a non-zero origin is folded into the artwork. */
  viewBox: Rect;
  /** The unsliced artwork as a standalone SVG. */
  art: string;
  slicing?: Slicing;
}

const SLICE = /^(\d+)_(\d+)$/;

const fmt = (v: number) => String(Math.round(v * 1000) / 1000);
const box = (
  top: number,
  right: number,
  bottom: number,
  left: number,
): Box => ({ top, right, bottom, left });
const elements = (n: XastElement) =>
  n.children.filter((c): c is XastElement => c.type === 'element');
const numbers = (v: string | undefined) =>
  v
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
const rectOf = (n: XastElement): Rect => [
  Number(n.attributes.x ?? 0),
  Number(n.attributes.y ?? 0),
  Number(n.attributes.width),
  Number(n.attributes.height),
];
const g = (transform: string, children: XastChild[]): XastElement => ({
  type: 'element',
  name: 'g',
  attributes: { transform },
  children,
});

/** Runs `visit` on the root element and returns the re-serialized document. */
const walk = (text: string, visit: (root: XastElement) => void) =>
  optimize(text, {
    multipass: false,
    plugins: [
      {
        name: 'galapa-slicer',
        fn: () => ({
          element: {
            enter: (node, parent) => {
              if (parent.type === 'root' && node.name === 'svg') visit(node);
            },
          },
        }),
      },
    ],
    js2svg: { pretty: false, finalNewline: true },
  }).data;

const readViewBox = (root: XastElement): Rect => {
  const vb = numbers(root.attributes.viewBox);
  if (vb?.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0)
    return vb as Rect;
  const w = parseFloat(root.attributes.width);
  const h = parseFloat(root.attributes.height);
  if (w > 0 && h > 0) return [0, 0, w, h];
  throw new Error('SVG needs a viewBox or width/height');
};

/** The layout frame and content rectangles of a slicing. */
export const rects = ([x, y, w, h]: Rect, s: Slicing) => {
  const o = s.overdraw;
  const frame: Rect = [
    x + o.left,
    y + o.top,
    w - o.left - o.right,
    h - o.top - o.bottom,
  ];
  const c = s.content;
  const content: Rect = [
    frame[0] + c.left,
    frame[1] + c.top,
    frame[2] - c.left - c.right,
    frame[3] - c.top - c.bottom,
  ];
  return { frame, content };
};

/** Cell rectangles of a slicing; `fixed` cells are corners that never stretch. */
export const cells = ([x, y, w, h]: Rect, { slices: s }: Slicing) => {
  const xs =
    s.left || s.right ? [x, x + s.left, x + w - s.right, x + w] : [x, x + w];
  const ys =
    s.top || s.bottom ? [y, y + s.top, y + h - s.bottom, y + h] : [y, y + h];
  const out: { col: number; row: number; rect: Rect; fixed: boolean }[] = [];
  for (let row = 0; row < ys.length - 1; row++) {
    for (let col = 0; col < xs.length - 1; col++) {
      out.push({
        col,
        row,
        rect: [xs[col], ys[row], xs[col + 1] - xs[col], ys[row + 1] - ys[row]],
        fixed: xs.length === 4 && col !== 1 && ys.length === 4 && row !== 1,
      });
    }
  }
  return out;
};

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

/** Rounds to whole DIPs and keeps every track, the frame, and the content at least 1 unit. */
export const normalize = (s: Slicing, [, , w, h]: Rect): Slicing => {
  const pair = (
    a: number,
    b: number,
    size: number,
    paired: boolean,
  ): [number, number] => {
    a = clamp(Math.round(a), 0, size - 1);
    b = clamp(Math.round(b), 0, size - 1);
    if (paired && (a || b)) {
      a = Math.max(1, a);
      b = Math.max(1, b);
    }
    if (a + b > size - 1) b = Math.max(paired ? 1 : 0, size - 1 - a);
    if (a + b > size - 1) a = Math.max(0, size - 1 - b);
    return [a, b];
  };
  const [sl, sr] = pair(s.slices.left, s.slices.right, w, true);
  const [st, sb] = pair(s.slices.top, s.slices.bottom, h, true);
  const [ol, or] = pair(s.overdraw.left, s.overdraw.right, w, false);
  const [ot, ob] = pair(s.overdraw.top, s.overdraw.bottom, h, false);
  const [cl, cr] = pair(s.content.left, s.content.right, w - ol - or, false);
  const [ct, cb] = pair(s.content.top, s.content.bottom, h - ot - ob, false);
  return {
    slices: box(st, sr, sb, sl),
    overdraw: box(ot, or, ob, ol),
    content: box(ct, cr, cb, cl),
    repeat: s.repeat,
  };
};

/** A first guess for an unsliced artwork: quarter caps, content inside them. */
export const defaultSlicing = (viewBox: Rect): Slicing => {
  const band = Math.max(1, Math.round(Math.min(viewBox[2], viewBox[3]) / 4));
  const b = box(band, band, band, band);
  return normalize(
    { slices: b, overdraw: box(0, 0, 0, 0), content: b, repeat: 'stretch' },
    viewBox,
  );
};

/** Reads a plain or sliced SVG. Throws when it is not parseable. */
export const parseAsset = (text: string): Asset => {
  let viewBox!: Rect;
  let slicing: Slicing | undefined;
  const art = walk(text, (root) => {
    const [x, y, w, h] = readViewBox(root);
    viewBox = [0, 0, w, h];
    delete root.attributes.width;
    delete root.attributes.height;
    root.attributes.viewBox = `0 0 ${fmt(w)} ${fmt(h)}`;
    const slices = elements(root).filter(
      (c) => c.name === 'svg' && SLICE.test(c.attributes.id ?? ''),
    );
    if (slices.length > 0) {
      const at = (col: number, row: number) =>
        slices.find((c) => c.attributes.id === `${col}_${row}`) ?? slices[0];
      const index = (c: XastElement) =>
        SLICE.exec(c.attributes.id!)!.slice(1).map(Number);
      const cols = Math.max(...slices.map((c) => index(c)[0])) + 1;
      const rows = Math.max(...slices.map((c) => index(c)[1])) + 1;
      const marker = (id: string) =>
        elements(root).find((c) => c.name === 'rect' && c.attributes.id === id);
      const f = marker('frame') ? rectOf(marker('frame')!) : [x, y, w, h];
      const c = marker('content') ? rectOf(marker('content')!) : f;
      const stretching = slices.find((el) => {
        const [col, row] = index(el);
        return !(cols === 3 && col !== 1 && rows === 3 && row !== 1);
      });
      const repeat = stretching?.attributes['data-slice-repeat'];
      slicing = normalize(
        {
          slices: box(
            rows === 3 ? rectOf(at(0, 0))[3] : 0,
            cols === 3 ? rectOf(at(2, 0))[2] : 0,
            rows === 3 ? rectOf(at(0, 2))[3] : 0,
            cols === 3 ? rectOf(at(0, 0))[2] : 0,
          ),
          overdraw: box(
            f[1] - y,
            x + w - f[0] - f[2],
            y + h - f[1] - f[3],
            f[0] - x,
          ),
          content: box(
            c[1] - f[1],
            f[0] + f[2] - c[0] - c[2],
            f[1] + f[3] - c[1] - c[3],
            c[0] - f[0],
          ),
          repeat: (REPEATS as string[]).includes(repeat ?? '')
            ? (repeat as Repeat)
            : 'stretch',
        },
        viewBox,
      );
      // Reassemble the artwork: each slice's viewBox maps onto its rectangle,
      // so its children need a transform wherever that mapping isn't the identity.
      root.children = slices.flatMap((el) => {
        const [cx, cy, cw, ch] = rectOf(el);
        const [vx, vy, vw, vh] = numbers(el.attributes.viewBox) ?? [
          0,
          0,
          cw,
          ch,
        ];
        const sx = cw / vw;
        const sy = ch / vh;
        const tx = cx - vx * sx;
        const ty = cy - vy * sy;
        if (!tx && !ty && sx === 1 && sy === 1) return el.children;
        const scale =
          sx === 1 && sy === 1 ? '' : ` scale(${fmt(sx)} ${fmt(sy)})`;
        return [g(`translate(${fmt(tx)} ${fmt(ty)})${scale}`, el.children)];
      });
    }
    if (x || y) {
      root.children = [g(`translate(${fmt(-x)} ${fmt(-y)})`, root.children)];
    }
  });
  return { viewBox, art, slicing };
};
