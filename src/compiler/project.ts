/**
 * Loads a project folder into validated, typed documents. Every problem is a
 * diagnostic; the loader checkpoints once at the end so an author sees all
 * parse and schema errors from one run.
 */
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { TSchema } from 'typebox';
import Value from 'typebox/value';
import {
  CONTROL_CATALOG,
  ROOT_CONTROL_IDS,
  type RootControlId,
} from '../theme/catalog.ts';
import {
  ProjectControlSchemas,
  ProjectMetadataSchema,
  ProjectTokensSchema,
  type ProjectControl,
  type ProjectMetadata,
  type ProjectTokens,
} from '../theme/schema.ts';
import { Diagnostics } from './diagnostics.ts';

export interface Project {
  readonly dir: string;
  readonly metadata: ProjectMetadata;
  readonly tokens: ProjectTokens;
  readonly controls: Partial<Record<RootControlId, ProjectControl>>;
}

const utf8 = new TextDecoder('utf-8', { fatal: true });

/**
 * `JSON.parse` accepts duplicate object keys; the format rejects them.
 * Assumes syntactically valid JSON. Returns the pointer of the first duplicate.
 */
export const findDuplicateKey = (text: string): string | undefined => {
  type Frame = { keys?: Set<string>; expectKey?: boolean; at: string | number };
  const stack: Frame[] = [];
  const top = () => stack[stack.length - 1];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      let j = i + 1;
      while (text[j] !== '"') j += text[j] === '\\' ? 2 : 1;
      const f = top();
      if (f?.keys && f.expectKey) {
        const key = JSON.parse(text.slice(i, j + 1)) as string;
        if (f.keys.has(key)) {
          return (
            '/' +
            stack
              .slice(0, -1)
              .map((s) => s.at)
              .concat(key)
              .join('/')
          );
        }
        f.keys.add(key);
        f.at = key;
        f.expectKey = false;
      }
      i = j;
    } else if (c === '{')
      stack.push({ keys: new Set(), expectKey: true, at: '' });
    else if (c === '[') stack.push({ at: 0 });
    else if (c === '}' || c === ']') stack.pop();
    else if (c === ',') {
      const f = top();
      if (f?.keys) f.expectKey = true;
      else if (f) f.at = (f.at as number) + 1;
    }
  }
  return undefined;
};

/**
 * Schema errors as `path -> message`, deduplicated across union branches.
 * ponytail: frame unions still report the other branch's `shape` mismatch;
 * add discriminator-aware narrowing if that confuses authors.
 */
const schemaErrors = (schema: TSchema, value: unknown) => {
  const out = new Map<string, string>();
  for (const e of Value.Errors(schema, value)) {
    if (e.keyword === 'anyOf' || e.keyword === 'additionalProperties') continue;
    const message = e.schemaPath.endsWith('/additionalProperties')
      ? 'unknown property'
      : e.message;
    out.set(e.instancePath, message);
  }
  return out;
};

export const loadProject = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* Diagnostics;

    /** Reads, strictly parses, and validates one JSON document. */
    const readJson = <T>(file: string, schema: TSchema) =>
      Effect.gen(function* () {
        const bytes = yield* fs
          .readFile(`${dir}/${file}`)
          .pipe(
            Effect.catchAll((e) =>
              d
                .error('file', `cannot read: ${e.message}`, { file })
                .pipe(Effect.as(undefined)),
            ),
          );
        if (!bytes) return undefined;
        let text: string;
        let value: unknown;
        try {
          text = utf8.decode(bytes);
          value = JSON.parse(text);
        } catch (e) {
          yield* d.error('json', (e as Error).message, { file });
          return undefined;
        }
        const dup = findDuplicateKey(text);
        if (dup) {
          yield* d.error('json', 'duplicate object key', { file, path: dup });
          return undefined;
        }
        const errors = schemaErrors(schema, value);
        for (const [path, message] of errors)
          yield* d.error('schema', message, { file, path });
        if (errors.size) return undefined;
        const { $schema, ...rest } = value as { $schema?: string };
        if (!$schema)
          yield* d.info(
            'schema-hint',
            'missing $schema; the editor restores it on save',
            { file },
          );
        return rest as T;
      });

    const metadata = yield* readJson<ProjectMetadata>(
      'metadata.json',
      ProjectMetadataSchema,
    );
    const tokens = yield* readJson<ProjectTokens>(
      'tokens.json',
      ProjectTokensSchema,
    );

    const entries = yield* fs
      .readDirectory(`${dir}/controls`)
      .pipe(Effect.orElseSucceed((): string[] => []));
    const controls: Partial<Record<RootControlId, ProjectControl>> = {};
    for (const name of entries.toSorted()) {
      const file = `controls/${name}`;
      const id = name.replace(/\.json$/, '') as RootControlId;
      if (id === name || !(id in CONTROL_CATALOG)) {
        yield* d.error('control', 'not a catalog control', { file });
        continue;
      }
      const control = yield* readJson<ProjectControl>(
        file,
        ProjectControlSchemas[id],
      );
      if (control) controls[id] = control;
    }
    for (const id of ROOT_CONTROL_IDS) {
      if (CONTROL_CATALOG[id].required && !entries.includes(`${id}.json`)) {
        yield* d.error('control', 'required control is missing', {
          file: `controls/${id}.json`,
        });
      }
    }

    yield* d.checkpoint;
    return {
      dir,
      metadata: metadata!,
      tokens: tokens!,
      controls,
    } satisfies Project;
  });
