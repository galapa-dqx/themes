import Type from 'typebox';
import type { RootControlId } from '../catalog';
import {
  AssetSourceSchema,
  ColorValueSchema,
  FontReferenceSchema,
  GoogleFontSchema,
  PROJECT_METADATA_SCHEMA_URL,
  PROJECT_TOKENS_SCHEMA_URL,
  ProjectFontPathSchema,
  ProjectPreviewPathSchema,
  THEME_FORMAT_VERSION,
  TOKEN_NAME_PATTERN,
  TypographyValueSchema,
  closed,
  constrainedRecord,
  createControlSchemas,
  metadataProperties,
  type ColorValue,
  type ThemeMetadata,
  type TypographyValue,
} from './shared';

export const ProjectMetadataSchema = closed(
  {
    $schema: Type.Optional(Type.Literal(PROJECT_METADATA_SCHEMA_URL)),
    formatVersion: Type.Literal(THEME_FORMAT_VERSION),
    ...metadataProperties(ProjectPreviewPathSchema),
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

export const PROJECT_CONTROL_SCHEMAS = createControlSchemas(false);

export type ProjectMetadata = ThemeMetadata & {
  $schema?: typeof PROJECT_METADATA_SCHEMA_URL;
  formatVersion: typeof THEME_FORMAT_VERSION;
};

export type ProjectTokens = {
  $schema?: typeof PROJECT_TOKENS_SCHEMA_URL;
  colors?: Record<string, ColorValue>;
  fonts?: Record<string, string>;
  typography?: Record<string, TypographyValue>;
  assets?: Record<string, string>;
};

export type ProjectControl = Record<string, unknown>;

export type ProjectModel = {
  metadata: ProjectMetadata;
  tokens: ProjectTokens;
  controls: Partial<Record<RootControlId, unknown>>;
};
