import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  COMPILED_CONTROL_SCHEMAS,
  CompiledMetadataSchema,
  CompiledThemeSchema,
  LicensesSchema,
  PROJECT_CONTROL_SCHEMAS,
  ProjectMetadataSchema,
  ProjectTokensSchema,
} from '../src/theme/schema';
import { CONTROL_CATALOG, STATE_PRIORITY } from '../src/theme/catalog';

// Regenerates the public JSON Schemas and compact runtime control catalog.

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, child]) => [key, sortValue(child)]),
    );
  }
  return value;
}

function json(value: unknown): string {
  return `${JSON.stringify(sortValue(value), null, 2)}\n`;
}

function toDraft202012(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(toDraft202012);
  if (!value || typeof value !== 'object') return value;

  const record = Object.fromEntries(
    Object.entries(value).map(([key, child]) => [key, toDraft202012(child)]),
  );

  // TypeBox uses the draft-07 tuple spelling internally. Keep that runtime
  // representation intact, but publish the equivalent JSON Schema 2020-12.
  if (Array.isArray(record.items) && record.additionalItems === false) {
    const prefixItems = record.items;
    delete record.additionalItems;
    record.prefixItems = prefixItems;
    record.items = false;
    record.maxItems ??= prefixItems.length;
  }

  return record;
}

function schema(value: unknown): Record<string, unknown> {
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    ...(toDraft202012(value) as Record<string, unknown>),
  };
}

const outputs = new Map<string, string>([
  ['schemas/theme-project/metadata.schema.json', json(schema(ProjectMetadataSchema))],
  ['schemas/theme-project/tokens.schema.json', json(schema(ProjectTokensSchema))],
  ['schemas/theme/metadata.schema.json', json(schema(CompiledMetadataSchema))],
  ['schemas/theme/theme.schema.json', json(schema(CompiledThemeSchema))],
  ['schemas/theme/licenses.schema.json', json(schema(LicensesSchema))],
  [
    'generated/control-catalog.json',
    json({ version: 1, statePriority: STATE_PRIORITY, controls: CONTROL_CATALOG }),
  ],
]);

for (const [id, value] of Object.entries(PROJECT_CONTROL_SCHEMAS)) {
  outputs.set(`schemas/theme-project/controls/${id}.schema.json`, json(schema(value)));
}
for (const [id, value] of Object.entries(COMPILED_CONTROL_SCHEMAS)) {
  outputs.set(`schemas/theme/controls/${id}.schema.json`, json(schema(value)));
}

let stale = false;
for (const [relativePath, content] of outputs) {
  const path = resolve(root, relativePath);
  if (check) {
    const current = await readFile(path, 'utf8').catch(() => '');
    if (current !== content) {
      stale = true;
      console.error(`stale generated artifact: ${relativePath}`);
    }
    continue;
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content);
}

if (stale) process.exitCode = 1;
