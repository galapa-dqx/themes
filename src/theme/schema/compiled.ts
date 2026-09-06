import Type from 'typebox';
import {
  CONTROL_CATALOG,
  ROOT_CONTROL_IDS,
  type CatalogControl,
  type RootControlId,
} from '../catalog';
import {
  CompiledLicensePathSchema,
  CompiledPreviewPathSchema,
  closed,
  createControlSchemas,
  metadataProperties,
  type ThemeMetadata,
} from './shared';

export const CompiledMetadataSchema = closed(
  metadataProperties(CompiledPreviewPathSchema),
);

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

export const COMPILED_CONTROL_SCHEMAS = createControlSchemas(true);

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

export type CompiledMetadata = ThemeMetadata;

export type LicenseEntry = {
  files: string[];
  license: string;
  licenseFile?: string;
};

export type CompiledThemeControls = Record<RootControlId, unknown>;

export type CompiledThemeModel = {
  metadata: CompiledMetadata;
  theme: CompiledThemeControls;
  licenses: LicenseEntry[];
};
