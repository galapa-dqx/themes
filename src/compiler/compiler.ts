/**
 * The compiler pipeline: load, resolve tokens, resolve controls, lower, then
 * emit the package into a directory whose path is returned. Zipping and
 * prefixing are a separate step.
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
import { Diagnostics, type Diagnostic } from './diagnostics';
import { Images } from './images';
import { lowerTheme } from './lower';
import { Package } from './package';
import { loadProject, type Project } from './project';
import { resolveTokens } from './tokens';

const PREVIEW = { bytes: 8 * 1024 * 1024, side: 4096, area: 16_000_000 };

/** Compiled metadata: the project's minus authoring fields, with the preview packaged. */
const compileMetadata = (project: Project, pkg: Package) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const d = yield* Diagnostics;
    const { formatVersion, previewImage, ...rest } = project.metadata;
    const out: CompiledMetadata = rest;
    if (!previewImage) return out;
    const at = { file: 'metadata.json', path: '/previewImage' };
    const fail = (message: string) => d.error('preview', message, at);
    const source = yield* fs
      .readFile(`${project.dir}/${previewImage.slice(2)}`)
      .pipe(Effect.orElseSucceed(() => undefined));
    if (!source) return (yield* fail(`${previewImage} does not exist`), out);
    const images = yield* Images;
    // An SVG preview is a project-only convenience; the package stays raster.
    const image = yield* (
      previewImage.endsWith('.svg')
        ? images.rasterize(new TextDecoder().decode(source))
        : images.strip(source)
    ).pipe(Effect.either);
    if (image._tag === 'Left') return (yield* fail(image.left.message), out);
    const { bytes, format, width, height } = image.right;
    if (width > PREVIEW.side || height > PREVIEW.side) {
      yield* fail(
        `preview is ${width}x${height}; the limit is ${PREVIEW.side} per side`,
      );
    } else if (width * height > PREVIEW.area) {
      yield* fail(`preview is ${width}x${height}; the limit is 16 megapixels`);
    } else if (bytes.length > PREVIEW.bytes) {
      yield* fail('preview exceeds 8 MiB');
    } else {
      out.previewImage = yield* pkg.add(
        'assets',
        format === 'png' ? 'png' : 'jpg',
        bytes,
      );
    }
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

export interface CompiledFiles {
  /** metadata.json, theme.json, licenses.json, assets/*, licenses/*: archive-relative. */
  readonly files: ReadonlyMap<string, Uint8Array>;
  readonly diagnostics: readonly Diagnostic[];
}

/** Compiles `projectDir` into the package's files, in memory. */
export const compileFiles = (projectDir: string) =>
  Effect.gen(function* () {
    const d = yield* Diagnostics;

    const project = yield* loadProject(projectDir);
    const tokens = yield* resolveTokens(project.tokens);
    const resolved = yield* resolveControls(project, tokens);
    const { theme, pkg } = yield* lowerTheme(project.dir, tokens, resolved);
    const metadata = yield* compileMetadata(project, pkg);
    yield* d.checkpoint;
    const licenses = pkg.manifest();

    yield* conforms('theme.json', CompiledThemeSchema, theme);
    yield* conforms('metadata.json', CompiledMetadataSchema, metadata);
    yield* conforms('licenses.json', CompiledLicensesSchema, licenses);
    yield* d.checkpoint;

    const files = new Map(pkg.files);
    const json = (name: string, value: unknown) =>
      files.set(
        name,
        new TextEncoder().encode(JSON.stringify(value, null, 2) + '\n'),
      );
    json('metadata.json', metadata);
    json('theme.json', theme);
    json('licenses.json', licenses);
    return { files, diagnostics: yield* d.all } satisfies CompiledFiles;
  });

export interface Compiled {
  /** Directory holding metadata.json, theme.json, licenses.json, assets/, licenses/. */
  readonly dir: string;
  readonly diagnostics: readonly Diagnostic[];
}

/** Compiles `projectDir` into `outDir` (created if needed) or a fresh temp directory. */
export const compileProject = (projectDir: string, outDir?: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const { files, diagnostics } = yield* compileFiles(projectDir);
    const dir =
      outDir ?? (yield* fs.makeTempDirectory({ prefix: 'galapatheme-' }));
    yield* fs.makeDirectory(dir, { recursive: true });
    for (const [path, bytes] of files) {
      yield* fs.makeDirectory(`${dir}/${path}`.replace(/\/[^/]+$/, ''), {
        recursive: true,
      });
      yield* fs.writeFile(`${dir}/${path}`, bytes);
    }
    return { dir, diagnostics } satisfies Compiled;
  });
