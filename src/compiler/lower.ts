/**
 * Lowering: turns the resolved control tree into `theme.json` values and a
 * package of content-addressed resources. Colors become hex, SVGs are
 * normalized and hashed, every typography tuple becomes one static font
 * file, and omitted built-in variants are filled in.
 */
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import { CONTROL_CATALOG, type CatalogEntry } from '@/theme/catalog';
import type { CompiledControl, CompiledTheme } from '@/theme/schema';
import { MATERIAL_HINTS, MATERIAL_LICENSE, NEWS_GEMS } from './builtin';
import type {
  Paint,
  ResolvedControl,
  ResolvedState,
  ResolvedTheme,
  ResolvedTypography,
} from './controls';
import { Diagnostics } from './diagnostics';
import { FontTools } from './fontTools';
import { GoogleFonts, pickResource } from './googleFonts';
import { Package } from './package';
import { colorRefs, Svg, type Rect } from './svg';
import { TokenError, toHex, type ResolvedTokens } from './tokens';

/** Compiler-owned artwork for omitted variants, by full catalog identity. */
const BUILTIN: Record<
  string,
  { assets: Record<string, string>; license?: typeof MATERIAL_LICENSE }
> = {
  'news-item.gem': { assets: NEWS_GEMS },
  'tab-bar.hint': { assets: MATERIAL_HINTS, license: MATERIAL_LICENSE },
};

type At = { file: string; path: string };
type SvgAsset = { path: string; usesCurrentColor: boolean; content?: Rect };
type Ctx = {
  dir: string;
  tokens: ResolvedTokens;
  pkg: Package;
  /** Memoized by profile and source; `undefined` means it already failed. */
  svgs: Map<string, SvgAsset | undefined>;
  fonts: Map<string, string | undefined>;
};

const utf8 = new TextDecoder('utf-8', { fatal: true });
const paint = (p: Paint) => (p === 'none' ? 'none' : toHex(p));

// ---------------------------------------------------------------- resources

/** Reads a project asset; the schema already constrained the path shape. */
const readAsset = (ctx: Ctx, source: string, at: At) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* Diagnostics;
    return yield* fs
      .readFile(`${ctx.dir}/${source.slice(2)}`)
      .pipe(
        Effect.catchAll(() =>
          d
            .error('asset', `${source} does not exist`, at)
            .pipe(Effect.as(undefined)),
        ),
      );
  });

const compileSvgSource = (
  ctx: Ctx,
  key: string,
  source: string,
  profile: 'image' | 'nine-slice',
  at: At,
): Effect.Effect<
  SvgAsset | undefined,
  never,
  Diagnostics | Svg | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    if (ctx.svgs.has(key)) return ctx.svgs.get(key);
    const d = yield* Diagnostics;
    ctx.svgs.set(key, undefined);
    const colors: Record<string, string> = {};
    for (const name of colorRefs(source)) {
      try {
        colors[name] = toHex(ctx.tokens.color(`{colors.${name}}`));
      } catch (e) {
        if (!(e instanceof TokenError)) throw e;
        return yield* d
          .error('asset', e.message, at)
          .pipe(Effect.as(undefined));
      }
    }
    const result = yield* (yield* Svg)
      .compile(source, { profile, colors })
      .pipe(Effect.either);
    if (result._tag === 'Left') {
      return yield* d
        .error('svg', result.left.message, at)
        .pipe(Effect.as(undefined));
    }
    const asset: SvgAsset = {
      path: yield* ctx.pkg.add(
        'assets',
        'svg',
        new TextEncoder().encode(result.right.svg),
      ),
      usesCurrentColor: result.right.usesCurrentColor,
      content: result.right.content,
    };
    ctx.svgs.set(key, asset);
    return asset;
  });

/** A project SVG, normalized and packaged. */
const svgAsset = (
  ctx: Ctx,
  source: string,
  profile: 'image' | 'nine-slice',
  at: At,
) =>
  Effect.gen(function* () {
    const key = `${profile}:${source}`;
    if (ctx.svgs.has(key)) return ctx.svgs.get(key);
    const bytes = yield* readAsset(ctx, source, at);
    let text: string | undefined;
    try {
      text = bytes && utf8.decode(bytes);
    } catch {
      yield* (yield* Diagnostics).error('asset', `${source} is not UTF-8`, at);
    }
    if (text === undefined) return (ctx.svgs.set(key, undefined), undefined);
    return yield* compileSvgSource(ctx, key, text, profile, at);
  });

/** Galapa's built-in artwork for an omitted variant, with its license mapping. */
const builtinAsset = (ctx: Ctx, id: string, variant: string, at: At) =>
  Effect.gen(function* () {
    const family = BUILTIN[id]!;
    const asset = yield* compileSvgSource(
      ctx,
      `builtin:${id}:${variant}`,
      family.assets[variant]!,
      'image',
      at,
    );
    if (asset && family.license) {
      yield* ctx.pkg.license(
        asset.path,
        family.license.license,
        family.license.text,
      );
    }
    return asset;
  });

/** One exact static face for a typography tuple, packaged with its license. */
const fontAsset = (ctx: Ctx, t: ResolvedTypography, at: At) =>
  Effect.gen(function* () {
    const request = {
      weight: t.fontWeight,
      style: t.fontStyle,
      axes: t.fontAxes,
    };
    const key = `${t.font}\0${JSON.stringify(request)}`;
    if (ctx.fonts.has(key)) return ctx.fonts.get(key);
    ctx.fonts.set(key, undefined);
    const d = yield* Diagnostics;
    const fail = (message: string) =>
      d.error('font', message, at).pipe(Effect.as(undefined));

    let bytes: Uint8Array | undefined;
    if (t.font.startsWith('gfont:')) {
      const google = yield* GoogleFonts;
      const found = yield* google.lookup(t.font).pipe(Effect.either);
      if (found._tag === 'Left') return yield* fail(found.left.message);
      const resource = pickResource(found.right, t.fontWeight, t.fontStyle);
      if (!resource) {
        return yield* fail(
          `${found.right.family} does not provide weight ${t.fontWeight} ${t.fontStyle}`,
        );
      }
      const download = yield* google.download(resource.url).pipe(Effect.either);
      if (download._tag === 'Left') return yield* fail(download.left.message);
      bytes = download.right;
    } else {
      bytes = yield* readAsset(ctx, t.font, at);
      if (!bytes) return undefined;
    }

    const face = yield* (yield* FontTools)
      .compile(bytes, request)
      .pipe(Effect.either);
    if (face._tag === 'Left') return yield* fail(face.left.message);
    const path = yield* ctx.pkg.add(
      'assets/fonts',
      face.right.extension,
      face.right.bytes,
    );
    const { identifier, copyright, description, url } = face.right.license;
    if (identifier) {
      const notice = [copyright, description, url].filter(Boolean).join('\n\n');
      yield* ctx.pkg.license(path, identifier, notice || undefined);
    } else {
      yield* d.warn(
        'font',
        `${t.font} has no recognizable license metadata`,
        at,
      );
    }
    ctx.fonts.set(key, path);
    return path;
  });

// ---------------------------------------------------------------- configurations

type Lowered = { value: CompiledControl; content?: Rect };

/** Lowers one complete base or state configuration. `baseContent` is the base nine-slice rect. */
const lowerConfig = (
  ctx: Ctx,
  e: CatalogEntry,
  id: string,
  c: ResolvedState,
  at: At,
  baseContent?: Rect,
) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    const sub = (p: string): At => ({ ...at, path: `${at.path}/${p}` });
    const out: Record<string, unknown> = {};
    let usesCurrentColor = false;
    let content: Rect | undefined;
    const use = (a: SvgAsset | undefined) => {
      usesCurrentColor ||= a?.usesCurrentColor ?? false;
      content ??= a?.content;
      return a?.path ?? '';
    };

    switch (e.kind) {
      case 'frame':
        if (c.shape === 'asset') {
          out.shape = 'asset';
          out.asset = use(
            yield* svgAsset(ctx, c.asset!, 'nine-slice', sub('asset')),
          );
          if (
            baseContent &&
            content &&
            !content.every((v, i) => v === baseContent[i])
          ) {
            yield* d.warn(
              'nine-slice',
              'state asset content rectangle differs from the base; the base rectangle is used for layout',
              sub('asset'),
            );
          }
        } else {
          out.shape = 'path';
          out.radius = c.radius;
          out.corner = c.corner;
          out.fill = paint(c.fill!);
          out.border = {
            color: paint(c.border!.color),
            thickness: c.border!.thickness,
          };
          out.padding = c.padding;
        }
        break;
      case 'text': {
        const t = c.typography!;
        const { fontAxes, ...rest } = t;
        out.color = toHex(c.color!);
        out.typography = {
          ...rest,
          font: yield* fontAsset(ctx, t, sub('typography')),
        };
        if (c.leftInset !== undefined) out.leftInset = c.leftInset;
        break;
      }
      case 'paint':
        out.color = toHex(c.color!);
        break;
      case 'image':
        if (c.asset !== undefined) {
          out.asset = use(yield* svgAsset(ctx, c.asset, 'image', sub('asset')));
        }
        break;
      case 'variant-image': {
        const assets: Record<string, string> = {};
        for (const variant of e.variants ?? []) {
          const source = c.assets?.[variant];
          assets[variant] = use(
            yield* source
              ? svgAsset(ctx, source, 'image', sub(`assets/${variant}`))
              : builtinAsset(ctx, id, variant, sub(`assets/${variant}`)),
          );
        }
        out.assets = assets;
        if (c.placement !== undefined) out.placement = c.placement;
        break;
      }
      case 'window':
        out.fill = paint(c.fill!);
        out.borderColor = paint(c.borderColor!);
        break;
      case 'focus-ring':
        out.color = toHex(c.color!);
        out.width = c.width;
        out.offset = c.offset;
        break;
    }
    if (
      e.kind === 'frame' ||
      e.kind === 'image' ||
      e.kind === 'variant-image'
    ) {
      if (c.currentColor) out.currentColor = toHex(c.currentColor);
      else if (usesCurrentColor) {
        yield* d.error(
          'asset',
          'the selected SVG uses currentColor but the configuration omits it',
          at,
        );
      }
    }
    if (e.kind !== 'window' && e.kind !== 'focus-ring') out.opacity = c.opacity;
    if (c.size) out.size = c.size;
    if (c.showRing !== undefined) out.showRing = c.showRing;
    return { value: out as CompiledControl, content } satisfies Lowered;
  });

const lowerControl = (
  ctx: Ctx,
  e: CatalogEntry,
  id: string,
  c: ResolvedControl,
  at: At,
): Effect.Effect<
  CompiledControl,
  never,
  Diagnostics | Svg | FontTools | GoogleFonts | FileSystem.FileSystem
> =>
  Effect.gen(function* () {
    const { states, parts, ...base } = c;
    const out: Record<string, unknown> = {};
    if (e.kind !== 'composite') {
      const lowered = yield* lowerConfig(ctx, e, id, base, at);
      Object.assign(out, lowered.value);
      if (states) {
        out.states = {};
        for (const [name, state] of Object.entries(states)) {
          const statePath = { ...at, path: `${at.path}/states/${name}` };
          (out.states as Record<string, unknown>)[name] = (yield* lowerConfig(
            ctx,
            e,
            id,
            state,
            statePath,
            lowered.content,
          )).value;
        }
      }
    }
    if (parts) {
      out.parts = {};
      for (const [name, part] of Object.entries(parts)) {
        (out.parts as Record<string, unknown>)[name] = yield* lowerControl(
          ctx,
          e.parts![name]!,
          `${id}.${name}`,
          part,
          { ...at, path: `${at.path}/parts/${name}` },
        );
      }
    }
    return out as CompiledControl;
  });

export const lowerTheme = (
  dir: string,
  tokens: ResolvedTokens,
  theme: ResolvedTheme,
) =>
  Effect.gen(function* () {
    const ctx: Ctx = {
      dir,
      tokens,
      pkg: new Package(),
      svgs: new Map(),
      fonts: new Map(),
    };
    const out: Record<string, CompiledControl> = {};
    for (const [id, control] of Object.entries(theme)) {
      const e = CONTROL_CATALOG[id as keyof typeof CONTROL_CATALOG];
      out[id] = yield* lowerControl(ctx, e, id, control, {
        file: `controls/${id}.json`,
        path: '',
      });
    }
    // No checkpoint: the caller collects metadata problems too before failing.
    return { theme: out as CompiledTheme, pkg: ctx.pkg };
  });
