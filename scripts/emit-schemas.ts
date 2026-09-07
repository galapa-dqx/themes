// Emits the public project JSON Schemas (2020-12) for GitHub Pages.
// Usage: pnpm schema:emit [outDir]
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  ProjectControlSchemas,
  ProjectMetadataSchema,
  ProjectTokensSchema,
  schemaUrl,
} from '@/theme/schema';

const out = process.argv[2] ?? 'dist-schemas';

const files: Record<string, object> = {
  metadata: ProjectMetadataSchema,
  tokens: ProjectTokensSchema,
  ...Object.fromEntries(
    Object.entries(ProjectControlSchemas).map(([id, s]) => [
      `controls/${id}`,
      s,
    ]),
  ),
};

for (const [path, schema] of Object.entries(files)) {
  const file = join(out, 'theme-project', `${path}.schema.json`);
  mkdirSync(dirname(file), { recursive: true });
  const doc = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: schemaUrl(path),
    ...schema,
  };
  writeFileSync(file, JSON.stringify(doc, null, 2) + '\n');
  console.log(file);
}
