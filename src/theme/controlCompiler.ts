import {
  CONTROL_CATALOG,
  ROOT_CONTROL_IDS,
  type CatalogControl,
  type RootControlId,
} from './catalog';
import {
  ThemeCompilationError,
  errorDiagnostic,
  type ThemeDiagnostic,
} from './diagnostics';
import type {
  ColorValue,
  PaintValue,
  ProjectModel,
  TypographyObject,
} from './schema';
import type { ResolveTokensResult } from './tokens';
import { validateProjectControl } from './validation';

export type NineSliceGeometry = {
  content: [number, number, number, number];
};

export type CompiledAssetResource = {
  path: string;
  usesCurrentColor: boolean;
  nineSlice?: NineSliceGeometry;
};

export type FontRequest = {
  source: string;
  weight: number;
  style: 'normal' | 'italic' | 'oblique';
  axes: Record<string, number>;
  path: string;
};

export type ThemeResourceCompiler = {
  compileAsset: (
    source: string,
    options: {
      profile: 'image' | 'nine-slice';
      path: string;
      baseNineSlice?: NineSliceGeometry;
    },
  ) => Promise<CompiledAssetResource>;
  compileBuiltInAsset: (
    family: 'material-input-hints' | 'news-gems',
    variant: string,
    path: string,
  ) => Promise<CompiledAssetResource>;
  compileFont: (request: FontRequest) => Promise<string>;
};

export type CompiledControlsResult = {
  controls: Record<string, unknown>;
  diagnostics: ThemeDiagnostic[];
};

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function deepMerge(base: unknown, overlay: unknown): unknown {
  if (!isObject(base) || !isObject(overlay)) return structuredClone(overlay);
  const result: JsonObject = structuredClone(base);
  for (const [key, value] of Object.entries(overlay)) {
    result[key] = key in result ? deepMerge(result[key], value) : structuredClone(value);
  }
  return result;
}

const edges = (value: unknown): [number, number, number, number] =>
  typeof value === 'number'
    ? [value, value, value, value]
    : (value as [number, number, number, number]);

function fail(diagnostics: ThemeDiagnostic[]): never {
  throw new ThemeCompilationError(
    diagnostics.length === 1
      ? diagnostics[0].message
      : `Theme compilation failed with ${diagnostics.length} errors.`,
    diagnostics,
  );
}

function prefixDiagnostics(
  prefix: string,
  diagnostics: readonly ThemeDiagnostic[],
): ThemeDiagnostic[] {
  return diagnostics.map((diagnostic) => ({
    ...diagnostic,
    path: diagnostic.path ? `${prefix}${diagnostic.path}` : prefix,
  }));
}

function requireField<T>(
  object: JsonObject,
  field: string,
  path: string,
  diagnostics: ThemeDiagnostic[],
): T | undefined {
  const value = object[field];
  if (value === undefined) {
    diagnostics.push(
      errorDiagnostic('missing-field', `Missing required ${field}.`, `${path}.${field}`),
    );
    return undefined;
  }
  return value as T;
}

function resolvePaint(
  value: PaintValue | undefined,
  tokens: ResolveTokensResult,
  path: string,
  fallback: string,
): string {
  if (value === undefined) return fallback;
  return value === 'none' ? value : tokens.resolveColor(value as ColorValue, path);
}

function resolveColor(
  object: JsonObject,
  field: string,
  tokens: ResolveTokensResult,
  path: string,
  diagnostics: ThemeDiagnostic[],
): string | undefined {
  const value = requireField<ColorValue>(object, field, path, diagnostics);
  return value === undefined ? undefined : tokens.resolveColor(value, `${path}.${field}`);
}

async function compileTypography(
  value: string | TypographyObject,
  capability: 'display' | 'editable',
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
): Promise<JsonObject | undefined> {
  const typography = tokens.resolveTypography(value, path);
  const source = typography.font;
  if (!source) {
    diagnostics.push(errorDiagnostic('missing-font', 'Typography requires font.', `${path}.font`));
  }
  if (typography.fontWeight === undefined) {
    diagnostics.push(
      errorDiagnostic(
        'missing-font-weight',
        'Typography requires fontWeight.',
        `${path}.fontWeight`,
      ),
    );
  }
  if (typography.fontSize === undefined) {
    diagnostics.push(
      errorDiagnostic('missing-font-size', 'Typography requires fontSize.', `${path}.fontSize`),
    );
  }
  if (capability === 'editable') {
    if (typography.textCase !== undefined && typography.textCase !== 'none') {
      diagnostics.push(
        errorDiagnostic(
          'unsupported-typography-field',
          'Editable text does not support textCase.',
          `${path}.textCase`,
        ),
      );
    }
    if (typography.textDecoration?.length) {
      diagnostics.push(
        errorDiagnostic(
          'unsupported-typography-field',
          'Editable text does not support textDecoration.',
          `${path}.textDecoration`,
        ),
      );
    }
  }
  const axes = typography.fontAxes ?? {};
  for (const tag of ['wght', 'ital', 'slnt']) {
    if (tag in axes) {
      diagnostics.push(
        errorDiagnostic(
          'conflicting-font-axis',
          `${tag} belongs in fontWeight or fontStyle, not fontAxes.`,
          `${path}.fontAxes.${tag}`,
        ),
      );
    }
  }
  if (!source || typography.fontWeight === undefined || typography.fontSize === undefined) {
    return undefined;
  }

  const style = typography.fontStyle ?? 'normal';
  const font = await resources.compileFont({
    source,
    weight: typography.fontWeight,
    style,
    axes,
    path,
  });
  const common: JsonObject = {
    font,
    fontWeight: typography.fontWeight,
    fontStyle: style,
    fontSize: typography.fontSize,
    lineHeight: typography.lineHeight ?? 1,
    letterSpacing: typography.letterSpacing ?? 0,
    fontFeatures: typography.fontFeatures ?? {},
  };
  if (capability === 'display') {
    common.textCase = typography.textCase ?? 'none';
    common.textDecoration = typography.textDecoration ?? [];
  }
  return common;
}

function baseWithoutStates(control: JsonObject): JsonObject {
  return Object.fromEntries(
    Object.entries(control).filter(([key]) => key !== 'states' && key !== 'parts' && key !== '$schema'),
  );
}

async function compileAssetFields(
  control: JsonObject,
  entry: CatalogControl,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
  profile: 'image' | 'nine-slice',
  baseNineSlice?: NineSliceGeometry,
): Promise<{ asset?: string; currentColor?: string; resource?: CompiledAssetResource }> {
  const sourceValue = control.asset as string | undefined;
  if (!sourceValue) {
    if (entry.assetRequired || profile === 'nine-slice') {
      diagnostics.push(errorDiagnostic('missing-asset', 'Missing required asset.', `${path}.asset`));
    }
    return {};
  }
  const source = tokens.resolveAsset(sourceValue, `${path}.asset`);
  const resource = await resources.compileAsset(source, { profile, path, baseNineSlice });
  const currentColorValue = control.currentColor as ColorValue | undefined;
  if (resource.usesCurrentColor && currentColorValue === undefined) {
    diagnostics.push(
      errorDiagnostic(
        'missing-current-color',
        'This SVG uses currentColor, so the consuming control must supply currentColor.',
        `${path}.currentColor`,
      ),
    );
  }
  return {
    asset: resource.path,
    ...(currentColorValue !== undefined
      ? { currentColor: tokens.resolveColor(currentColorValue, `${path}.currentColor`) }
      : {}),
    resource,
  };
}

async function compileVariantAssets(
  control: JsonObject,
  entry: CatalogControl,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
): Promise<{ assets: Record<string, string>; anyUsesCurrentColor: boolean }> {
  const sourceAssets = isObject(control.assets) ? control.assets : {};
  const assets: Record<string, string> = {};
  let anyUsesCurrentColor = false;
  for (const variant of entry.variants?.keys ?? []) {
    const value = sourceAssets[variant];
    let resource: CompiledAssetResource;
    if (typeof value === 'string') {
      resource = await resources.compileAsset(tokens.resolveAsset(value, `${path}.assets.${variant}`), {
        profile: 'image',
        path: `${path}.assets.${variant}`,
      });
    } else if (entry.variants?.compilerDefaults) {
      resource = await resources.compileBuiltInAsset(
        entry.variants.compilerDefaults,
        variant,
        `${path}.assets.${variant}`,
      );
    } else {
      diagnostics.push(
        errorDiagnostic(
          'missing-variant',
          `Missing required ${variant} asset.`,
          `${path}.assets.${variant}`,
        ),
      );
      continue;
    }
    assets[variant] = resource.path;
    anyUsesCurrentColor ||= resource.usesCurrentColor;
  }
  return { assets, anyUsesCurrentColor };
}

async function compileBaseControl(
  source: JsonObject,
  entry: CatalogControl,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
  baseNineSlice?: NineSliceGeometry,
): Promise<JsonObject> {
  switch (entry.kind) {
    case 'composite':
      return {};
    case 'window': {
      const fill = resolveColor(source, 'fill', tokens, path, diagnostics);
      return {
        ...(fill ? { fill } : {}),
        borderColor: resolvePaint(
          source.borderColor as PaintValue | undefined,
          tokens,
          `${path}.borderColor`,
          'none',
        ),
      };
    }
    case 'focus-ring': {
      const color = resolveColor(source, 'color', tokens, path, diagnostics);
      return {
        ...(color ? { color } : {}),
        width: source.width ?? 2,
        offset: source.offset ?? -2,
      };
    }
    case 'text': {
      const color = resolveColor(source, 'color', tokens, path, diagnostics);
      const typographyValue = requireField<string | TypographyObject>(
        source,
        'typography',
        path,
        diagnostics,
      );
      const typography = typographyValue
        ? await compileTypography(
            typographyValue,
            entry.typography ?? 'display',
            tokens,
            resources,
            `${path}.typography`,
            diagnostics,
          )
        : undefined;
      return {
        ...(color ? { color } : {}),
        ...(typography ? { typography } : {}),
        opacity: source.opacity ?? 1,
        ...(entry.leftInset
          ? { leftInset: source.leftInset ?? entry.leftInset.default }
          : {}),
      };
    }
    case 'paint': {
      const color = resolveColor(source, 'color', tokens, path, diagnostics);
      return { ...(color ? { color } : {}), opacity: source.opacity ?? 1 };
    }
    case 'image': {
      const compiled = await compileAssetFields(
        source,
        entry,
        tokens,
        resources,
        path,
        diagnostics,
        'image',
      );
      return {
        ...(compiled.asset ? { asset: compiled.asset } : {}),
        ...(compiled.currentColor ? { currentColor: compiled.currentColor } : {}),
        opacity: source.opacity ?? 1,
        ...(source.size ? { size: source.size } : {}),
      };
    }
    case 'variant-image': {
      const variants = await compileVariantAssets(
        source,
        entry,
        tokens,
        resources,
        path,
        diagnostics,
      );
      const currentColorValue = source.currentColor as ColorValue | undefined;
      if (variants.anyUsesCurrentColor && currentColorValue === undefined) {
        diagnostics.push(
          errorDiagnostic(
            'missing-current-color',
            'At least one variant uses currentColor.',
            `${path}.currentColor`,
          ),
        );
      }
      return {
        assets: variants.assets,
        ...(currentColorValue !== undefined
          ? { currentColor: tokens.resolveColor(currentColorValue, `${path}.currentColor`) }
          : {}),
        opacity: source.opacity ?? 1,
        ...(source.size ? { size: source.size } : {}),
      };
    }
    case 'frame': {
      if (source.shape === 'asset') {
        const compiled = await compileAssetFields(
          source,
          entry,
          tokens,
          resources,
          path,
          diagnostics,
          'nine-slice',
          baseNineSlice,
        );
        return {
          shape: 'asset',
          ...(compiled.asset ? { asset: compiled.asset } : {}),
          ...(compiled.currentColor ? { currentColor: compiled.currentColor } : {}),
          opacity: source.opacity ?? 1,
          ...(source.size ? { size: source.size } : {}),
          ...(compiled.resource?.nineSlice ? { __nineSlice: compiled.resource.nineSlice } : {}),
        };
      }
      const border = isObject(source.border) ? source.border : {};
      return {
        shape: 'path',
        radius: source.radius ?? 0,
        corner: source.corner ?? 'round',
        fill: resolvePaint(
          source.fill as PaintValue | undefined,
          tokens,
          `${path}.fill`,
          'none',
        ),
        border: {
          color: resolvePaint(
            border.color as PaintValue | undefined,
            tokens,
            `${path}.border.color`,
            'none',
          ),
          thickness: edges(border.thickness ?? 0),
        },
        padding: edges(source.padding ?? 0),
        opacity: source.opacity ?? 1,
        ...(source.size ? { size: source.size } : {}),
      };
    }
  }
}

function stateOutput(control: JsonObject, entry: CatalogControl): JsonObject {
  const allowed =
    entry.kind === 'frame'
      ? control.shape === 'asset'
        ? ['asset', 'currentColor', 'opacity']
        : ['radius', 'corner', 'fill', 'border', 'opacity']
      : entry.kind === 'image'
        ? ['asset', 'currentColor', 'opacity']
        : entry.kind === 'variant-image'
          ? ['assets', 'currentColor', 'opacity']
          : entry.kind === 'text' || entry.kind === 'paint'
            ? ['color', 'opacity']
            : [];
  return Object.fromEntries(
    Object.entries(control).filter(([key]) => allowed.includes(key)),
  );
}

async function compileControl(
  source: JsonObject,
  entry: CatalogControl,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
): Promise<JsonObject> {
  const baseSource = baseWithoutStates(source);
  const compiled = await compileBaseControl(
    baseSource,
    entry,
    tokens,
    resources,
    path,
    diagnostics,
  );
  const baseNineSlice = compiled.__nineSlice as NineSliceGeometry | undefined;
  delete compiled.__nineSlice;

  const sourceStates = isObject(source.states) ? source.states : {};
  const states: Record<string, JsonObject> = {};
  for (const state of entry.states ?? []) {
    const override = sourceStates[state];
    if (!isObject(override)) continue;
    const merged = deepMerge(baseSource, override) as JsonObject;
    const stateCompiled = await compileBaseControl(
      merged,
      entry,
      tokens,
      resources,
      `${path}.states.${state}`,
      diagnostics,
      baseNineSlice,
    );
    if (state === 'focused' && entry.focusRingOwner) {
      stateCompiled.showRing = override.showRing ?? true;
    }
    states[state] = stateOutput(stateCompiled, entry);
  }
  if (Object.keys(states).length) compiled.states = states;
  return compiled;
}

async function compileControlDocument(
  source: JsonObject,
  entry: CatalogControl,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
  path: string,
  diagnostics: ThemeDiagnostic[],
): Promise<JsonObject> {
  const compiled = await compileControl(source, entry, tokens, resources, path, diagnostics);
  if (entry.parts) {
    const sourceParts = isObject(source.parts) ? source.parts : {};
    const parts: Record<string, JsonObject> = {};
    for (const [name, part] of Object.entries(entry.parts)) {
      const sourcePart = sourceParts[name];
      if (!isObject(sourcePart)) {
        if (part.required) {
          diagnostics.push(
            errorDiagnostic(
              'missing-part',
              `Missing required ${path}.${name} part.`,
              `${path}.parts.${name}`,
            ),
          );
        }
        continue;
      }
      parts[name] = await compileControl(
        sourcePart,
        part,
        tokens,
        resources,
        `${path}.parts.${name}`,
        diagnostics,
      );
    }
    if (Object.keys(parts).length) compiled.parts = parts;
  }
  return compiled;
}

export async function compileThemeControls(
  project: ProjectModel,
  tokens: ResolveTokensResult,
  resources: ThemeResourceCompiler,
): Promise<CompiledControlsResult> {
  const diagnostics: ThemeDiagnostic[] = [...tokens.diagnostics];
  const controls: Record<string, unknown> = {};

  for (const unknownId of Object.keys(project.controls)) {
    if (!ROOT_CONTROL_IDS.includes(unknownId as RootControlId)) {
      diagnostics.push(
        errorDiagnostic('unknown-control', `Unknown control ${unknownId}.`, `controls.${unknownId}`),
      );
    }
  }

  for (const id of ROOT_CONTROL_IDS) {
    const entry: CatalogControl = CONTROL_CATALOG[id];
    const source = project.controls[id];
    if (!isObject(source)) {
      if (entry.required) {
        diagnostics.push(
          errorDiagnostic('missing-control', `Missing required control ${id}.`, `controls.${id}`),
        );
      }
      continue;
    }
    diagnostics.push(
      ...prefixDiagnostics(`controls.${id}`, validateProjectControl(id, source)),
    );
    controls[id] = await compileControlDocument(
      source,
      entry,
      tokens,
      resources,
      `controls.${id}`,
      diagnostics,
    );
  }

  if (diagnostics.some((diagnostic) => diagnostic.severity === 'error')) {
    fail(diagnostics.filter((diagnostic) => diagnostic.severity === 'error'));
  }
  return { controls, diagnostics };
}
