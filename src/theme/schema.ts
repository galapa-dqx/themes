/**
 * Galapa Theme V2 project and compiled-theme schemas, derived from the
 * control catalog. Every schema is a portable TypeBox value; `JSON.stringify`
 * is the JSON Schema emitter.
 *
 * Static types are inferred from the *wide* shape of each control kind (the
 * most permissive form a role can take). Runtime schemas narrow that shape per
 * role, so any value that validates always fits the inferred type.
 */
import Type, {
  type Static,
  type TBoolean,
  type TObject,
  type TOptional,
  type TProperties,
  type TSchema,
} from 'typebox';
import {
  CONTROL_CATALOG,
  ROOT_CONTROL_IDS,
  type CatalogEntry,
  type RootControlId,
} from './catalog';

export const THEME_FORMAT_VERSION = 1;
export const PROJECT_MAGIC = 'GLPTHPRJ';
export const THEME_MAGIC = 'GLPTHEME';
export const PROJECT_EXTENSION = '.galapathemeproj';
export const THEME_EXTENSION = '.galapatheme';
export const schemaUrl = (path: string) =>
  `https://galapa-dqx.github.io/themes/theme-project/${path}.schema.json`;

// ---------------------------------------------------------------- primitives

const Opt = Type.Optional;
const closed = <P extends TProperties>(p: P) =>
  Type.Object(p, { additionalProperties: false });
/**
 * Fixed-length tuple in JSON Schema 2020-12 form. TypeBox 1.x validates
 * `prefixItems` fine but `Type.Tuple` still emits the draft-07 `items` array.
 * TODO: replace with `Type.Tuple` once TypeBox emits 2020-12 tuples.
 */
const tuple = <T extends TSchema[]>(...items: T) =>
  Type.Unsafe<{ [K in keyof T]: Static<T[K]> }>({
    type: 'array',
    prefixItems: items,
    items: false,
    minItems: items.length,
  });

const Finite = Type.Number();
const Nonneg = Type.Number({ minimum: 0 });
const Positive = Type.Number({ exclusiveMinimum: 0 });
const Opacity = Type.Number({ minimum: 0, maximum: 1 });
const HttpsUrl = Type.String({ pattern: '^https://' });

const KEBAB = '[a-z0-9]+(?:-[a-z0-9]+)*';
const ref = (category: string) =>
  Type.String({ pattern: `^\\{${category}\\.${KEBAB}\\}$` });
const tokenRecord = <V extends TSchema>(value: V) =>
  Type.Record(Type.String({ pattern: `^${KEBAB}$` }), value, {
    additionalProperties: false,
  });

// Lowercase, no `.`/`..` segments, no empty segments, backslashes, or percent escapes.
const SEGMENT = '(?!\\.{1,2}(?:/|$))[^A-Z/\\\\%]+';
const projectPath = (ext: string) =>
  Type.String({
    pattern: `^\\./assets/(?:${SEGMENT}/)*${SEGMENT}\\.(?:${ext})$`,
  });
const compiledPath = (dir: string, ext: string) =>
  Type.String({ pattern: `^\\./${dir}/[0-9a-f]{12}\\.(?:${ext})$` });

// ---------------------------------------------------------------- values

export const HexColor = Type.String({
  pattern: '^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$',
});
const MixInput = Type.Union([HexColor, ref('colors')]);
export const ColorMix = closed({
  $type: Type.Literal('mix'),
  inputs: tuple(MixInput, MixInput),
  amount: Opacity,
  space: Type.Enum(['srgb', 'srgb-linear', 'lab', 'lch', 'oklab', 'oklch']),
});
export const ProjectColor = Type.Union([HexColor, ref('colors'), ColorMix]);
const None = Type.Literal('none');
export const ProjectPaint = Type.Union([ProjectColor, None]);
export const CompiledPaint = Type.Union([HexColor, None]);

export const ProjectSvg = Type.Union([projectPath('svg'), ref('assets')]);
export const CompiledSvg = compiledPath('assets', 'svg');
export const ProjectFont = Type.Union([
  Type.String({ pattern: '^gfont:[A-Za-z0-9+%._-]+$' }),
  projectPath('ttf|ttc|otf|otc'),
  ref('fonts'),
]);
export const CompiledFont = compiledPath('assets/fonts', 'ttf|otf');

const tagRecord = <V extends TSchema>(value: V) =>
  Type.Record(Type.String({ pattern: '^[\\x20-\\x7e]{4}$' }), value, {
    additionalProperties: false,
  });
const FontAxes = tagRecord(Finite);
const FontFeatures = tagRecord(
  Type.Union([Type.Boolean(), Type.Integer({ minimum: 0 })]),
);
const FontWeight = Type.Integer({ minimum: 1, maximum: 1000 });
const FontStyle = Type.Enum(['normal', 'italic', 'oblique']);
const TextCase = Type.Enum(['none', 'uppercase', 'lowercase']);
/** Where a part sits relative to its owner's box. */
const Placement = Type.Enum(['straddle', 'inside']);
const TextDecoration = Type.Array(
  Type.Enum(['underline', 'strikethrough', 'overline', 'baseline']),
  { uniqueItems: true },
);

const projectTypographyCore = {
  $extends: Opt(ref('typography')),
  font: Opt(ProjectFont),
  fontWeight: Opt(FontWeight),
  fontStyle: Opt(FontStyle),
  fontAxes: Opt(FontAxes),
  fontSize: Opt(Positive),
  lineHeight: Opt(Positive),
  letterSpacing: Opt(Finite),
  fontFeatures: Opt(FontFeatures),
};
export const ProjectTypographyEditable = closed(projectTypographyCore);
export const ProjectTypographyDisplay = closed({
  ...projectTypographyCore,
  textCase: Opt(TextCase),
  textDecoration: Opt(TextDecoration),
});
const projectTypography = (cap: CatalogEntry['typography']) =>
  Type.Union([
    ref('typography'),
    cap === 'editable' ? ProjectTypographyEditable : ProjectTypographyDisplay,
  ]);

const compiledTypographyCore = {
  font: CompiledFont,
  fontWeight: FontWeight,
  fontStyle: FontStyle,
  fontSize: Positive,
  lineHeight: Positive,
  letterSpacing: Finite,
  fontFeatures: FontFeatures,
};
export const CompiledTypographyEditable = closed(compiledTypographyCore);
export const CompiledTypographyDisplay = closed({
  ...compiledTypographyCore,
  textCase: TextCase,
  textDecoration: TextDecoration,
});

const Radius = Type.Union([Nonneg, Type.Literal('pill')]);
const Corner = Type.Enum(['round', 'bevel', 'scoop', 'notch', 'squircle']);
const Thickness4 = tuple(Nonneg, Nonneg, Nonneg, Nonneg);
const ProjectThickness = Type.Union([Nonneg, Thickness4]);

// ---------------------------------------------------------------- wide shapes
// Widest instances: they type the kinds and seed per-role narrowing.

const WideSize = Opt(closed({ width: Opt(Positive), height: Opt(Positive) }));
const wideStates = <T extends TObject>(state: T) =>
  Opt(
    closed({
      disabled: Opt(state),
      checked: Opt(state),
      selected: Opt(state),
      pressed: Opt(state),
      hover: Opt(state),
      focused: Opt(
        closed({
          ...state.properties,
          showRing: Opt(Type.Boolean()),
        } as T['properties'] & {
          showRing: TOptional<TBoolean>;
        }),
      ),
    }),
  );

const ProjectPathState = closed({
  radius: Opt(Radius),
  corner: Opt(Corner),
  fill: Opt(ProjectPaint),
  border: Opt(
    closed({ color: Opt(ProjectPaint), thickness: Opt(ProjectThickness) }),
  ),
  opacity: Opt(Opacity),
});
const ProjectAssetState = closed({
  asset: Opt(ProjectSvg),
  currentColor: Opt(ProjectColor),
  opacity: Opt(Opacity),
});
export const ProjectPathFrame = closed({
  shape: Type.Literal('path'),
  ...ProjectPathState.properties,
  padding: Opt(ProjectThickness),
  size: WideSize,
  states: wideStates(ProjectPathState),
});
export const ProjectAssetFrame = closed({
  shape: Type.Literal('asset'),
  ...ProjectAssetState.properties,
  size: WideSize,
  states: wideStates(ProjectAssetState),
});
const ProjectTextState = closed({
  color: Opt(ProjectColor),
  opacity: Opt(Opacity),
});
export const ProjectText = closed({
  color: ProjectColor,
  typography: Type.Union([ref('typography'), ProjectTypographyDisplay]),
  opacity: Opt(Opacity),
  leftInset: Opt(Finite),
  states: wideStates(ProjectTextState),
});
export const ProjectPaintControl = closed({
  color: ProjectColor,
  opacity: Opt(Opacity),
  states: wideStates(ProjectTextState),
});
export const ProjectImage = closed({
  ...ProjectAssetState.properties,
  size: WideSize,
  states: wideStates(ProjectAssetState),
});
const ProjectVariantState = closed({
  assets: Opt(Type.Record(Type.String(), ProjectSvg)),
  currentColor: Opt(ProjectColor),
  opacity: Opt(Opacity),
});
export const ProjectVariantImage = closed({
  ...ProjectVariantState.properties,
  placement: Opt(Placement),
  size: WideSize,
  states: wideStates(ProjectVariantState),
});
export const ProjectWindow = closed({
  fill: ProjectColor,
  borderColor: Opt(ProjectPaint),
});
export const ProjectFocusRing = closed({
  color: ProjectColor,
  width: Opt(Nonneg),
  offset: Opt(Finite),
});

const CompiledPathBase = closed({
  shape: Type.Literal('path'),
  radius: Radius,
  corner: Corner,
  fill: CompiledPaint,
  border: closed({ color: CompiledPaint, thickness: Thickness4 }),
  padding: Thickness4,
  opacity: Opacity,
  size: WideSize,
});
const CompiledAssetBase = closed({
  shape: Type.Literal('asset'),
  asset: CompiledSvg,
  currentColor: Opt(HexColor),
  opacity: Opacity,
  size: WideSize,
});
export const CompiledPathFrame = closed({
  ...CompiledPathBase.properties,
  states: wideStates(CompiledPathBase),
});
export const CompiledAssetFrame = closed({
  ...CompiledAssetBase.properties,
  states: wideStates(CompiledAssetBase),
});
const CompiledTextBase = closed({
  color: HexColor,
  typography: CompiledTypographyDisplay,
  opacity: Opacity,
  leftInset: Opt(Finite),
});
export const CompiledText = closed({
  ...CompiledTextBase.properties,
  states: wideStates(CompiledTextBase),
});
const CompiledPaintBase = closed({ color: HexColor, opacity: Opacity });
export const CompiledPaintControl = closed({
  ...CompiledPaintBase.properties,
  states: wideStates(CompiledPaintBase),
});
const CompiledImageBase = closed({
  asset: Opt(CompiledSvg),
  currentColor: Opt(HexColor),
  opacity: Opacity,
  size: WideSize,
});
export const CompiledImage = closed({
  ...CompiledImageBase.properties,
  states: wideStates(CompiledImageBase),
});
const CompiledVariantBase = closed({
  assets: Type.Record(Type.String(), CompiledSvg),
  currentColor: Opt(HexColor),
  opacity: Opacity,
  placement: Opt(Placement),
  size: WideSize,
});
export const CompiledVariantImage = closed({
  ...CompiledVariantBase.properties,
  states: wideStates(CompiledVariantBase),
});
export const CompiledWindow = closed({
  fill: HexColor,
  borderColor: CompiledPaint,
});
export const CompiledFocusRing = closed({
  color: HexColor,
  width: Nonneg,
  offset: Finite,
});

// ---------------------------------------------------------------- per-role narrowing

type Overrides = Record<string, TSchema | undefined>;

/** Copy a wide shape, replacing or (when `undefined`) deleting properties. */
const narrow = (shape: TObject, overrides: Overrides): TObject => {
  const props: TProperties = { ...shape.properties };
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete props[k];
    else props[k] = v;
  }
  return closed(props);
};

/** Add properties to an object schema or to every branch of a union. */
const extend = (schema: TSchema, props: TProperties): TSchema =>
  Type.IsUnion(schema)
    ? Type.Union(schema.anyOf.map((s) => extend(s, props)))
    : closed({ ...(schema as TObject).properties, ...props });

const size = (e: CatalogEntry) =>
  e.size
    ? Opt(
        closed(
          Object.fromEntries(
            Object.keys(e.size).map((a) => [a, Opt(Positive)]),
          ),
        ),
      )
    : undefined;

const states = (e: CatalogEntry, state: TObject, showRing?: TSchema) => {
  if (!e.states?.length) return undefined;
  const props: TProperties = {};
  for (const s of e.states) {
    const owner = s === 'focused' && e.focusRingOwner && showRing;
    props[s] = Opt(owner ? closed({ ...state.properties, showRing }) : state);
  }
  return Opt(closed(props));
};

const variantAssets = (e: CatalogEntry, value: TSchema) =>
  closed(Object.fromEntries((e.variants ?? []).map((k) => [k, value])));

const project = (e: CatalogEntry): TSchema => {
  const ring = Opt(Type.Boolean());
  switch (e.kind) {
    case 'frame':
      return Type.Union([
        narrow(ProjectPathFrame, {
          size: size(e),
          states: states(e, ProjectPathState, ring),
        }),
        narrow(ProjectAssetFrame, {
          size: size(e),
          states: states(e, ProjectAssetState, ring),
        }),
      ]);
    case 'text':
      return narrow(ProjectText, {
        typography: projectTypography(e.typography),
        leftInset: e.leftInset ? Opt(Finite) : undefined,
        states: states(e, ProjectTextState),
      });
    case 'paint':
      return narrow(ProjectPaintControl, {
        states: states(e, ProjectTextState),
      });
    case 'image':
      return narrow(ProjectImage, {
        asset: e.assetOptional ? Opt(ProjectSvg) : ProjectSvg,
        size: size(e),
        states: states(e, ProjectAssetState, ring),
      });
    case 'variant-image': {
      const assets = Opt(variantAssets(e, Opt(ProjectSvg)));
      const state = narrow(ProjectVariantState, { assets });
      return narrow(ProjectVariantImage, {
        assets,
        placement: e.placement ? Opt(Placement) : undefined,
        size: size(e),
        states: states(e, state),
      });
    }
    case 'window':
      return ProjectWindow;
    case 'focus-ring':
      return ProjectFocusRing;
    case 'composite':
      return closed({});
  }
};

/** A compiled state is the complete base configuration (minus `states`). */
const compiled = (e: CatalogEntry): TSchema => {
  const ring = Type.Boolean();
  const stateful = (base: TObject, showRing?: TSchema) =>
    narrow(base, { states: states(e, base, showRing) });
  switch (e.kind) {
    case 'frame':
      return Type.Union([
        stateful(narrow(CompiledPathBase, { size: size(e) }), ring),
        stateful(narrow(CompiledAssetBase, { size: size(e) }), ring),
      ]);
    case 'text':
      return stateful(
        narrow(CompiledTextBase, {
          typography:
            e.typography === 'editable'
              ? CompiledTypographyEditable
              : CompiledTypographyDisplay,
          leftInset: e.leftInset ? Finite : undefined,
        }),
      );
    case 'paint':
      return stateful(CompiledPaintBase);
    case 'image':
      return stateful(
        narrow(CompiledImageBase, {
          asset: e.assetOptional ? Opt(CompiledSvg) : CompiledSvg,
          size: size(e),
        }),
        ring,
      );
    case 'variant-image':
      return stateful(
        narrow(CompiledVariantBase, {
          assets: variantAssets(e, CompiledSvg),
          placement: e.placement ? Placement : undefined,
          size: size(e),
        }),
      );
    case 'window':
      return CompiledWindow;
    case 'focus-ring':
      return CompiledFocusRing;
    case 'composite':
      return closed({});
  }
};

const control = (
  e: CatalogEntry,
  build: (e: CatalogEntry) => TSchema,
): TSchema => {
  const own = build(e);
  if (!e.parts) return own;
  const parts = closed(
    Object.fromEntries(
      Object.entries(e.parts).map(([k, p]) => {
        const s = control(p, build);
        return [k, p.required ? s : Opt(s)];
      }),
    ),
  );
  const anyRequired = Object.values(e.parts).some((p) => p.required);
  return extend(own, { parts: anyRequired ? parts : Opt(parts) });
};

// ---------------------------------------------------------------- documents

const metadataCore = {
  id: Type.String({ pattern: '^app\\.galapa\\.themes\\.[a-z0-9]{20}$' }),
  name: Type.String({ minLength: 1 }),
  author: closed({
    name: Type.String({ minLength: 1 }),
    url: Opt(HttpsUrl),
  }),
  description: Opt(Type.String()),
  updates: Type.Union([
    Type.Null(),
    closed({
      url: HttpsUrl,
      frequency: Type.Enum(['hourly', 'daily', 'weekly']),
    }),
  ]),
  chromeStyle: Type.Enum(['light', 'dark']),
};

export const ProjectMetadataSchema = closed({
  $schema: Opt(Type.Literal(schemaUrl('metadata'))),
  formatVersion: Type.Literal(THEME_FORMAT_VERSION),
  ...metadataCore,
  previewImage: Opt(projectPath('png|jpe?g|svg')),
});

export const ProjectTokensSchema = closed({
  $schema: Opt(Type.Literal(schemaUrl('tokens'))),
  colors: Opt(tokenRecord(ProjectColor)),
  fonts: Opt(tokenRecord(ProjectFont)),
  typography: Opt(tokenRecord(ProjectTypographyDisplay)),
  assets: Opt(tokenRecord(ProjectSvg)),
});

/** One `controls/<id>.json` schema per catalog root. */
export const ProjectControlSchemas = Object.fromEntries(
  ROOT_CONTROL_IDS.map((id) => [
    id,
    extend(control(CONTROL_CATALOG[id], project), {
      $schema: Opt(Type.Literal(schemaUrl(`controls/${id}`))),
    }),
  ]),
) as Record<RootControlId, TSchema>;

export const CompiledMetadataSchema = closed({
  ...metadataCore,
  previewImage: Opt(compiledPath('assets', 'png|jpg')),
});

export const CompiledThemeSchema = closed(
  Object.fromEntries(
    ROOT_CONTROL_IDS.map((id) => {
      const e = CONTROL_CATALOG[id];
      const s = control(e, compiled);
      return [id, e.required ? s : Opt(s)];
    }),
  ),
);

export const CompiledLicensesSchema = Type.Array(
  closed({
    files: Type.Array(Type.String({ pattern: '^\\./(?:assets|licenses)/' }), {
      minItems: 1,
    }),
    license: Type.String({ minLength: 1 }),
    licenseFile: Opt(compiledPath('licenses', 'txt')),
  }),
);

// ---------------------------------------------------------------- static types
// Kind-level types. ponytail: per-role narrowing (exact parts, states, size
// axes) needs conditional types over the catalog; add when the editor needs it.

export type ProjectFrame =
  Static<typeof ProjectPathFrame> | Static<typeof ProjectAssetFrame>;
export type ProjectControl = (
  | ProjectFrame
  | Static<typeof ProjectText>
  | Static<typeof ProjectPaintControl>
  | Static<typeof ProjectImage>
  | Static<typeof ProjectVariantImage>
  | Static<typeof ProjectWindow>
  | Static<typeof ProjectFocusRing>
  | Record<never, never>
) & { parts?: Record<string, ProjectControl> };
export type ProjectControlFile = ProjectControl & { $schema?: string };
export type ProjectMetadata = Static<typeof ProjectMetadataSchema>;
export type ProjectTokens = Static<typeof ProjectTokensSchema>;

export type CompiledFrame =
  Static<typeof CompiledPathFrame> | Static<typeof CompiledAssetFrame>;
export type CompiledControl = (
  | CompiledFrame
  | Static<typeof CompiledText>
  | Static<typeof CompiledPaintControl>
  | Static<typeof CompiledImage>
  | Static<typeof CompiledVariantImage>
  | Static<typeof CompiledWindow>
  | Static<typeof CompiledFocusRing>
  | Record<never, never>
) & { parts?: Record<string, CompiledControl> };
export type CompiledTheme = Omit<
  Record<RootControlId, CompiledControl>,
  'play-row'
> & { 'play-row'?: CompiledControl };
export type CompiledMetadata = Static<typeof CompiledMetadataSchema>;
export type CompiledLicenses = Static<typeof CompiledLicensesSchema>;
