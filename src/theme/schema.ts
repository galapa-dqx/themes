import Type, { type TSchema } from 'typebox';
import {
  CONTROL_CATALOG,
  ROOT_CONTROL_IDS,
  type CatalogControl,
  type ControlState,
  type RootControlId,
} from './catalog';

export const THEME_FORMAT_VERSION = 1 as const;
export const PROJECT_MAGIC = 'GLPTHPRJ' as const;
export const THEME_MAGIC = 'GLPTHEME' as const;
export const PROJECT_EXTENSION = '.galapathemeproj' as const;
export const THEME_EXTENSION = '.galapatheme' as const;

export const SCHEMA_BASE = 'https://schemas.galapa.app/theme-project' as const;
export const PROJECT_METADATA_SCHEMA_URL =
  `${SCHEMA_BASE}/metadata.schema.json` as const;
export const PROJECT_TOKENS_SCHEMA_URL =
  `${SCHEMA_BASE}/tokens.schema.json` as const;

export const TOKEN_NAME_PATTERN = '^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$';
export const TOKEN_REFERENCE_PATTERN =
  '^\\{(colors|fonts|typography|assets)\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\}$';
export const THEME_ID_PATTERN = '^app\\.galapa\\.themes\\.[a-z0-9]{20}$';

const closed = <const P extends Record<string, TSchema>>(
  properties: P,
  options: Record<string, unknown> = {},
) => Type.Object(properties, { ...options, additionalProperties: false });

const finiteNumber = (options: Record<string, unknown> = {}) =>
  Type.Number(options);
const nonnegative = () => finiteNumber({ minimum: 0 });
const positive = () => finiteNumber({ exclusiveMinimum: 0 });
const opacity = () => finiteNumber({ minimum: 0, maximum: 1 });
const constrainedRecord = (pattern: string, value: TSchema) =>
  Type.Record(Type.String(), value, {
    propertyNames: { pattern },
    additionalProperties: false,
  });

export const HexColorSchema = Type.String({
  pattern: '^#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$',
});

export const ColorReferenceSchema = Type.String({
  pattern: '^\\{colors\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\}$',
});
export const FontReferenceSchema = Type.String({
  pattern: '^\\{fonts\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\}$',
});
export const TypographyReferenceSchema = Type.String({
  pattern: '^\\{typography\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\}$',
});
export const AssetReferenceSchema = Type.String({
  pattern: '^\\{assets\\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*\\}$',
});

export const ProjectAssetPathSchema = Type.String({
  pattern: '^\\./assets/(?!.*(?:^|/)\\.\\.?/)(?!.*//)(?!.*\\\\)(?!.*%).+$',
});
export const ProjectSvgPathSchema = Type.String({
  pattern:
    '^\\./assets/(?!.*(?:^|/)\\.\\.?/)(?!.*//)(?!.*\\\\)(?!.*%).+\\.svg$',
});
export const ProjectPreviewPathSchema = Type.String({
  pattern:
    '^\\./assets/(?!.*(?:^|/)\\.\\.?/)(?!.*//)(?!.*\\\\)(?!.*%).+\\.(?:png|jpe?g)$',
});
export const ProjectFontPathSchema = Type.String({
  pattern:
    '^\\./assets/(?!.*(?:^|/)\\.\\.?/)(?!.*//)(?!.*\\\\)(?!.*%).+\\.(?:ttf|ttc|otf|otc)$',
});
export const GoogleFontSchema = Type.String({
  pattern: '^gfont:[A-Za-z0-9+%._-]+$',
});

export const CompiledSvgPathSchema = Type.String({
  pattern: '^\\./assets/[0-9a-f]{12}\\.svg$',
});
export const CompiledPreviewPathSchema = Type.String({
  pattern: '^\\./assets/[0-9a-f]{12}\\.(?:png|jpg)$',
});
export const CompiledFontPathSchema = Type.String({
  pattern: '^\\./assets/fonts/[0-9a-f]{12}\\.(?:ttf|otf)$',
});
export const CompiledLicensePathSchema = Type.String({
  pattern: '^\\./licenses/[0-9a-f]{12}\\.txt$',
});

export const ColorMixSchema = closed({
  $type: Type.Literal('mix'),
  inputs: Type.Tuple([
    Type.Union([HexColorSchema, ColorReferenceSchema]),
    Type.Union([HexColorSchema, ColorReferenceSchema]),
  ]),
  amount: finiteNumber({ minimum: 0, maximum: 1 }),
  space: Type.Union(
    ['srgb', 'srgb-linear', 'lab', 'lch', 'oklab', 'oklch'].map((space) =>
      Type.Literal(space),
    ),
  ),
});

export const ColorValueSchema = Type.Union([
  HexColorSchema,
  ColorReferenceSchema,
  ColorMixSchema,
]);
export const PaintValueSchema = Type.Union([
  ColorValueSchema,
  Type.Literal('none'),
]);
export const CompiledColorSchema = HexColorSchema;
export const CompiledPaintSchema = Type.Union([
  CompiledColorSchema,
  Type.Literal('none'),
]);

export const FontSourceSchema = Type.Union([
  GoogleFontSchema,
  ProjectFontPathSchema,
  FontReferenceSchema,
]);
export const AssetSourceSchema = Type.Union([
  ProjectSvgPathSchema,
  AssetReferenceSchema,
]);

export const FontAxesSchema = constrainedRecord('^[ -~]{4}$', finiteNumber());
export const FontFeaturesSchema = constrainedRecord(
  '^[ -~]{4}$',
  Type.Union([Type.Boolean(), Type.Integer({ minimum: 0 })]),
);

const typographyProperties = {
  $extends: Type.Optional(TypographyReferenceSchema),
  font: Type.Optional(FontSourceSchema),
  fontWeight: Type.Optional(Type.Integer({ minimum: 1, maximum: 1000 })),
  fontStyle: Type.Optional(
    Type.Union(['normal', 'italic', 'oblique'].map((v) => Type.Literal(v))),
  ),
  fontAxes: Type.Optional(FontAxesSchema),
  fontSize: Type.Optional(positive()),
  lineHeight: Type.Optional(positive()),
  letterSpacing: Type.Optional(finiteNumber()),
  textCase: Type.Optional(
    Type.Union(['none', 'uppercase', 'lowercase'].map((v) => Type.Literal(v))),
  ),
  textDecoration: Type.Optional(
    Type.Array(
      Type.Union(
        ['underline', 'strikethrough', 'overline', 'baseline'].map((v) =>
          Type.Literal(v),
        ),
      ),
      { uniqueItems: true },
    ),
  ),
  fontFeatures: Type.Optional(FontFeaturesSchema),
} as const;

export const TypographyObjectSchema = closed(typographyProperties);
export const TypographyValueSchema = Type.Union([
  TypographyReferenceSchema,
  TypographyObjectSchema,
]);

export const CompiledTypographySchema = closed({
  font: CompiledFontPathSchema,
  fontWeight: Type.Integer({ minimum: 1, maximum: 1000 }),
  fontStyle: Type.Union(
    ['normal', 'italic', 'oblique'].map((v) => Type.Literal(v)),
  ),
  fontSize: positive(),
  lineHeight: positive(),
  letterSpacing: finiteNumber(),
  textCase: Type.Union(
    ['none', 'uppercase', 'lowercase'].map((v) => Type.Literal(v)),
  ),
  textDecoration: Type.Array(
    Type.Union(
      ['underline', 'strikethrough', 'overline', 'baseline'].map((v) =>
        Type.Literal(v),
      ),
    ),
    { uniqueItems: true },
  ),
  fontFeatures: FontFeaturesSchema,
});

export const CompiledEditableTypographySchema = closed({
  font: CompiledFontPathSchema,
  fontWeight: Type.Integer({ minimum: 1, maximum: 1000 }),
  fontStyle: Type.Union(
    ['normal', 'italic', 'oblique'].map((v) => Type.Literal(v)),
  ),
  fontSize: positive(),
  lineHeight: positive(),
  letterSpacing: finiteNumber(),
  fontFeatures: FontFeaturesSchema,
});

export const ProjectMetadataSchema = closed(
  {
    $schema: Type.Optional(Type.Literal(PROJECT_METADATA_SCHEMA_URL)),
    formatVersion: Type.Literal(THEME_FORMAT_VERSION),
    id: Type.String({ pattern: THEME_ID_PATTERN }),
    name: Type.String({ minLength: 1 }),
    author: closed({
      name: Type.String({ minLength: 1 }),
      url: Type.Optional(Type.String({ pattern: '^https://' })),
    }),
    description: Type.Optional(Type.String()),
    updates: Type.Union([
      Type.Null(),
      closed({
        url: Type.String({ pattern: '^https://' }),
        frequency: Type.Union(
          ['hourly', 'daily', 'weekly'].map((v) => Type.Literal(v)),
        ),
      }),
    ]),
    previewImage: Type.Optional(ProjectPreviewPathSchema),
    chromeStyle: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
  },
  { $id: PROJECT_METADATA_SCHEMA_URL },
);

export const ProjectTokensSchema = closed(
  {
    $schema: Type.Optional(Type.Literal(PROJECT_TOKENS_SCHEMA_URL)),
    colors: Type.Optional(constrainedRecord(TOKEN_NAME_PATTERN, ColorValueSchema)),
    fonts: Type.Optional(
      constrainedRecord(
        TOKEN_NAME_PATTERN,
        Type.Union([GoogleFontSchema, ProjectFontPathSchema, FontReferenceSchema]),
      ),
    ),
    typography: Type.Optional(
      constrainedRecord(TOKEN_NAME_PATTERN, TypographyValueSchema),
    ),
    assets: Type.Optional(constrainedRecord(TOKEN_NAME_PATTERN, AssetSourceSchema)),
  },
  { $id: PROJECT_TOKENS_SCHEMA_URL },
);

export const CompiledMetadataSchema = closed({
  id: Type.String({ pattern: THEME_ID_PATTERN }),
  name: Type.String({ minLength: 1 }),
  author: closed({
    name: Type.String({ minLength: 1 }),
    url: Type.Optional(Type.String({ pattern: '^https://' })),
  }),
  description: Type.Optional(Type.String()),
  updates: Type.Union([
    Type.Null(),
    closed({
      url: Type.String({ pattern: '^https://' }),
      frequency: Type.Union(
        ['hourly', 'daily', 'weekly'].map((v) => Type.Literal(v)),
      ),
    }),
  ]),
  previewImage: Type.Optional(CompiledPreviewPathSchema),
  chromeStyle: Type.Union([Type.Literal('light'), Type.Literal('dark')]),
});

export const LicenseEntrySchema = closed({
  files: Type.Array(
    Type.String({
      pattern:
        '^\\./(?:assets(?:/fonts)?/[0-9a-f]{12}\\.(?:svg|png|jpg|ttf|otf)|licenses/[0-9a-f]{12}\\.txt)$',
    }),
    { minItems: 1, uniqueItems: true },
  ),
  license: Type.String({ minLength: 1 }),
  licenseFile: Type.Optional(CompiledLicensePathSchema),
});
export const LicensesSchema = Type.Array(LicenseEntrySchema);

export type HexColor = string;
export type ColorMix = {
  $type: 'mix';
  inputs: [string, string];
  amount: number;
  space: 'srgb' | 'srgb-linear' | 'lab' | 'lch' | 'oklab' | 'oklch';
};
export type ColorValue = HexColor | string | ColorMix;
export type PaintValue = ColorValue | 'none';
export type TypographyObject = {
  $extends?: string;
  font?: string;
  fontWeight?: number;
  fontStyle?: 'normal' | 'italic' | 'oblique';
  fontAxes?: Record<string, number>;
  fontSize?: number;
  lineHeight?: number;
  letterSpacing?: number;
  textCase?: 'none' | 'uppercase' | 'lowercase';
  textDecoration?: ('underline' | 'strikethrough' | 'overline' | 'baseline')[];
  fontFeatures?: Record<string, boolean | number>;
};
export type TypographyValue = string | TypographyObject;
export type CompiledTypography = Required<Omit<TypographyObject, '$extends'>>;
export type ProjectMetadata = {
  $schema?: typeof PROJECT_METADATA_SCHEMA_URL;
  formatVersion: typeof THEME_FORMAT_VERSION;
  id: string;
  name: string;
  author: { name: string; url?: string };
  description?: string;
  updates: null | {
    url: string;
    frequency: 'hourly' | 'daily' | 'weekly';
  };
  previewImage?: string;
  chromeStyle: 'light' | 'dark';
};
export type ProjectTokens = {
  $schema?: typeof PROJECT_TOKENS_SCHEMA_URL;
  colors?: Record<string, ColorValue>;
  fonts?: Record<string, string>;
  typography?: Record<string, TypographyValue>;
  assets?: Record<string, string>;
};
export type CompiledMetadata = Omit<ProjectMetadata, '$schema' | 'formatVersion'>;
export type LicenseEntry = {
  files: string[];
  license: string;
  licenseFile?: string;
};

const edgesSchema = Type.Union([
  nonnegative(),
  Type.Tuple([nonnegative(), nonnegative(), nonnegative(), nonnegative()]),
]);
const compiledEdgesSchema = Type.Tuple([
  nonnegative(),
  nonnegative(),
  nonnegative(),
  nonnegative(),
]);
const cornerSchema = Type.Union(
  ['round', 'bevel', 'scoop', 'notch', 'squircle'].map((v) => Type.Literal(v)),
);
const radiusSchema = Type.Union([nonnegative(), Type.Literal('pill')]);

function sizeSchema(entry: CatalogControl): TSchema | undefined {
  if (!entry.size) return undefined;
  return closed(
    Object.fromEntries(entry.size.axes.map((axis) => [axis, Type.Optional(positive())])),
  );
}

function variantAssetsSchema(
  entry: CatalogControl,
  compiled: boolean,
  partial: boolean,
): TSchema {
  const keys = entry.variants?.keys ?? [];
  return closed(
    Object.fromEntries(
      keys.map((key) => [
        key,
        compiled || !entry.variants?.projectAssetsOptional || !partial
          ? compiled
            ? CompiledSvgPathSchema
            : AssetSourceSchema
          : Type.Optional(AssetSourceSchema),
      ]),
    ),
  );
}

function stateProperties(
  entry: CatalogControl,
  compiled: boolean,
): Record<string, TSchema> {
  const color = compiled ? CompiledColorSchema : ColorValueSchema;
  const paintValue = compiled ? CompiledPaintSchema : PaintValueSchema;
  const asset = compiled ? CompiledSvgPathSchema : AssetSourceSchema;
  switch (entry.kind) {
    case 'frame':
      return {
        radius: radiusSchema,
        corner: cornerSchema,
        fill: paintValue,
        border: compiled
          ? closed({ color: paintValue, thickness: compiledEdgesSchema })
          : closed({
              color: Type.Optional(paintValue),
              thickness: Type.Optional(edgesSchema),
            }),
        opacity: opacity(),
      };
    case 'image':
      return { asset, currentColor: color, opacity: opacity() };
    case 'variant-image':
      return {
        assets: variantAssetsSchema(entry, compiled, !compiled),
        currentColor: color,
        opacity: opacity(),
      };
    case 'text':
    case 'paint':
      return { color, opacity: opacity() };
    default:
      return {};
  }
}

function stateSchema(
  entry: CatalogControl,
  state: ControlState,
  compiled: boolean,
  frameShape?: 'path' | 'asset',
): TSchema {
  let properties = stateProperties(entry, compiled);
  if (entry.kind === 'frame' && frameShape === 'asset') {
    const color = compiled ? CompiledColorSchema : ColorValueSchema;
    const asset = compiled ? CompiledSvgPathSchema : AssetSourceSchema;
    properties = { asset, currentColor: color, opacity: opacity() };
  }
  const optional = compiled
    ? properties
    : Object.fromEntries(
        Object.entries(properties).map(([key, schema]) => [key, Type.Optional(schema)]),
      );
  // currentColor is semantically required only when the selected SVG uses
  // it. The compiler performs that content-aware check; JSON Schema cannot.
  if (compiled && optional.currentColor) {
    optional.currentColor = Type.Optional(optional.currentColor);
  }
  if (state === 'focused' && entry.focusRingOwner) {
    optional.showRing = compiled ? Type.Boolean() : Type.Optional(Type.Boolean());
  }
  return closed(optional);
}

function statesSchema(
  entry: CatalogControl,
  compiled: boolean,
  frameShape?: 'path' | 'asset',
): TSchema | undefined {
  if (!entry.states?.length) return undefined;
  return closed(
    Object.fromEntries(
      entry.states.map((state) => [
        state,
        Type.Optional(stateSchema(entry, state, compiled, frameShape)),
      ]),
    ),
  );
}

function optionalProjectProperties(
  properties: Record<string, TSchema>,
): Record<string, TSchema> {
  return Object.fromEntries(
    Object.entries(properties).map(([key, schema]) => [key, Type.Optional(schema)]),
  );
}

function controlSchema(entry: CatalogControl, compiled: boolean): TSchema {
  const size = sizeSchema(entry);
  const states = statesSchema(entry, compiled);
  const color = compiled ? CompiledColorSchema : ColorValueSchema;
  const asset = compiled ? CompiledSvgPathSchema : AssetSourceSchema;

  switch (entry.kind) {
    case 'composite':
      return closed({});
    case 'window':
      return compiled
        ? closed({ fill: CompiledColorSchema, borderColor: CompiledPaintSchema })
        : closed({ fill: ColorValueSchema, borderColor: Type.Optional(PaintValueSchema) });
    case 'focus-ring':
      return compiled
        ? closed({ color: CompiledColorSchema, width: nonnegative(), offset: finiteNumber() })
        : closed({
            color: ColorValueSchema,
            width: Type.Optional(nonnegative()),
            offset: Type.Optional(finiteNumber()),
          });
    case 'text': {
      const typography = compiled
        ? entry.typography === 'editable'
          ? CompiledEditableTypographySchema
          : CompiledTypographySchema
        : TypographyValueSchema;
      const properties: Record<string, TSchema> = {
        color,
        typography,
        opacity: compiled ? opacity() : Type.Optional(opacity()),
      };
      if (entry.leftInset) {
        properties.leftInset = compiled ? finiteNumber() : Type.Optional(finiteNumber());
      }
      if (states) properties.states = Type.Optional(states);
      return closed(properties);
    }
    case 'paint': {
      const properties: Record<string, TSchema> = {
        color,
        opacity: compiled ? opacity() : Type.Optional(opacity()),
      };
      if (states) properties.states = Type.Optional(states);
      return closed(properties);
    }
    case 'image': {
      const properties: Record<string, TSchema> = {
        asset:
          entry.assetRequired || compiled
            ? asset
            : Type.Optional(asset),
        currentColor: Type.Optional(color),
        opacity: compiled ? opacity() : Type.Optional(opacity()),
      };
      if (size) properties.size = Type.Optional(size);
      if (states) properties.states = Type.Optional(states);
      return closed(properties);
    }
    case 'variant-image': {
      const properties: Record<string, TSchema> = {
        assets: compiled
          ? variantAssetsSchema(entry, true, false)
          : Type.Optional(variantAssetsSchema(entry, false, true)),
        currentColor: color,
        opacity: compiled ? opacity() : Type.Optional(opacity()),
      };
      if (size) properties.size = Type.Optional(size);
      if (states) properties.states = Type.Optional(states);
      return closed(properties);
    }
    case 'frame': {
      const pathStates = statesSchema(entry, compiled, 'path');
      const pathProperties: Record<string, TSchema> = compiled
        ? {
            shape: Type.Literal('path'),
            radius: radiusSchema,
            corner: cornerSchema,
            fill: CompiledPaintSchema,
            border: closed({
              color: CompiledPaintSchema,
              thickness: compiledEdgesSchema,
            }),
            padding: compiledEdgesSchema,
            opacity: opacity(),
          }
        : {
            shape: Type.Literal('path'),
            ...optionalProjectProperties({
              radius: radiusSchema,
              corner: cornerSchema,
              fill: PaintValueSchema,
              border: closed({
                color: Type.Optional(PaintValueSchema),
                thickness: Type.Optional(edgesSchema),
              }),
              padding: edgesSchema,
              opacity: opacity(),
            }),
          };
      if (size) pathProperties.size = Type.Optional(size);
      if (pathStates) pathProperties.states = Type.Optional(pathStates);

      const assetStates = statesSchema(entry, compiled, 'asset');
      const assetProperties: Record<string, TSchema> = {
        shape: Type.Literal('asset'),
        asset,
        currentColor: Type.Optional(color),
        opacity: compiled ? opacity() : Type.Optional(opacity()),
      };
      if (size) assetProperties.size = Type.Optional(size);
      if (assetStates) assetProperties.states = Type.Optional(assetStates);
      return Type.Union([closed(pathProperties), closed(assetProperties)]);
    }
  }
}

function controlDocumentSchema(
  root: RootControlId,
  compiled: boolean,
): TSchema {
  const entry: CatalogControl = CONTROL_CATALOG[root];
  const rootSchema = controlSchema(entry, compiled);
  const rootRecord = rootSchema as unknown as Record<string, unknown>;
  const rootProperties =
    rootRecord.type === 'object'
      ? { ...(rootRecord.properties as Record<string, TSchema>) }
      : undefined;

  const parts = entry.parts
    ? closed(
        Object.fromEntries(
          Object.entries(entry.parts).map(([name, part]) => [
            name,
            part.required
              ? controlSchema(part, compiled)
              : Type.Optional(controlSchema(part, compiled)),
          ]),
        ),
      )
    : undefined;

  const schemaUrl = `${SCHEMA_BASE}/controls/${root}.schema.json`;
  if (rootProperties) {
    if (!compiled) rootProperties.$schema = Type.Optional(Type.Literal(schemaUrl));
    if (parts) rootProperties.parts = parts;
    return closed(rootProperties, !compiled ? { $id: schemaUrl } : {});
  }

  // FrameControl is a discriminated union, so add document fields to both
  // branches rather than weakening it with an intersection.
  const branches = (rootRecord.anyOf ?? rootRecord.oneOf) as TSchema[];
  return Type.Union(
    branches.map((branch) => {
      const properties = {
        ...((branch as unknown as Record<string, unknown>)
          .properties as Record<string, TSchema>),
      };
      if (!compiled) properties.$schema = Type.Optional(Type.Literal(schemaUrl));
      if (parts) properties.parts = parts;
      return closed(properties);
    }),
    !compiled ? { $id: schemaUrl } : {},
  );
}

export const PROJECT_CONTROL_SCHEMAS = Object.freeze(
  Object.fromEntries(
    ROOT_CONTROL_IDS.map((root) => [root, controlDocumentSchema(root, false)]),
  ) as Record<RootControlId, TSchema>,
);

export const COMPILED_CONTROL_SCHEMAS = Object.freeze(
  Object.fromEntries(
    ROOT_CONTROL_IDS.map((root) => [root, controlDocumentSchema(root, true)]),
  ) as Record<RootControlId, TSchema>,
);

export const CompiledThemeSchema = closed(
  Object.fromEntries(
    ROOT_CONTROL_IDS.map((root) => {
      const entry: CatalogControl = CONTROL_CATALOG[root];
      const schema = COMPILED_CONTROL_SCHEMAS[root];
      return [root, entry.required ? schema : Type.Optional(schema)];
    }),
  ),
  { $id: 'https://schemas.galapa.app/theme/theme.schema.json' },
);

export type ProjectControl = Record<string, unknown>;
export type CompiledThemeControls = Record<RootControlId, unknown>;

export type ProjectModel = {
  metadata: ProjectMetadata;
  tokens: ProjectTokens;
  controls: Partial<Record<RootControlId, unknown>>;
};

export type CompiledThemeModel = {
  metadata: CompiledMetadata;
  theme: CompiledThemeControls;
  licenses: LicenseEntry[];
};
