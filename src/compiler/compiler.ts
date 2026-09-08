/**
 * The compiler pipeline: load, resolve tokens, resolve controls, lower, then
 * emit the package into a fresh temporary directory whose path is returned.
 * Zipping and prefixing are a separate step.
 */
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';
import type { TSchema } from 'typebox';
import Value from 'typebox/value';
import {
  CompiledLicensesSchema,
  CompiledMetadataSchema,
  CompiledThemeSchema,
  type CompiledMetadata,
} from '@/theme/schema';
import { resolveControls } from './controls';
import { Diagnostics } from './diagnostics';
import { lowerTheme } from './lower';
import { Package } from './package';
import { loadProject, type Project } from './project';
import { resolveTokens } from './tokens';

const PREVIEW_LIMIT = 8 * 1024 * 1024;
const PNG = [0x89, 0x50, 0x4e, 0x47];
const JPEG = [0xff, 0xd8, 0xff];

/** Compiled metadata: the project's minus authoring fields, with the preview packaged. */
const compileMetadata = (project: Project, pkg: Package) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* Diagnostics;
    const { formatVersion, previewImage, ...rest } = project.metadata;
    const out: CompiledMetadata = rest;
    if (!previewImage) return out;
    const at = { file: 'metadata.json', path: '/previewImage' };
    // ponytail: bytes are copied as-is. Stripping EXIF/XMP needs an image
    // codec; add a canvas re-encode in the browser layer when the UI lands.
    const bytes = yield* fs
      .readFile(`${project.dir}/${previewImage.slice(2)}`)
      .pipe(Effect.orElseSucceed(() => undefined));
    const magic = (m: number[]) => bytes && m.every((b, i) => bytes[i] === b);
    const ext = magic(PNG) ? 'png' : magic(JPEG) ? 'jpg' : undefined;
    if (!bytes) yield* d.error('preview', `${previewImage} does not exist`, at);
    else if (!ext) yield* d.error('preview', 'not a PNG or JPEG', at);
    else if (bytes.length > PREVIEW_LIMIT) {
      yield* d.error('preview', 'preview exceeds 8 MiB', at);
    } else out.previewImage = yield* pkg.add('assets', ext, bytes);
    return out;
  });

/** Self-check: lowering bugs surface here instead of in the desktop loader. */
const conforms = (file: string, schema: TSchema, value: unknown) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;
    for (const e of Value.Errors(schema, value)) {
      yield* d.error('internal', `compiled output is invalid: ${e.message}`, {
        file,
        path: e.instancePath,
      });
    }
  });

export interface Compiled {
  /** Directory holding metadata.json, theme.json, licenses.json, assets/, licenses/. */
  readonly dir: string;
  readonly diagnostics: readonly import('./diagnostics').Diagnostic[];
}

export const compileProject = (projectDir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* Diagnostics;

    const project = yield* loadProject(projectDir);
    const tokens = yield* resolveTokens(project.tokens);
    const resolved = yield* resolveControls(project, tokens);
    const { theme, pkg } = yield* lowerTheme(project.dir, tokens, resolved);
    const metadata = yield* compileMetadata(project, pkg);
    const licenses = pkg.manifest();

    yield* conforms('theme.json', CompiledThemeSchema, theme);
    yield* conforms('metadata.json', CompiledMetadataSchema, metadata);
    yield* conforms('licenses.json', CompiledLicensesSchema, licenses);
    yield* d.checkpoint;

    const dir = yield* fs.makeTempDirectory({ prefix: 'galapatheme-' });
    const json = (name: string, value: unknown) =>
      fs.writeFileString(
        `${dir}/${name}`,
        JSON.stringify(value, null, 2) + '\n',
      );
    yield* json('metadata.json', metadata);
    yield* json('theme.json', theme);
    yield* json('licenses.json', licenses);
    for (const [path, bytes] of pkg.files) {
      yield* fs.makeDirectory(`${dir}/${path}`.replace(/\/[^/]+$/, ''), {
        recursive: true,
      });
      yield* fs.writeFile(`${dir}/${path}`, bytes);
    }
    return { dir, diagnostics: yield* d.all } satisfies Compiled;
  });
