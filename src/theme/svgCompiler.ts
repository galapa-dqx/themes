import { optimize, type CustomPlugin, type XastElement } from 'svgo/browser';
import type {
  CompiledAssetResource,
  NineSliceGeometry,
  ThemeResourceCompiler,
} from './controlCompiler';
import {
  ThemeCompilationError,
  errorDiagnostic,
  type ThemeDiagnostic,
} from './diagnostics';
import { builtInAsset } from './builtInAssets';
import type { ColorValue, LicenseEntry } from './schema';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });

const ALLOWED_ELEMENTS = new Set([
  'svg',
  'g',
  'defs',
  'path',
  'rect',
  'circle',
  'ellipse',
  'line',
  'polyline',
  'polygon',
  'linearGradient',
  'radialGradient',
  'stop',
  'clipPath',
  'mask',
  'use',
]);

const ALLOWED_ATTRIBUTES = new Set([
  'id',
  'xmlns',
  'xmlns:xlink',
  'version',
  'viewBox',
  'preserveAspectRatio',
  'x',
  'y',
  'x1',
  'y1',
  'x2',
  'y2',
  'cx',
  'cy',
  'r',
  'rx',
  'ry',
  'width',
  'height',
  'd',
  'points',
  'pathLength',
  'transform',
  'gradientUnits',
  'gradientTransform',
  'spreadMethod',
  'offset',
  'fx',
  'fy',
  'fr',
  'maskUnits',
  'maskContentUnits',
  'clipPathUnits',
  'href',
  'xlink:href',
  'fill',
  'fill-rule',
  'fill-opacity',
  'stroke',
  'stroke-width',
  'stroke-linecap',
  'stroke-linejoin',
  'stroke-miterlimit',
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke-opacity',
  'stop-color',
  'stop-opacity',
  'opacity',
  'clip-path',
  'mask',
  'vector-effect',
  'data-slice-repeat',
]);

const PAINT_ATTRIBUTES = new Set(['fill', 'stroke', 'stop-color']);
const REPEAT_MODES = new Set(['stretch', 'repeat', 'round', 'space']);
const HEX = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;
const LOCAL_URL = /^url\(\s*#[A-Za-z_][\w:.-]*\s*\)$/;
const LOCAL_HREF = /^#[A-Za-z_][\w:.-]*$/;
const TOKEN = /^\{colors\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\}$/;

type SvgCompilerOptions = {
  profile: 'image' | 'nine-slice';
  path: string;
  resolveColor: (value: ColorValue, path?: string) => string;
  baseNineSlice?: NineSliceGeometry;
};

type SvgCompileResult = {
  bytes: Uint8Array;
  usesCurrentColor: boolean;
  nineSlice?: NineSliceGeometry;
  diagnostics: ThemeDiagnostic[];
};

type Rectangle = { x: number; y: number; width: number; height: number };
type Slice = Rectangle & { col: number; row: number; element: XastElement };

const number = (value: string | undefined): number =>
  value === undefined ? Number.NaN : Number(value);

function rectangle(element: XastElement, path: string): Rectangle {
  const value = {
    x: number(element.attributes.x ?? '0'),
    y: number(element.attributes.y ?? '0'),
    width: number(element.attributes.width),
    height: number(element.attributes.height),
  };
  if (
    Object.values(value).some((item) => !Number.isFinite(item)) ||
    value.width <= 0 ||
    value.height <= 0
  ) {
    throw new ThemeCompilationError(`Invalid rectangle in ${path}.`, [
      errorDiagnostic('invalid-svg-geometry', 'Rectangle geometry must be finite and positive.', path),
    ]);
  }
  return value;
}

function contains(outer: Rectangle, inner: Rectangle): boolean {
  return (
    inner.x >= outer.x &&
    inner.y >= outer.y &&
    inner.x + inner.width <= outer.x + outer.width &&
    inner.y + inner.height <= outer.y + outer.height
  );
}

function sameRectangle(left: Rectangle, right: Rectangle): boolean {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.width === right.width &&
    left.height === right.height
  );
}

function validateNineSlice(
  root: XastElement,
  path: string,
  base?: NineSliceGeometry,
): NineSliceGeometry {
  const children = root.children.filter((child): child is XastElement => child.type === 'element');
  const frameElement = children.find((child) => child.name === 'rect' && child.attributes.id === 'frame');
  const contentElement = children.find(
    (child) => child.name === 'rect' && child.attributes.id === 'content',
  );
  if (!frameElement || !contentElement) {
    throw new ThemeCompilationError('Nine-slice SVGs require frame and content markers.', [
      errorDiagnostic(
        'invalid-nine-slice',
        'Nine-slice SVGs require direct-child rects named frame and content.',
        path,
      ),
    ]);
  }
  for (const marker of [frameElement, contentElement]) {
    if (marker.attributes.fill !== 'none' || ![undefined, 'none'].includes(marker.attributes.stroke)) {
      throw new ThemeCompilationError('Nine-slice markers must not paint.', [
        errorDiagnostic('invalid-nine-slice', 'frame and content markers must be non-painting.', path),
      ]);
    }
  }

  const viewBox = (root.attributes.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
  const bounds: Rectangle = {
    x: viewBox[0],
    y: viewBox[1],
    width: viewBox[2],
    height: viewBox[3],
  };
  const frame = rectangle(frameElement, `${path}#frame`);
  let content = rectangle(contentElement, `${path}#content`);
  if (!contains(bounds, frame) || !contains(frame, content)) {
    throw new ThemeCompilationError('Nine-slice markers are outside their valid bounds.', [
      errorDiagnostic(
        'invalid-nine-slice',
        'frame must be inside the viewBox and content must be inside frame.',
        path,
      ),
    ]);
  }
  if (base) {
    const baseContent: Rectangle = {
      x: base.content[0],
      y: base.content[1],
      width: base.content[2],
      height: base.content[3],
    };
    if (!sameRectangle(content, baseContent)) {
      contentElement.attributes.x = String(baseContent.x);
      contentElement.attributes.y = String(baseContent.y);
      contentElement.attributes.width = String(baseContent.width);
      contentElement.attributes.height = String(baseContent.height);
      content = baseContent;
    }
  }

  const slices: Slice[] = [];
  for (const child of children) {
    if (child === frameElement || child === contentElement) continue;
    const match = child.name === 'svg' ? /^(\d+)_(\d+)$/.exec(child.attributes.id ?? '') : null;
    if (!match) {
      throw new ThemeCompilationError('Nine-slice root contains unsupported artwork.', [
        errorDiagnostic(
          'invalid-nine-slice',
          'The root may contain only frame/content markers and col_row slice SVGs.',
          path,
        ),
      ]);
    }
    const repeat = child.attributes['data-slice-repeat'] ?? 'stretch';
    if (!REPEAT_MODES.has(repeat)) {
      throw new ThemeCompilationError(`Unknown nine-slice repeat mode ${repeat}.`, [
        errorDiagnostic('invalid-nine-slice', `Unknown repeat mode ${repeat}.`, path),
      ]);
    }
    const par = child.attributes.preserveAspectRatio;
    if (repeat === 'stretch') {
      if (par !== undefined && par !== 'none' && par !== 'xMidYMid meet') {
        throw new ThemeCompilationError('Unsupported slice aspect-ratio mode.', [
          errorDiagnostic(
            'invalid-nine-slice',
            'Stretch slices support only none or xMidYMid meet.',
            path,
          ),
        ]);
      }
      child.attributes.preserveAspectRatio = par ?? 'none';
    } else if (par !== undefined) {
      throw new ThemeCompilationError('Tiled slices cannot set preserveAspectRatio.', [
        errorDiagnostic(
          'invalid-nine-slice',
          'repeat, round, and space slices cannot set preserveAspectRatio.',
          path,
        ),
      ]);
    }
    child.attributes['data-slice-repeat'] = repeat;
    slices.push({
      ...rectangle(child, `${path}#${child.attributes.id}`),
      col: Number(match[1]),
      row: Number(match[2]),
      element: child,
    });
  }

  const cols = Math.max(...slices.map((slice) => slice.col)) + 1;
  const rows = Math.max(...slices.map((slice) => slice.row)) + 1;
  if (![1, 3].includes(cols) || ![1, 3].includes(rows) || slices.length !== cols * rows) {
    throw new ThemeCompilationError('Nine-slice grid must be complete and 1×1, 1×3, 3×1, or 3×3.', [
      errorDiagnostic('invalid-nine-slice', 'Nine-slice grid dimensions or cells are invalid.', path),
    ]);
  }
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const cell = slices.find((slice) => slice.col === col && slice.row === row);
      if (!cell) {
        throw new ThemeCompilationError(`Missing slice ${col}_${row}.`, [
          errorDiagnostic('invalid-nine-slice', `Missing slice ${col}_${row}.`, path),
        ]);
      }
      const firstInColumn = slices.find((slice) => slice.col === col && slice.row === 0);
      const firstInRow = slices.find((slice) => slice.col === 0 && slice.row === row);
      if (
        !firstInColumn ||
        !firstInRow ||
        cell.x !== firstInColumn.x ||
        cell.width !== firstInColumn.width ||
        cell.y !== firstInRow.y ||
        cell.height !== firstInRow.height
      ) {
        throw new ThemeCompilationError('Nine-slice rows and columns are inconsistent.', [
          errorDiagnostic('invalid-nine-slice', 'Slice rows and columns must align exactly.', path),
        ]);
      }
    }
  }
  const topLeft = slices.find((slice) => slice.col === 0 && slice.row === 0);
  const bottomRight = slices.find(
    (slice) => slice.col === cols - 1 && slice.row === rows - 1,
  );
  if (
    !topLeft ||
    !bottomRight ||
    topLeft.x !== bounds.x ||
    topLeft.y !== bounds.y ||
    bottomRight.x + bottomRight.width !== bounds.x + bounds.width ||
    bottomRight.y + bottomRight.height !== bounds.y + bounds.height
  ) {
    throw new ThemeCompilationError('Nine-slice cells must tile the complete viewBox.', [
      errorDiagnostic('invalid-nine-slice', 'Slice cells must tile the complete root viewBox.', path),
    ]);
  }

  return { content: [content.x, content.y, content.width, content.height] };
}

function validationPlugin(options: SvgCompilerOptions, result: SvgCompileResult): CustomPlugin {
  let root: XastElement | undefined;
  const ids = new Map<string, string | undefined>();
  const references: { id: string; owner?: string }[] = [];
  const sliceStack: string[] = [];

  return {
    name: 'galapa-svg-profile',
    fn: () => ({
      element: {
        enter: (node, parent) => {
          if (!ALLOWED_ELEMENTS.has(node.name)) {
            throw new ThemeCompilationError(`SVG element <${node.name}> is not supported.`, [
              errorDiagnostic(
                'unsupported-svg-element',
                `<${node.name}> is not part of the Galapa SVG profile.`,
                options.path,
              ),
            ]);
          }
          if (!root) {
            if (node.name !== 'svg') {
              throw new ThemeCompilationError('SVG root must be <svg>.', [
                errorDiagnostic('invalid-svg', 'SVG root must be <svg>.', options.path),
              ]);
            }
            root = node;
            const viewBox = (node.attributes.viewBox ?? '').trim().split(/[\s,]+/).map(Number);
            if (
              viewBox.length !== 4 ||
              viewBox.some((value) => !Number.isFinite(value)) ||
              viewBox[2] <= 0 ||
              viewBox[3] <= 0
            ) {
              throw new ThemeCompilationError('SVG requires a finite, positive viewBox.', [
                errorDiagnostic(
                  'invalid-svg-viewbox',
                  'SVG requires a finite, positive viewBox.',
                  options.path,
                ),
              ]);
            }
            delete node.attributes.width;
            delete node.attributes.height;
          }

          const sliceId =
            node.name === 'svg' && /^\d+_\d+$/.test(node.attributes.id ?? '')
              ? node.attributes.id
              : undefined;
          if (sliceId) sliceStack.push(sliceId);

          for (const name of Object.keys(node.attributes)) {
            if (name === 'class' || name.startsWith('aria-') || name.startsWith('data-name')) {
              delete node.attributes[name];
              continue;
            }
            if (name === 'overflow') {
              const value = node.attributes[name];
              if (value !== 'hidden') {
                throw new ThemeCompilationError('Theme SVGs are always clipped.', [
                  errorDiagnostic(
                    'unsupported-svg-overflow',
                    'Only omitted or hidden overflow is allowed.',
                    options.path,
                  ),
                ]);
              }
              delete node.attributes[name];
              continue;
            }
            if (
              name === 'style' ||
              name === 'color' ||
              name === 'pointer-events' ||
              name.startsWith('on') ||
              !ALLOWED_ATTRIBUTES.has(name)
            ) {
              throw new ThemeCompilationError(`SVG attribute ${name} is not supported.`, [
                errorDiagnostic(
                  'unsupported-svg-attribute',
                  `${name} is not part of the Galapa SVG profile.`,
                  options.path,
                ),
              ]);
            }

            let value = node.attributes[name];
            if (PAINT_ATTRIBUTES.has(name)) {
              if (TOKEN.test(value)) {
                value = options.resolveColor(value, `${options.path}#${node.attributes.id ?? node.name}.${name}`);
                node.attributes[name] = value;
              }
              if (value === 'currentColor') {
                result.usesCurrentColor = true;
              } else if (value !== 'none' && !HEX.test(value) && !LOCAL_URL.test(value)) {
                throw new ThemeCompilationError(`Unsupported SVG paint ${value}.`, [
                  errorDiagnostic(
                    'unsupported-svg-paint',
                    'Paint must be hex, none, currentColor, a color token, or a local fragment URL.',
                    options.path,
                  ),
                ]);
              }
            }
            if (value.includes('url(')) {
              if (!LOCAL_URL.test(value)) {
                throw new ThemeCompilationError('SVG external references are not supported.', [
                  errorDiagnostic(
                    'external-svg-reference',
                    'Only same-document fragment references are supported.',
                    options.path,
                  ),
                ]);
              }
              references.push({ id: value.slice(value.indexOf('#') + 1, value.lastIndexOf(')')).trim(), owner: sliceStack.at(-1) });
            }
            if (name === 'href' || name === 'xlink:href') {
              if (!LOCAL_HREF.test(value)) {
                throw new ThemeCompilationError('SVG external references are not supported.', [
                  errorDiagnostic(
                    'external-svg-reference',
                    'Only same-document fragment references are supported.',
                    options.path,
                  ),
                ]);
              }
              references.push({ id: value.slice(1), owner: sliceStack.at(-1) });
            }
          }

          const id = node.attributes.id;
          if (id) {
            if (ids.has(id)) {
              throw new ThemeCompilationError(`Duplicate SVG id ${id}.`, [
                errorDiagnostic('duplicate-svg-id', `Duplicate SVG id ${id}.`, options.path),
              ]);
            }
            ids.set(id, sliceStack.at(-1));
          }

          if (parent.type === 'root' && node !== root) {
            throw new ThemeCompilationError('SVG must contain one root element.', [
              errorDiagnostic('invalid-svg', 'SVG must contain one root element.', options.path),
            ]);
          }
        },
        exit: (node) => {
          if (node.name === 'svg' && /^\d+_\d+$/.test(node.attributes.id ?? '')) {
            sliceStack.pop();
          }
          if (node !== root) return;
          for (const reference of references) {
            if (!ids.has(reference.id)) {
              throw new ThemeCompilationError(`Unknown SVG fragment #${reference.id}.`, [
                errorDiagnostic(
                  'unknown-svg-fragment',
                  `Unknown SVG fragment #${reference.id}.`,
                  options.path,
                ),
              ]);
            }
            if (options.profile === 'nine-slice' && ids.get(reference.id) !== reference.owner) {
              throw new ThemeCompilationError('Nine-slice cells must be self-contained.', [
                errorDiagnostic(
                  'cross-slice-reference',
                  `Fragment #${reference.id} is outside its slice.`,
                  options.path,
                ),
              ]);
            }
          }
          if (options.profile === 'nine-slice') {
            result.nineSlice = validateNineSlice(root, options.path, options.baseNineSlice);
          }
        },
      },
    }),
  };
}

export function compileSvg(source: string, options: SvgCompilerOptions): SvgCompileResult {
  const result: SvgCompileResult = {
    bytes: new Uint8Array(),
    usesCurrentColor: false,
    diagnostics: [],
  };
  try {
    const output = optimize(source, {
      multipass: false,
      plugins: [
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
        validationPlugin(options, result),
        'sortAttrs',
      ],
      js2svg: { pretty: false, indent: 0, finalNewline: true },
    });
    result.bytes = encoder.encode(output.data);
    return result;
  } catch (error) {
    if (error instanceof ThemeCompilationError) throw error;
    throw new ThemeCompilationError(`Could not compile ${options.path}.`, [
      errorDiagnostic(
        'invalid-svg',
        error instanceof Error ? error.message : `Could not compile ${options.path}.`,
        options.path,
      ),
    ]);
  }
}

export async function shortContentHash(bytes: Uint8Array): Promise<string> {
  const digest = new Uint8Array(
    await crypto.subtle.digest('SHA-256', Uint8Array.from(bytes)),
  );
  return [...digest]
    .slice(0, 6)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export class AssetCompiler {
  readonly resources = new Map<string, Uint8Array>();
  readonly diagnostics: ThemeDiagnostic[] = [];
  readonly materialAssets = new Set<string>();
  private readonly projectFiles: ReadonlyMap<string, Uint8Array>;
  private readonly resolveColor: (value: ColorValue, path?: string) => string;

  constructor(
    projectFiles: ReadonlyMap<string, Uint8Array>,
    resolveColor: (value: ColorValue, path?: string) => string,
  ) {
    this.projectFiles = projectFiles;
    this.resolveColor = resolveColor;
  }

  private async add(
    source: string,
    options: SvgCompilerOptions,
  ): Promise<CompiledAssetResource> {
    const compiled = compileSvg(source, options);
    const hash = await shortContentHash(compiled.bytes);
    const path = `./assets/${hash}.svg`;
    const existing = this.resources.get(path);
    if (existing && decoder.decode(existing) !== decoder.decode(compiled.bytes)) {
      throw new ThemeCompilationError(`Content hash collision at ${path}.`, [
        errorDiagnostic('content-hash-collision', `Content hash collision at ${path}.`),
      ]);
    }
    this.resources.set(path, compiled.bytes);
    this.diagnostics.push(...compiled.diagnostics);
    return {
      path,
      usesCurrentColor: compiled.usesCurrentColor,
      ...(compiled.nineSlice ? { nineSlice: compiled.nineSlice } : {}),
    };
  }

  async compileAsset(
    source: string,
    options: Parameters<ThemeResourceCompiler['compileAsset']>[1],
  ): Promise<CompiledAssetResource> {
    if (!/^\.\/assets\/(?!.*(?:^|\/)\.\.?\/)(?!.*\/\/)(?!.*\\)(?!.*%).+\.svg$/.test(source)) {
      throw new ThemeCompilationError(`Invalid SVG asset path ${source}.`, [
        errorDiagnostic('invalid-asset-path', `Invalid SVG asset path ${source}.`, options.path),
      ]);
    }
    const bytes = this.projectFiles.get(source.slice(2));
    if (!bytes) {
      throw new ThemeCompilationError(`Asset ${source} does not exist.`, [
        errorDiagnostic('missing-asset', `Asset ${source} does not exist.`, options.path),
      ]);
    }
    let text: string;
    try {
      text = decoder.decode(bytes);
    } catch {
      throw new ThemeCompilationError(`Asset ${source} is not UTF-8 SVG.`, [
        errorDiagnostic('invalid-svg', `Asset ${source} is not UTF-8 SVG.`, options.path),
      ]);
    }
    return this.add(text, { ...options, resolveColor: this.resolveColor });
  }

  async compileBuiltInAsset(
    family: 'material-input-hints' | 'news-gems',
    variant: string,
    path: string,
  ): Promise<CompiledAssetResource> {
    const source = builtInAsset(family, variant);
    if (!source) {
      throw new ThemeCompilationError(`Unknown built-in artwork ${family}/${variant}.`, [
        errorDiagnostic('missing-built-in-asset', `Unknown built-in artwork ${family}/${variant}.`, path),
      ]);
    }
    const compiled = await this.add(source, {
      profile: 'image',
      path,
      resolveColor: this.resolveColor,
    });
    if (family === 'material-input-hints') this.materialAssets.add(compiled.path);
    return compiled;
  }

  licenseEntries(): LicenseEntry[] {
    return this.materialAssets.size
      ? [{ files: [...this.materialAssets].sort(), license: 'Apache-2.0' }]
      : [];
  }
}
