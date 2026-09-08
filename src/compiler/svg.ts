/**
 * SVG normalization and validation. SVGO is the parser and pipeline host; the
 * Galapa profile plugin runs twice: first on the untouched AST so unsupported
 * content is rejected rather than optimized away, then after CSS has been
 * inlined and converted to presentation attributes, as the canonical check.
 */
import { formatHex, formatHex8, parse } from 'culori';
import { Effect } from 'effect';
import { optimize, type CustomPlugin, type XastElement } from 'svgo/browser';

export type Rect = [x: number, y: number, width: number, height: number];
export interface SvgOptions {
  readonly profile: 'image' | 'nine-slice';
  /** Color token name -> hex, for `{colors.name}` paint references. */
  readonly colors?: Record<string, string>;
}
export interface SvgResult {
  readonly svg: string;
  readonly usesCurrentColor: boolean;
  /** Nine-slice only: the content rectangle in root viewBox units. */
  readonly content?: Rect;
}
export class SvgError extends Error {}

const MAX_BYTES = 4 * 1024 * 1024;

const ELEMENTS = new Set(
  'svg g defs use path rect circle ellipse line polyline polygon linearGradient radialGradient stop clipPath mask'.split(
    ' ',
  ),
);
/** Why a common exporter element is rejected. */
const HINTS: Record<string, string> = {
  text: 'convert text to outlines',
  tspan: 'convert text to outlines',
  image: 'embedded images are not supported',
  a: 'links are not supported',
  script: 'scripts are not supported',
  foreignObject: 'foreignObject is not supported',
  filter: 'disable effects',
  animate: 'animation is not supported',
  animateTransform: 'animation is not supported',
  animateMotion: 'animation is not supported',
  set: 'animation is not supported',
};
const ATTRIBUTES = new Set(
  'id xmlns xmlns:xlink version viewBox preserveAspectRatio x y x1 y1 x2 y2 cx cy r rx ry fx fy fr width height d points pathLength transform gradientUnits gradientTransform spreadMethod offset maskUnits maskContentUnits mask-type clipPathUnits href xlink:href fill fill-rule fill-opacity clip-rule stroke stroke-width stroke-linecap stroke-linejoin stroke-miterlimit stroke-dasharray stroke-dashoffset stroke-opacity stop-color stop-opacity opacity clip-path mask vector-effect data-slice-repeat'.split(
    ' ',
  ),
);
/** Tolerated on admission: normalization consumes CSS and strips editor data. */
const ADMITTED_ELEMENT = /^(?:style|title|desc|metadata)$|:/;
const ADMITTED_ATTRIBUTE = /^(?:style|class|overflow)$|:/;
const DROPPED = /^(?:class|data-name|xml:space|tabindex|focusable|aria-.*)$/;
const PAINT = new Set(['fill', 'stroke', 'stop-color']);
const NUMERIC = new Set(
  'x y x1 y1 x2 y2 cx cy r rx ry fx fy fr width height offset opacity fill-opacity stroke-opacity stop-opacity stroke-width stroke-miterlimit stroke-dashoffset pathLength'.split(
    ' ',
  ),
);
const NUMBER = /^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?%?$/i;
const ID = /^[\w:.-]+$/;
const LOCAL_URL = /^url\(\s*#([\w:.-]+)\s*\)$/;
const TOKEN = /\{colors\.([a-z0-9]+(?:-[a-z0-9]+)*)\}/g;
const SLICE = /^(\d+)_(\d+)$/;
const REPEAT = new Set(['stretch', 'repeat', 'round', 'space']);

const where = (n: XastElement) =>
  n.attributes.id ? `<${n.name} id="${n.attributes.id}">` : `<${n.name}>`;
const fail = (n: XastElement, message: string): never => {
  throw new SvgError(`${where(n)}: ${message}`);
};
const num = (v: string | undefined) => (v === undefined ? NaN : Number(v));

/** Color token names referenced by paint attributes in `source`. */
export const colorRefs = (source: string) => [
  ...new Set([...source.matchAll(TOKEN)].map((m) => m[1])),
];

/** Accepts any CSS color an exporter might write and canonicalizes it to hex. */
const paint = (n: XastElement, value: string) => {
  if (value === 'none' || value === 'currentColor') return value;
  if (value.includes('url(')) {
    if (!LOCAL_URL.test(value)) {
      fail(n, 'only same-document url(#fragment) references are supported');
    }
    return value;
  }
  const c = parse(value);
  if (!c) fail(n, `unsupported paint "${value}"`);
  return (c!.alpha ?? 1) < 1 ? formatHex8(c!) : formatHex(c!);
};

const rect = (n: XastElement): Rect => {
  const r: Rect = [
    num(n.attributes.x ?? '0'),
    num(n.attributes.y ?? '0'),
    num(n.attributes.width),
    num(n.attributes.height),
  ];
  if (!r.every(Number.isFinite) || r[2] <= 0 || r[3] <= 0) {
    fail(n, 'geometry must be finite and positive');
  }
  return r;
};
const inside = (outer: Rect, inner: Rect) =>
  inner[0] >= outer[0] &&
  inner[1] >= outer[1] &&
  inner[0] + inner[2] <= outer[0] + outer[2] &&
  inner[1] + inner[3] <= outer[1] + outer[3];

/** Validates the nine-slice profile, materializes slice defaults, returns the content rect. */
const nineSlice = (root: XastElement): Rect => {
  const children = root.children.filter(
    (c): c is XastElement => c.type === 'element',
  );
  const marker = (id: string) => {
    const m = children.find((c) => c.name === 'rect' && c.attributes.id === id);
    if (!m) fail(root, `nine-slice requires a direct child <rect id="${id}">`);
    const { fill, stroke } = m!.attributes;
    if (fill !== 'none' || (stroke !== undefined && stroke !== 'none')) {
      fail(m!, 'marker rectangles must not paint');
    }
    return m!;
  };
  const frameEl = marker('frame');
  const contentEl = marker('content');
  const viewBox = root.attributes.viewBox
    .trim()
    .split(/[\s,]+/)
    .map(Number) as Rect;
  const frame = rect(frameEl);
  const content = rect(contentEl);
  if (!inside(viewBox, frame))
    fail(frameEl, 'frame must lie within the viewBox');
  if (!inside(frame, content)) fail(contentEl, 'content must lie within frame');

  const slices = new Map<string, Rect>();
  for (const c of children) {
    if (c === frameEl || c === contentEl) continue;
    const m = c.name === 'svg' ? SLICE.exec(c.attributes.id ?? '') : null;
    if (!m)
      fail(
        c,
        'nine-slice root may only contain markers and <svg id="col_row"> slices',
      );
    const repeat = c.attributes['data-slice-repeat'] ?? 'stretch';
    if (!REPEAT.has(repeat)) fail(c, `unknown repeat mode "${repeat}"`);
    const par = c.attributes.preserveAspectRatio;
    if (repeat === 'stretch') {
      if (par !== undefined && par !== 'none' && par !== 'xMidYMid meet') {
        fail(
          c,
          'stretch slices support only preserveAspectRatio none or xMidYMid meet',
        );
      }
      c.attributes.preserveAspectRatio = par ?? 'none';
    } else if (par !== undefined) {
      fail(c, `${repeat} slices may not set preserveAspectRatio`);
    }
    c.attributes['data-slice-repeat'] = repeat;
    slices.set(`${m![1]}_${m![2]}`, rect(c));
  }
  const cols =
    Math.max(...[...slices.keys()].map((k) => Number(k.split('_')[0]))) + 1;
  const rows =
    Math.max(...[...slices.keys()].map((k) => Number(k.split('_')[1]))) + 1;
  if (
    ![1, 3].includes(cols) ||
    ![1, 3].includes(rows) ||
    slices.size !== cols * rows
  ) {
    fail(root, 'slices must form a complete 1x1, 1x3, 3x1, or 3x3 grid');
  }
  let y = viewBox[1];
  for (let r = 0; r < rows; r++) {
    let x = viewBox[0];
    const h = slices.get(`0_${r}`)![3];
    for (let c = 0; c < cols; c++) {
      // Distinct ids within the checked range and count mean every cell exists.
      const s = slices.get(`${c}_${r}`)!;
      const w = slices.get(`${c}_0`)![2];
      if (s[0] !== x || s[1] !== y || s[2] !== w || s[3] !== h) {
        fail(root, `slice ${c}_${r} does not tile its row and column`);
      }
      x += w;
    }
    if (x !== viewBox[0] + viewBox[2])
      fail(root, 'slices do not span the viewBox width');
    y += h;
  }
  if (y !== viewBox[1] + viewBox[3])
    fail(root, 'slices do not span the viewBox height');
  return content;
};

type Ctx = {
  options: SvgOptions;
  usesCurrentColor: boolean;
  content?: Rect;
  root?: true;
};

const elementHint = (n: XastElement) =>
  HINTS[n.name] ??
  (n.name.startsWith('fe') ? 'disable effects' : 'unsupported element');

/** Rejects unsupported content before any plugin can optimize it away. Bakes color tokens. */
const admission = (ctx: Ctx): CustomPlugin => ({
  name: 'galapa-admission',
  fn: () => ({
    element: {
      enter: (node) => {
        if (!ELEMENTS.has(node.name) && !ADMITTED_ELEMENT.test(node.name)) {
          fail(node, elementHint(node));
        }
        for (const [name, value] of Object.entries(node.attributes)) {
          if (
            !ATTRIBUTES.has(name) &&
            !ADMITTED_ATTRIBUTE.test(name) &&
            !DROPPED.test(name)
          ) {
            fail(node, `unsupported attribute ${name}`);
          }
          if (PAINT.has(name)) {
            node.attributes[name] = value.replace(TOKEN, (_, token: string) => {
              const hex = ctx.options.colors?.[token];
              return hex ?? fail(node, `unknown color token {colors.${token}}`);
            });
          }
        }
      },
    },
  }),
});

/** Document state gathered by the canonical pass. */
type Doc = {
  ids: Map<string, string | undefined>;
  refs: { id: string; slice?: string; node: XastElement }[];
  /** Enclosing nine-slice cell ids, innermost last. */
  slices: string[];
};

/** Moves leftover declarations to attributes; convertStyleToAttrs only knows presentation ones. */
const inlineStyle = (node: XastElement, style: string) => {
  for (const decl of style.split(';')) {
    const [k, v] = decl.split(':').map((t) => t.trim());
    if (!k) continue;
    if (!ATTRIBUTES.has(k) || !v)
      fail(node, `unsupported CSS "${decl.trim()}"`);
    node.attributes[k] = v!;
  }
  delete node.attributes.style;
};

const reference = (
  doc: Doc,
  node: XastElement,
  name: string,
  value: string,
) => {
  if (name === 'href' || name === 'xlink:href') {
    if (!value.startsWith('#') || !ID.test(value.slice(1))) {
      fail(node, 'only same-document #fragment references are supported');
    }
    doc.refs.push({ id: value.slice(1), slice: doc.slices.at(-1), node });
  } else if (value.includes('url(')) {
    const m = LOCAL_URL.exec(value);
    if (!m)
      fail(node, 'only same-document url(#fragment) references are supported');
    doc.refs.push({ id: m![1], slice: doc.slices.at(-1), node });
  }
};

/** Validates and canonicalizes one attribute of the normalized document. */
const attribute = (ctx: Ctx, doc: Doc, node: XastElement, name: string) => {
  const value = node.attributes[name];
  if (DROPPED.test(name)) return delete node.attributes[name];
  if (name === 'overflow') {
    if (value !== 'hidden')
      fail(node, 'artwork is always clipped; remove overflow');
    return delete node.attributes[name];
  }
  if (!ATTRIBUTES.has(name)) fail(node, `unsupported attribute ${name}`);
  if (NUMERIC.has(name) && !NUMBER.test(value)) {
    fail(node, `${name} must be a plain number, got "${value}"`);
  }
  if (PAINT.has(name)) {
    node.attributes[name] = paint(node, value);
    if (value === 'currentColor') ctx.usesCurrentColor = true;
  }
  reference(doc, node, name, value);
  if (name === 'id') {
    if (!ID.test(value)) fail(node, `invalid id "${value}"`);
    if (doc.ids.has(value)) fail(node, `duplicate id "${value}"`);
    doc.ids.set(value, doc.slices.at(-1));
  }
};

const checkRoot = (ctx: Ctx, node: XastElement) => {
  ctx.root = true;
  const vb = (node.attributes.viewBox ?? '')
    .trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    vb.length !== 4 ||
    !vb.every(Number.isFinite) ||
    vb[2] <= 0 ||
    vb[3] <= 0
  ) {
    fail(node, 'a finite, positive viewBox is required');
  }
  delete node.attributes.width;
  delete node.attributes.height;
};

/** The final check: everything CSS-derived is now an allowlisted presentation attribute. */
const canonical = (ctx: Ctx): CustomPlugin => {
  const doc: Doc = { ids: new Map(), refs: [], slices: [] };
  const nine = ctx.options.profile === 'nine-slice';
  let root: XastElement | undefined;
  const isSlice = (n: XastElement) => nine && n.name === 'svg' && n !== root;
  return {
    name: 'galapa-canonical',
    fn: () => ({
      element: {
        enter: (node, parent) => {
          if (parent.type === 'root') {
            if (root || node.name !== 'svg') {
              fail(node, 'document must contain one <svg> root');
            }
            root = node;
          }
          if (!ELEMENTS.has(node.name)) fail(node, elementHint(node));
          if (isSlice(node)) doc.slices.push(node.attributes.id ?? '');
          if (node.attributes.style) inlineStyle(node, node.attributes.style);
          for (const name of Object.keys(node.attributes)) {
            attribute(ctx, doc, node, name);
          }
          if (node === root) checkRoot(ctx, node);
        },
        exit: (node) => {
          if (isSlice(node)) doc.slices.pop();
          if (node !== root) return;
          if (nine) ctx.content = nineSlice(node);
          for (const r of doc.refs) {
            if (!doc.ids.has(r.id)) fail(r.node, `unknown fragment #${r.id}`);
            if (nine && doc.ids.get(r.id) !== r.slice) {
              fail(r.node, `#${r.id} must be defined inside the same slice`);
            }
          }
        },
      },
    }),
  };
};

export const compileSvg = (source: string, options: SvgOptions): SvgResult => {
  if (source.length > MAX_BYTES) throw new SvgError('SVG exceeds 4 MiB');
  if (/<!ENTITY/i.test(source))
    throw new SvgError('entity declarations are not supported');
  const ctx: Ctx = { options, usesCurrentColor: false };
  let data: string;
  try {
    data = optimize(source, {
      multipass: false,
      plugins: [
        admission(ctx),
        { name: 'removeComments', params: { preservePatterns: false } },
        'removeDoctype',
        'removeXMLProcInst',
        'removeMetadata',
        'removeEditorsNSData',
        'removeTitle',
        { name: 'removeDesc', params: { removeAny: true } },
        {
          name: 'inlineStyles',
          params: { onlyMatchedOnce: false, removeMatchedSelectors: true },
        },
        'convertStyleToAttrs',
        canonical(ctx),
        'sortAttrs',
      ],
      js2svg: { pretty: false, finalNewline: true },
    }).data;
  } catch (e) {
    if (e instanceof SvgError) throw e;
    throw new SvgError(`cannot parse: ${(e as Error).message}`);
  }
  if (!ctx.root) throw new SvgError('document must contain one <svg> root');
  return {
    svg: data,
    usesCurrentColor: ctx.usesCurrentColor,
    content: ctx.content,
  };
};

export class Svg extends Effect.Service<Svg>()('Svg', {
  // ponytail: in-process. Add a Worker layer with a time limit for the browser.
  succeed: {
    compile: (source: string, options: SvgOptions) =>
      Effect.try({
        try: () => compileSvg(source, options),
        catch: (e) => e as SvgError,
      }),
  },
}) {}
