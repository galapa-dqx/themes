import {
  converter,
  displayable,
  formatHex,
  formatHex8,
  interpolateWith,
  parse,
  toGamut,
  type Color,
  type Mode,
} from 'culori';
import type {
  ColorMix,
  ColorValue,
  ProjectTokens,
  TypographyObject,
} from './schema';
import {
  ThemeCompilationError,
  errorDiagnostic,
  type ThemeDiagnostic,
} from './diagnostics';

const referencePattern =
  /^\{(colors|fonts|typography|assets)\.([a-z][a-z0-9]*(?:-[a-z0-9]+)*)\}$/;

export type TokenCategory = 'colors' | 'fonts' | 'typography' | 'assets';

export type TokenReference = {
  category: TokenCategory;
  name: string;
};

export type ResolvedTypography = Omit<TypographyObject, '$extends' | 'font'> & {
  font?: string;
};

export type ResolvedTokens = {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  typography: Record<string, ResolvedTypography>;
  assets: Record<string, string>;
};

type ResolvedTokenInternals = ResolvedTokens & {
  colorObjects: Record<string, Color>;
};

function withoutExtends(value: TypographyObject): ResolvedTypography {
  return Object.fromEntries(
    Object.entries(value).filter(([key]) => key !== '$extends'),
  ) as ResolvedTypography;
}

export function parseTokenReference(value: string): TokenReference | undefined {
  const match = referencePattern.exec(value);
  if (!match) return undefined;
  return { category: match[1] as TokenCategory, name: match[2] };
}

function tokenError(
  code: string,
  message: string,
  path: string,
): ThemeCompilationError {
  return new ThemeCompilationError(message, [errorDiagnostic(code, message, path)]);
}

function requireReference(
  value: string,
  expected: TokenCategory,
  path: string,
): TokenReference | undefined {
  const reference = parseTokenReference(value);
  if (!reference) return undefined;
  if (reference.category !== expected) {
    throw tokenError(
      'token-type-mismatch',
      `Expected a ${expected} reference, but found ${reference.category}.`,
      path,
    );
  }
  return reference;
}

function cycleError(category: TokenCategory, stack: readonly string[]): never {
  const chain = stack.map((name) => `{${category}.${name}}`).join(' → ');
  throw tokenError(
    'token-cycle',
    `Token reference cycle: ${chain}.`,
    `tokens.${category}.${stack[0]}`,
  );
}

const premultiply = (value: number, channel: string, color: Color) =>
  channel === 'alpha' || channel === 'h'
    ? value
    : (value || 0) * (color.alpha ?? 1);

const unpremultiply = (value: number, channel: string, color: Color) =>
  channel === 'alpha' || channel === 'h' || color.alpha === 0
    ? value
    : (value || 0) / (color.alpha ?? 1);

const premultipliedInterpolate = interpolateWith(premultiply, unpremultiply);
const interpolateColor = premultipliedInterpolate as unknown as (
  colors: [Color, Color],
  mode: Mode,
) => (amount: number) => Color;
const toSrgbGamut = toGamut('rgb', 'oklch');
const toRgb = converter('rgb');

function formatSrgb(color: Color): string {
  const mapped = toSrgbGamut(color);
  const rgb = toRgb(mapped);
  return (rgb.alpha ?? 1) < 1 ? formatHex8(rgb) : formatHex(rgb);
}

function colorFromLiteral(value: string, path: string): Color {
  const color = parse(value);
  if (!color) {
    throw tokenError('invalid-color', `Invalid color ${JSON.stringify(value)}.`, path);
  }
  return color;
}

function mixColor(
  mix: ColorMix,
  operand: (value: string, path: string) => Color,
  path: string,
): Color {
  const [from, to] = mix.inputs;
  const mode = (mix.space === 'srgb' ? 'rgb' : mix.space === 'srgb-linear' ? 'lrgb' : mix.space) as Mode;
  return interpolateColor(
    [operand(from, `${path}.inputs.0`), operand(to, `${path}.inputs.1`)],
    mode,
  )(mix.amount);
}

function resolveSimpleCategory(
  category: 'fonts' | 'assets',
  source: Record<string, string>,
): Record<string, string> {
  const resolved: Record<string, string> = {};
  const visiting = new Set<string>();

  const resolve = (name: string, stack: string[]): string => {
    if (resolved[name] !== undefined) return resolved[name];
    if (visiting.has(name)) cycleError(category, [...stack, name]);
    const value = source[name];
    if (value === undefined) {
      throw tokenError(
        'unknown-token',
        `Unknown token {${category}.${name}}.`,
        `tokens.${category}.${name}`,
      );
    }
    visiting.add(name);
    const reference = requireReference(value, category, `tokens.${category}.${name}`);
    const result = reference ? resolve(reference.name, [...stack, name]) : value;
    visiting.delete(name);
    resolved[name] = result;
    return result;
  };

  for (const name of Object.keys(source)) resolve(name, []);
  return resolved;
}

function resolveTypographyCategory(
  source: Record<string, string | TypographyObject>,
  fonts: Record<string, string>,
): Record<string, ResolvedTypography> {
  const resolved: Record<string, ResolvedTypography> = {};
  const visiting = new Set<string>();

  const resolve = (name: string, stack: string[]): ResolvedTypography => {
    if (resolved[name] !== undefined) return resolved[name];
    if (visiting.has(name)) cycleError('typography', [...stack, name]);
    const value = source[name];
    if (value === undefined) {
      throw tokenError(
        'unknown-token',
        `Unknown token {typography.${name}}.`,
        `tokens.typography.${name}`,
      );
    }
    visiting.add(name);

    let result: ResolvedTypography;
    if (typeof value === 'string') {
      const reference = requireReference(value, 'typography', `tokens.typography.${name}`);
      if (!reference) {
        throw tokenError(
          'invalid-typography-reference',
          'A string typography token must be an atomic typography reference.',
          `tokens.typography.${name}`,
        );
      }
      result = { ...resolve(reference.name, [...stack, name]) };
    } else {
      const base = value.$extends
        ? (() => {
            const reference = requireReference(
              value.$extends,
              'typography',
              `tokens.typography.${name}.$extends`,
            );
            if (!reference) {
              throw tokenError(
                'invalid-extends',
                '$extends must be an atomic typography reference.',
                `tokens.typography.${name}.$extends`,
              );
            }
            return resolve(reference.name, [...stack, name]);
          })()
        : {};
      result = { ...base, ...withoutExtends(value) };
    }

    if (result.font) {
      const fontReference = requireReference(
        result.font,
        'fonts',
        `tokens.typography.${name}.font`,
      );
      if (fontReference) {
        const font = fonts[fontReference.name];
        if (font === undefined) {
          throw tokenError(
            'unknown-token',
            `Unknown token {fonts.${fontReference.name}}.`,
            `tokens.typography.${name}.font`,
          );
        }
        result.font = font;
      }
    }

    visiting.delete(name);
    resolved[name] = result;
    return result;
  };

  for (const name of Object.keys(source)) resolve(name, []);
  return resolved;
}

export type ResolveTokensResult = {
  tokens: ResolvedTokens;
  diagnostics: ThemeDiagnostic[];
  resolveColor: (value: ColorValue, path?: string) => string;
  resolveTypography: (
    value: string | TypographyObject,
    path?: string,
  ) => ResolvedTypography;
  resolveAsset: (value: string, path?: string) => string;
  resolveFont: (value: string, path?: string) => string;
};

export function resolveTokens(project: ProjectTokens): ResolveTokensResult {
  const diagnostics: ThemeDiagnostic[] = [];
  const sourceColors = project.colors ?? {};
  const colorObjects: Record<string, Color> = {};
  const colorVisiting = new Set<string>();

  const resolveColorOperand = (value: string, path: string): Color => {
    const reference = requireReference(value, 'colors', path);
    return reference ? resolveColorToken(reference.name, [], path) : colorFromLiteral(value, path);
  };

  const resolveColorToken = (
    name: string,
    stack: string[],
    path = `tokens.colors.${name}`,
  ): Color => {
    if (colorObjects[name] !== undefined) return colorObjects[name];
    if (colorVisiting.has(name)) cycleError('colors', [...stack, name]);
    const value = sourceColors[name];
    if (value === undefined) {
      throw tokenError('unknown-token', `Unknown token {colors.${name}}.`, path);
    }
    colorVisiting.add(name);
    const result =
      typeof value === 'string'
        ? (() => {
            const reference = requireReference(value, 'colors', path);
            return reference
              ? resolveColorToken(reference.name, [...stack, name], path)
              : colorFromLiteral(value, path);
          })()
        : mixColor(value, resolveColorOperand, path);
    colorVisiting.delete(name);
    colorObjects[name] = result;
    return result;
  };

  for (const name of Object.keys(sourceColors)) resolveColorToken(name, []);

  const fonts = resolveSimpleCategory('fonts', project.fonts ?? {});
  const assets = resolveSimpleCategory('assets', project.assets ?? {});
  const typography = resolveTypographyCategory(project.typography ?? {}, fonts);
  const colors = Object.fromEntries(
    Object.entries(colorObjects).map(([name, color]) => [name, formatSrgb(color)]),
  );

  const internals: ResolvedTokenInternals = {
    colors,
    fonts,
    typography,
    assets,
    colorObjects,
  };

  const resolveColor = (value: ColorValue, path = 'color'): string => {
    const color =
      typeof value === 'string'
        ? resolveColorOperand(value, path)
        : mixColor(value, resolveColorOperand, path);
    if (!displayable(color)) {
      diagnostics.push({
        severity: 'info',
        code: 'color-out-of-gamut',
        message: 'This color is outside sRGB and will be gamut-mapped.',
        path,
      });
    }
    return formatSrgb(color);
  };

  const resolveTypography = (
    value: string | TypographyObject,
    path = 'typography',
  ): ResolvedTypography => {
    let result: ResolvedTypography;
    if (typeof value === 'string') {
      const reference = requireReference(value, 'typography', path);
      if (!reference || internals.typography[reference.name] === undefined) {
        throw tokenError('unknown-token', `Unknown typography token ${value}.`, path);
      }
      result = { ...internals.typography[reference.name] };
    } else {
      const base = value.$extends
        ? (() => {
            const reference = requireReference(value.$extends, 'typography', `${path}.$extends`);
            if (!reference || internals.typography[reference.name] === undefined) {
              throw tokenError('unknown-token', `Unknown typography token ${value.$extends}.`, `${path}.$extends`);
            }
            return internals.typography[reference.name];
          })()
        : {};
      result = { ...base, ...withoutExtends(value) };
    }
    if (result.font) {
      const reference = requireReference(result.font, 'fonts', `${path}.font`);
      if (reference) {
        const font = internals.fonts[reference.name];
        if (font === undefined) {
          throw tokenError('unknown-token', `Unknown font token ${result.font}.`, `${path}.font`);
        }
        result.font = font;
      }
    }
    return result;
  };

  const resolveString = (
    value: string,
    category: 'fonts' | 'assets',
    path: string,
  ): string => {
    const reference = requireReference(value, category, path);
    if (!reference) return value;
    const result = internals[category][reference.name];
    if (result === undefined) {
      throw tokenError('unknown-token', `Unknown token ${value}.`, path);
    }
    return result;
  };

  return {
    tokens: { colors, fonts, typography, assets },
    diagnostics,
    resolveColor,
    resolveTypography,
    resolveAsset: (value, path = 'asset') => resolveString(value, 'assets', path),
    resolveFont: (value, path = 'font') => resolveString(value, 'fonts', path),
  };
}
