/**
 * Project archives and compiled themes in and out of OPFS. Exports write the
 * open document to its folder first, so edits the batched writer has not
 * flushed yet are included; the compiler then reads the folder like the CLI.
 */
import { FileSystem, type Error as PlatformError } from '@effect/platform';
import { Effect } from 'effect';
import {
  ArchiveError,
  packProject,
  packTheme,
  unpackProject,
} from '@/compiler/archive';
import { compileFiles } from '@/compiler/compiler';
import { Diagnostics } from '@/compiler/diagnostics';
import { projectDir, writeDocument } from './persistence';
import { newProjectId, type Document } from './projectStore';

const ID_PREFIX = 'app.galapa.themes.';

/** Every file under `dir`, keyed by its path relative to `dir`. */
const walk = (dir: string) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const files = new Map<string, Uint8Array>();
    const visit = (
      rel: string,
    ): Effect.Effect<void, PlatformError.PlatformError> =>
      Effect.gen(function* () {
        for (const name of yield* fs.readDirectory(
          rel ? `${dir}/${rel}` : dir,
        )) {
          const path = rel ? `${rel}/${name}` : name;
          const info = yield* fs.stat(`${dir}/${path}`);
          if (info.type === 'Directory') yield* visit(path);
          else files.set(path, yield* fs.readFile(`${dir}/${path}`));
        }
      });
    yield* visit('');
    return files;
  });

// ponytail: a control file deleted in this session but not yet flushed is
// still on disk and gets exported; the writer removes it within its window.
export const exportProject = (dir: string, doc: Document) =>
  Effect.gen(function* () {
    yield* writeDocument(dir, doc);
    return packProject(yield* walk(dir));
  });

export const exportTheme = (dir: string, doc: Document) =>
  Effect.gen(function* () {
    yield* writeDocument(dir, doc);
    const { files, diagnostics } = yield* compileFiles(dir);
    return { bytes: packTheme(files, Date.now()), diagnostics };
  }).pipe(Effect.provide(Diagnostics.Default));

/**
 * Unpacks a project archive into a new folder and returns its id: the
 * archive's own when that folder is free, otherwise a fresh one written back
 * into metadata.json. Only metadata.json is parsed here; the tolerant loader
 * reports everything else when the project opens.
 */
export const importProject = (bytes: Uint8Array) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const files = yield* Effect.try({
      try: () => unpackProject(bytes),
      catch: (e) => e as ArchiveError,
    });
    const metadata = yield* Effect.try({
      try: () =>
        JSON.parse(
          new TextDecoder('utf-8', { fatal: true }).decode(
            files.get('metadata.json'),
          ),
        ) as { id?: unknown },
      catch: () => new ArchiveError('metadata.json is missing or not JSON.'),
    });
    const own =
      typeof metadata.id === 'string' && metadata.id.startsWith(ID_PREFIX)
        ? metadata.id.slice(ID_PREFIX.length)
        : '';
    const id =
      /^[\w-]+$/.test(own) && !(yield* fs.exists(projectDir(own)))
        ? own
        : newProjectId();
    if (id !== own)
      files.set(
        'metadata.json',
        new TextEncoder().encode(
          JSON.stringify({ ...metadata, id: ID_PREFIX + id }, null, 2) + '\n',
        ),
      );
    const dir = projectDir(id);
    yield* Effect.forEach(
      files,
      ([path, data]) =>
        Effect.andThen(
          fs.makeDirectory(`${dir}/${path}`.replace(/\/[^/]+$/, ''), {
            recursive: true,
          }),
          fs.writeFile(`${dir}/${path}`, data),
        ),
      { discard: true },
    );
    return id;
  });

/** `<name>.<ext>` with the characters no file system takes replaced. */
export const fileName = (name: string, ext: string) =>
  `${name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'theme'}${ext}`;

export const download = (name: string, bytes: Uint8Array) => {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart]));
  const a = Object.assign(document.createElement('a'), {
    href: url,
    download: name,
  });
  // Firefox needs the anchor attached, and the URL alive past this tick.
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
};
