// Converts the first-party V1 themes on the `main` branch into V2 project
// folders under themes/<name>/. One-off, but kept so a re-run is one command.
// Usage: pnpm exec tsx --tsconfig tsconfig.node.json scripts/import-v1-themes.ts
import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { schemaUrl } from '@/theme/schema';

const NAMES = [
  'rosie',
  'asbal',
  'duston',
  'fostail',
  'lushenda',
  'aurelia',
  'anlucia',
  'estella',
  'kyururu',
  'maille',
  'mereade',
  'seraphi',
  'yuliza',
];
const ROOT = resolve(import.meta.dirname, '..');
const OUT = join(ROOT, 'themes');
const SCRATCH = join(ROOT, 'node_modules', '.cache', 'v1-themes');

// ---------------------------------------------------------------- V1 vocabulary

type V1Color =
  | string
  | { mix: [string, string]; amount: number; space?: 'oklab' | 'srgb' }
  | { alpha: string; value: number };
type V1Text =
  | string
  | {
      style?: string;
      weight?: number;
      size?: number;
      letterSpacing?: number;
      case?: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
    };
type Edges = [number, number, number, number];
interface V1State {
  fill?: V1Color;
  borderColor?: V1Color;
  contentColor?: V1Color;
  borderThickness?: number | Edges;
  opacity?: number;
  image?: string;
  asset?: string;
  showRing?: boolean;
}
interface V1Control extends V1State {
  shape?: 'Path' | 'Asset';
  radius?: number | 'pill';
  corner?: 'round' | 'bevel' | 'scoop' | 'notch' | 'squircle';
  padding?: number | Edges;
  text?: V1Text;
  size?: { width?: number; height?: number };
  leftInset?: number;
  states?: Record<string, V1State>;
}
interface V1Theme {
  label: string;
  mode: 'light' | 'dark';
  tokens: {
    colors: Record<string, string>;
    text: Record<
      string,
      {
        family: string;
        weight: number;
        style: string;
        size: number;
        letterSpacing: number;
        case: 'none' | 'uppercase' | 'lowercase' | 'capitalize';
      }
    >;
  };
  assets?: Record<string, string>;
  controls: Record<string, V1Control>;
}

type Json = Record<string, unknown>;

const git = (path: string) =>
  execFileSync('git', ['show', `main:${path}`], {
    cwd: ROOT,
    encoding: 'utf8',
  });

const write = (dir: string, file: string, data: Json | string) => {
  mkdirSync(join(dir, file, '..'), { recursive: true });
  writeFileSync(
    join(dir, file),
    typeof data === 'string' ? data : `${JSON.stringify(data, null, 2)}\n`,
  );
};

/** Drops undefined members so the JSON stays minimal. */
const prune = <T extends Json>(o: T): T => {
  for (const k of Object.keys(o)) if (o[k] === undefined) delete o[k];
  return o;
};

// ---------------------------------------------------------------- values

const color = (c: V1Color | undefined): unknown => {
  if (c === undefined) return undefined;
  if (typeof c === 'string')
    return c.startsWith('--color-') ? `{colors.${c.slice(8)}}` : c;
  if ('mix' in c)
    return {
      $type: 'mix',
      inputs: c.mix.map(color),
      amount: c.amount,
      space: c.space ?? 'oklab',
    };
  // V2 has no alpha op; a premultiplied mix toward transparent is the same thing.
  return {
    $type: 'mix',
    inputs: [color(c.alpha), '#00000000'],
    amount: 1 - c.value,
    space: 'srgb',
  };
};

const slug = (family: string) => family.toLowerCase().replaceAll(/\s+/g, '-');

const typography = (
  t: V1Text | undefined,
  fallback: string,
  editable: boolean,
  warn: (m: string) => void,
): unknown => {
  if (!t) return `{typography.${fallback}}`;
  if (typeof t === 'string') return `{typography.${t.slice(7)}}`;
  const out: Json = {
    $extends: `{typography.${t.style ? t.style.slice(7) : fallback}}`,
  };
  if (t.size !== undefined) out.fontSize = t.size;
  if (t.weight !== undefined) out.fontWeight = t.weight;
  if (t.letterSpacing !== undefined) out.letterSpacing = t.letterSpacing;
  if (t.case !== undefined && !editable) {
    if (t.case === 'capitalize')
      warn('capitalize is not a V2 text case; dropped');
    else out.textCase = t.case;
  }
  return Object.keys(out).length === 1 ? out.$extends : out;
};

const border = (c: V1State) =>
  c.borderColor !== undefined || c.borderThickness !== undefined
    ? prune({ color: color(c.borderColor), thickness: c.borderThickness })
    : undefined;

/** Frame-level state: everything but the content color and art, which parts carry. */
const pathState = (s: V1State): Json =>
  prune({
    fill: color(s.fill),
    border: border(s),
    opacity: s.opacity,
    showRing: s.showRing,
  });

const states = <T extends Json>(
  c: V1Control | undefined,
  map: (s: V1State) => T,
): Record<string, T> | undefined => {
  const out: Record<string, T> = {};
  for (const [name, s] of Object.entries(c?.states ?? {})) {
    const v = map(s);
    if (Object.keys(v).length > 0) out[name] = v;
  }
  return Object.keys(out).length > 0 ? out : undefined;
};

/** An SVG paint attribute for a V1 color; mixes can't live in markup. */
const paintAttr = (c: V1Color | undefined, warn: (m: string) => void) => {
  if (c === undefined) return 'none';
  const v = color(c);
  if (typeof v === 'string') return v;
  warn('a mix inside generated artwork was flattened to its first input');
  return String((v as { inputs: unknown[] }).inputs[0]);
};

// ---------------------------------------------------------------- conversion

const convert = (name: string, v1: V1Theme, source: string) => {
  const dir = join(OUT, name);
  rmSync(dir, { recursive: true, force: true });
  const warnings: string[] = [];
  const warn = (m: string) => warnings.push(m);
  const c = v1.controls;
  const windowColor = c.window.contentColor;
  /** The text/icon color a V1 control resolves to, following the inheritance chain. */
  const content = (...chain: (V1Control | undefined)[]): unknown =>
    color(chain.find((x) => x?.contentColor)?.contentColor ?? windowColor);
  const assets: Record<string, string> = {};
  const addAsset = (key: string, svg: string) => {
    write(dir, `assets/${key}.svg`, svg);
    assets[key] = `./assets/${key}.svg`;
    return `{assets.${key}}`;
  };
  const bakeTokens = (svg: string) =>
    svg.replaceAll(/var\(--theme-([a-z0-9-]+)\)/g, '{colors.$1}');
  /** Copies a V1 asset over, fixing the nine-slice profile up to V2. */
  const importAsset = (key: string) => {
    if (assets[key]) return `{assets.${key}}`;
    let svg = bakeTokens(git(`public${v1.assets![key]}`));
    if (/id="\d+_\d+"/.test(svg)) {
      const [, vb] = /viewBox="([^"]+)"/.exec(svg)!;
      const [x, y, w, h] = vb.trim().split(/[\s,]+/);
      // Root width/height carry no nine-slice meaning; the cells keep theirs.
      svg = svg.replace(/^([^>]*<svg[^>]*)>/, (open) =>
        open.replaceAll(/\s(?:width|height)="[^"]*"/g, ''),
      );
      if (!svg.includes('id="frame"'))
        svg = svg.replace(
          /(<svg[^>]*>)/,
          `$1<rect id="frame" x="${x}" y="${y}" width="${w}" height="${h}" fill="none"/>`,
        );
    }
    return addAsset(key, svg);
  };
  const usesCurrentColor = (ref: string) =>
    git(`public${v1.assets![ref.slice(8, -1)]}`).includes('currentColor');

  // Tokens: colors as-is; each distinct family becomes a Google Font token.
  const fonts: Record<string, string> = {};
  const typographyTokens: Record<string, Json> = {};
  for (const [tname, t] of Object.entries(v1.tokens.text)) {
    fonts[slug(t.family)] = `gfont:${t.family.replaceAll(' ', '+')}`;
    typographyTokens[tname] = prune({
      font: `{fonts.${slug(t.family)}}`,
      fontWeight: t.weight,
      fontStyle: t.style === 'normal' ? undefined : t.style,
      fontSize: t.size,
      letterSpacing: t.letterSpacing || undefined,
      textCase:
        t.case === 'none'
          ? undefined
          : t.case === 'capitalize'
            ? (warn('capitalize dropped'), undefined)
            : t.case,
    });
  }

  const frame = (v: V1Control, extra: Json = {}): Json => {
    if (v.shape === 'Asset') {
      const asset = importAsset(v.asset!);
      return prune({
        shape: 'asset',
        asset,
        currentColor: usesCurrentColor(asset) ? content(v) : undefined,
        opacity: v.opacity,
        size: v.size,
        states: states(v, (s) =>
          prune({
            asset: s.asset ? importAsset(s.asset) : undefined,
            opacity: s.opacity,
            showRing: s.showRing,
          }),
        ),
        ...extra,
      });
    }
    return prune({
      shape: 'path',
      radius: v.radius,
      corner: v.corner,
      fill: color(v.fill),
      border: border(v),
      padding: v.padding,
      opacity: v.opacity,
      size: v.size,
      states: states(v, pathState),
      ...extra,
    });
  };
  /** A text part: color from the chain, typography from the nearest `text`, state colors from the frame. */
  const text = (
    own: V1Control | undefined,
    parent: V1Control | undefined,
    fallbackTypography = 'body',
    editable = false,
    extra: Json = {},
  ): Json =>
    prune({
      color: content(own, parent),
      typography: typography(
        own?.text ?? parent?.text,
        fallbackTypography,
        editable,
        warn,
      ),
      leftInset: own?.leftInset,
      states: states(parent, (s) => prune({ color: color(s.contentColor) })),
      ...extra,
    });
  const paint = (
    own: V1Control | undefined,
    parent: V1Control | undefined,
  ): Json =>
    prune({
      color: content(own, parent),
      states: states(own ?? parent, (s) =>
        prune({ color: color(s.contentColor) }),
      ),
    });

  /** Generates the artwork for a V1 path-drawn image control (pip, nav) in one state. */
  const drawn = (
    key: string,
    v: V1Control,
    s: V1State | undefined,
    inner: string,
  ) => {
    const { width: w = 16, height: h = 16 } = v.size ?? {};
    const fill = paintAttr(s?.fill ?? v.fill, warn);
    const stroke = paintAttr(s?.borderColor ?? v.borderColor, warn);
    const t = s?.borderThickness ?? v.borderThickness ?? 0;
    const sw = typeof t === 'number' ? t : t[0];
    const i = sw / 2;
    const r = Math.min(
      v.radius === 'pill' ? Math.min(w, h) / 2 : (v.radius ?? 0),
      (w - sw) / 2,
      (h - sw) / 2,
    );
    const shape =
      v.corner === 'bevel' && r > 0
        ? `<path d="M${i + r} ${i}H${w - i - r}L${w - i} ${i + r}V${h - i - r}L${w - i - r} ${h - i}H${i + r}L${i} ${h - i - r}V${i + r}Z"`
        : `<rect x="${i}" y="${i}" width="${w - sw}" height="${h - sw}" rx="${Math.max(0, r - i)}"`;
    if (v.corner && v.corner !== 'round' && v.corner !== 'bevel')
      warn(`${key}: ${v.corner} corners drawn as round`);
    const paintAttrs = `fill="${fill}" stroke="${stroke}"${sw ? ` stroke-width="${sw}"` : ''}`;
    const body =
      fill === 'none' && stroke === 'none' ? '' : `${shape} ${paintAttrs}/>`;
    return addAsset(
      key,
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}${inner}</svg>\n`,
    );
  };
  /** The inner markup of a V1 image asset, centered in a w×h box. */
  const embedded = (
    ref: string | undefined,
    w: number,
    h: number,
    fallback: string,
  ) => {
    if (!ref) return fallback;
    const svg = bakeTokens(git(`public${v1.assets![ref]}`));
    const open = /<svg[^>]*>/.exec(svg)![0];
    const iw = Number(/\swidth="([\d.]+)"/.exec(open)?.[1] ?? w);
    const ih = Number(/\sheight="([\d.]+)"/.exec(open)?.[1] ?? h);
    const vb = /viewBox="([^"]+)"/.exec(open)?.[1] ?? `0 0 ${iw} ${ih}`;
    const fill = /\sfill="([^"]+)"/.exec(open)?.[1];
    const inner = svg.slice(open.length, svg.lastIndexOf('</svg>')).trim();
    return `<svg x="${(w - iw) / 2}" y="${(h - ih) / 2}" width="${iw}" height="${ih}" viewBox="${vb}"${fill ? ` fill="${fill}"` : ''}>${inner}</svg>`;
  };
  /** A V1 path/image control as a V2 ImageControl with per-state artwork. */
  const image = (
    key: string,
    v: V1Control,
    inner: (s: V1State | undefined) => string,
    parent?: V1Control,
  ): Json => {
    const base = drawn(key, v, undefined, inner(undefined));
    return prune({
      asset: base,
      currentColor: content(v, parent),
      size: v.size,
      states: states(v, (s) => {
        const redrawn =
          s.fill !== undefined ||
          s.borderColor !== undefined ||
          s.borderThickness !== undefined ||
          s.image !== undefined;
        return prune({
          asset: redrawn
            ? drawn(
                `${key}-${Object.entries(v.states!).find(([, x]) => x === s)![0]}`,
                v,
                s,
                inner(s),
              )
            : undefined,
          currentColor: color(s.contentColor),
          opacity: s.opacity,
          showRing: s.showRing,
        });
      }),
    });
  };
  const n = (v: number) => String(Math.round(v * 100) / 100);
  const chevron = (w: number, h: number) =>
    `<path d="M${n(w * 0.42)} ${n(h * 0.3)}L${n(w * 0.62)} ${n(h * 0.5)}L${n(w * 0.42)} ${n(h * 0.7)}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;

  const nav = c['carousel.nav'];
  const pip = c.pip;
  const navSize = { width: 31, height: 31, ...nav.size };
  const controls: Record<string, Json> = {
    window: prune({
      fill: color(c.window.fill),
      borderColor: color(c.window.borderColor),
    }),
    'focus-ring': { color: '{colors.accent}' },
    panel: frame(c.panel),
    button: frame(c.button, { parts: { text: text(undefined, c.button) } }),
    input: frame(c.input, {
      parts: {
        label: text(c['input.label'], c.input),
        value: text(undefined, c.input, 'body', true),
        placeholder: text(c['input.placeholder'], c.input),
        caret: paint(c['input.caret'], c.input),
      },
    }),
    tab: frame(c.tab, { parts: { text: text(undefined, c.tab) } }),
    subtab: frame(c.subtab, { parts: { text: text(undefined, c.subtab) } }),
    carousel: frame(c.carousel, {
      parts: {
        nav: image(
          'carousel-nav',
          { ...nav, size: navSize },
          (s) =>
            embedded(
              s?.image ?? nav.image,
              navSize.width,
              navSize.height,
              chevron(navSize.width, navSize.height),
            ),
          c.carousel,
        ),
        pip: image(
          'carousel-pip',
          pip,
          (s) =>
            embedded(
              s?.image ?? pip.image,
              pip.size?.width ?? 13,
              pip.size?.height ?? 13,
              '',
            ),
          c.carousel,
        ),
      },
    }),
    switch: {
      parts: {
        track: frame(c['switch.track']),
        thumb: frame(c['switch.thumb']),
      },
    },
    'news-item': frame(c['news-item'], {
      parts: {
        title: text(undefined, c['news-item']),
        date: text(c['news-item.date'], c['news-item']),
        gem: prune({
          currentColor: content(c['news-item.gem'], c['news-item']),
        }),
      },
    }),
    'setting-row': frame(c['setting-row'], {
      parts: {
        label: text(undefined, c['setting-row']),
        value: text(undefined, c['setting-row']),
      },
    }),
    titlebar: frame(c.titlebar, {
      parts: {
        wordmark: text(c['titlebar.wordmark'], c.titlebar, 'heading'),
        caption: frame(c['titlebar.caption']),
        'caption-icon': paint(c['titlebar.caption'], c.titlebar),
        close: frame(c['titlebar.close']),
        'close-icon': paint(c['titlebar.close'], c.titlebar),
      },
    }),
    subtabs: frame(c.subtabs),
    scrollbar: {
      parts: {
        track: frame(c['scrollbar.track']),
        thumb: frame(c['scrollbar.thumb']),
      },
    },
    progress: {
      parts: {
        track: frame(c['progress.track']),
        indicator: frame(c['progress.indicator']),
      },
    },
    'tab-bar': { parts: { hint: { currentColor: content(c['tab-bar']) } } },
    settings: {
      parts: { heading: text(c['settings.heading'], undefined, 'heading') },
    },
    'setting-help': {
      parts: {
        title: text(c['setting-help.title'], undefined, 'heading'),
        body: text(c['setting-help.body'], undefined),
      },
    },
  };
  const ornament = c['play-ornament'];
  if (ornament?.image) {
    controls['play-row'] = {
      parts: {
        ornament: prune({
          asset: importAsset(ornament.image),
          currentColor: content(c['play-row']),
          size: ornament.size,
        }),
      },
    };
  }

  const description = /\/\*\*?\s*[A-Z][a-z]+ — (.*?)\s*\*\//s
    .exec(source)?.[1]
    .replaceAll(/\s+/g, ' ');
  write(dir, 'metadata.json', {
    $schema: schemaUrl('metadata'),
    formatVersion: 1,
    id: `app.galapa.themes.${`galapa${name}`.padEnd(20, '0')}`,
    name: v1.label,
    author: { name: 'Galapa Team', url: 'https://galapa.app/' },
    ...(description
      ? {
          description:
            description.charAt(0).toUpperCase() + description.slice(1),
        }
      : {}),
    updates: null,
    chromeStyle: v1.mode,
  });
  write(dir, 'tokens.json', {
    $schema: schemaUrl('tokens'),
    colors: v1.tokens.colors,
    fonts,
    ...(Object.keys(assets).length ? { assets } : {}),
    typography: typographyTokens,
  });
  for (const [id, body] of Object.entries(controls)) {
    write(dir, `controls/${id}.json`, {
      $schema: schemaUrl(`controls/${id}`),
      ...body,
    });
  }
  return warnings;
};

rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(SCRATCH, { recursive: true });
for (const name of NAMES) {
  const source = git(`src/theme/themes/${name}.ts`);
  const file = join(SCRATCH, `${name}.ts`);
  writeFileSync(file, source);
  const mod = (await import(pathToFileURL(file).href)) as Record<
    string,
    V1Theme
  >;
  const warnings = convert(name, mod[name], source);
  console.log(
    `${name}: ${warnings.length ? [...new Set(warnings)].join('; ') : 'ok'}`,
  );
}

// Generated JSON follows the repo's Prettier style.
execFileSync('pnpm', ['exec', 'prettier', '--write', 'themes'], { cwd: ROOT });
