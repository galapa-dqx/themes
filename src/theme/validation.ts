import Schema from 'typebox/schema';
import type { TSchema } from 'typebox';
import {
  COMPILED_CONTROL_SCHEMAS,
  CompiledMetadataSchema,
  CompiledThemeSchema,
  LicensesSchema,
  PROJECT_CONTROL_SCHEMAS,
  ProjectMetadataSchema,
  ProjectTokensSchema,
} from './schema';
import type { RootControlId } from './catalog';
import type { ThemeDiagnostic } from './diagnostics';

type Validator = ReturnType<typeof Schema.Compile>;

const projectMetadataValidator = Schema.Compile(ProjectMetadataSchema);
const projectTokensValidator = Schema.Compile(ProjectTokensSchema);
const compiledMetadataValidator = Schema.Compile(CompiledMetadataSchema);
const compiledThemeValidator = Schema.Compile(CompiledThemeSchema);
const licensesValidator = Schema.Compile(LicensesSchema);

const compileMap = (schemas: Record<RootControlId, TSchema>) =>
  Object.fromEntries(
    Object.entries(schemas).map(([id, schema]) => [id, Schema.Compile(schema)]),
  ) as Record<RootControlId, Validator>;

const projectControlValidators = compileMap(PROJECT_CONTROL_SCHEMAS);
const compiledControlValidators = compileMap(COMPILED_CONTROL_SCHEMAS);

function diagnostics(validator: Validator, value: unknown): ThemeDiagnostic[] {
  const [, errors] = validator.Errors(value);
  return errors.map((error) => ({
    severity: 'error',
    code: 'schema',
    message: error.message,
    ...(error.instancePath ? { path: error.instancePath } : {}),
  }));
}

export const validateProjectMetadata = (value: unknown) =>
  diagnostics(projectMetadataValidator, value);
export const validateProjectTokens = (value: unknown) =>
  diagnostics(projectTokensValidator, value);
export const validateCompiledMetadata = (value: unknown) =>
  diagnostics(compiledMetadataValidator, value);
export const validateCompiledTheme = (value: unknown) =>
  diagnostics(compiledThemeValidator, value);
export const validateLicenses = (value: unknown) =>
  diagnostics(licensesValidator, value);

export function validateProjectControl(
  id: RootControlId,
  value: unknown,
): ThemeDiagnostic[] {
  return diagnostics(projectControlValidators[id], value);
}

export function validateCompiledControl(
  id: RootControlId,
  value: unknown,
): ThemeDiagnostic[] {
  return diagnostics(compiledControlValidators[id], value);
}

