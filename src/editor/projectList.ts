/**
 * The Projects page's data: every `/projects/<id>` folder in OPFS plus the
 * first-party collection bundled from `themes/` at build time. A card shows
 * whatever `metadata.previewImage` points at; nothing is synthesized here.
 */
import { FileSystem } from '@effect/platform';
import { Effect, Option } from 'effect';
import type { RootControlId } from '@/theme/catalog';
import type { ProjectMetadata } from '@/theme/schema';
import { projectDir, serialize } from './persistence';
import { newProjectId, type Document } from './projectStore';

export interface ProjectCard {
  readonly id: string;
  readonly metadata: ProjectMetadata;
  /** Epoch ms of metadata.json; undefined for a folder that never finished writing. */
  readonly editedAt?: number;
  readonly controls: number;
  /** A data: URL for the preview image, when the file exists. */
  readonly cover?: string;
}

export const previewMime = (path: string) =>
  path.endsWith('.svg')
    ? 'image/svg+xml'
    : path.endsWith('.png')
      ? 'image/png'
      : 'image/jpeg';
const dataUrl = (bytes: Uint8Array, type: string) =>
  `data:${type};base64,${btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''))}`;

/** Every project folder, newest edit first. Folders without metadata are skipped. */
export const listProjects = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  const ids = yield* fs
    .readDirectory('/projects')
    .pipe(Effect.orElseSucceed(() => []));
  const cards = yield* Effect.forEach(
    ids,
    (id) =>
      Effect.gen(function* () {
        const dir = projectDir(id);
        const text = yield* Effect.option(
          fs.readFileString(`${dir}/metadata.json`),
        );
        if (Option.isNone(text)) return undefined;
        const metadata = JSON.parse(text.value) as ProjectMetadata;
        const stat = yield* Effect.option(fs.stat(`${dir}/metadata.json`));
        const files = yield* fs
          .readDirectory(`${dir}/controls`)
          .pipe(Effect.orElseSucceed(() => []));
        const preview = metadata.previewImage;
        const cover = preview
          ? yield* fs.readFile(`${dir}/${preview.slice(2)}`).pipe(
              Effect.map((b) => dataUrl(b, previewMime(preview))),
              Effect.orElseSucceed(() => undefined),
            )
          : undefined;
        return {
          id,
          metadata,
          editedAt: Option.getOrUndefined(
            Option.flatMap(stat, (s) => s.mtime),
          )?.getTime(),
          controls: files.filter((f) => f.endsWith('.json')).length,
          cover,
        } satisfies ProjectCard;
      }),
    { concurrency: 4 },
  );
  return cards
    .filter((c) => c !== undefined)
    .sort((a, b) => (b.editedAt ?? 0) - (a.editedAt ?? 0));
});

export const deleteProject = (id: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.remove(projectDir(id), { recursive: true }),
  );

/** Copies a project folder (disk is authoritative here) under a new id and name. */
export const duplicateFolder = (card: ProjectCard) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const id = newProjectId();
    yield* fs.copy(projectDir(card.id), projectDir(id));
    yield* fs.writeFileString(
      `${projectDir(id)}/metadata.json`,
      JSON.stringify(
        {
          ...card.metadata,
          id: `app.galapa.themes.${id}`,
          name: `${card.metadata.name} copy`,
        },
        null,
        2,
      ) + '\n',
    );
    return id;
  });

// ponytail: races a tab that has the project open; its writer wins on next save.
export const renameProject = (card: ProjectCard, name: string) =>
  Effect.flatMap(FileSystem.FileSystem, (fs) =>
    fs.writeFileString(
      `${projectDir(card.id)}/metadata.json`,
      JSON.stringify({ ...card.metadata, name }, null, 2) + '\n',
    ),
  );

// ---------------------------------------------------------- first party

const THEME_JSON = import.meta.glob('/themes/*/**/*.json', {
  eager: true,
  import: 'default',
}) as Record<string, Record<string, unknown>>;
/** Asset URLs (served by Vite), fetched as bytes on duplicate. */
const THEME_ASSETS = import.meta.glob('/themes/*/assets/*', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>;

export interface FirstPartyTheme {
  readonly key: string;
  readonly doc: Document;
  readonly cover?: string;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };
const strip = ({ $schema: _, ...rest }: Record<string, unknown>) => rest;
export const FIRST_PARTY: readonly FirstPartyTheme[] = Object.entries(
  Object.entries(THEME_JSON).reduce<Record<string, Mutable<Document>>>(
    (acc, [path, value]) => {
      const [, , key, ...rest] = path.split('/');
      const doc = (acc[key] ??= {
        metadata: {} as never,
        tokens: {},
        controls: {},
      });
      const file = rest.join('/');
      if (file === 'metadata.json') doc.metadata = strip(value) as never;
      else if (file === 'tokens.json') doc.tokens = strip(value) as never;
      else if (rest[0] === 'controls')
        doc.controls[rest[1].slice(0, -5) as RootControlId] = strip(
          value,
        ) as never;
      return acc;
    },
    {},
  ),
)
  .map(([key, doc]) => ({
    key,
    doc,
    cover: doc.metadata.previewImage
      ? THEME_ASSETS[`/themes/${key}/${doc.metadata.previewImage.slice(2)}`]
      : undefined,
  }))
  .sort((a, b) => a.doc.metadata.name.localeCompare(b.doc.metadata.name));

/** Writes a first-party theme (assets included) into a new project folder and returns its id. */
export const duplicateFirstParty = ({ key, doc }: FirstPartyTheme) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const id = newProjectId();
    const dir = projectDir(id);
    yield* fs.makeDirectory(`${dir}/controls`, { recursive: true });
    yield* fs.makeDirectory(`${dir}/assets`, { recursive: true });
    const copy: Document = {
      ...doc,
      metadata: { ...doc.metadata, id: `app.galapa.themes.${id}` },
    };
    const files = [
      'metadata.json',
      'tokens.json',
      ...Object.keys(copy.controls).map((c) => `controls/${c}.json`),
    ];
    yield* Effect.forEach(
      files,
      (f) => fs.writeFileString(`${dir}/${f}`, serialize(copy, f)!),
      { discard: true },
    );
    const prefix = `/themes/${key}/assets/`;
    yield* Effect.forEach(
      Object.entries(THEME_ASSETS).filter(([p]) => p.startsWith(prefix)),
      ([p, url]) =>
        Effect.promise(() => fetch(url).then((r) => r.arrayBuffer())).pipe(
          Effect.flatMap((buf) =>
            fs.writeFile(
              `${dir}/assets/${p.slice(prefix.length)}`,
              new Uint8Array(buf),
            ),
          ),
        ),
      { discard: true },
    );
    return id;
  });

export const ago = (t: number) => {
  const s = (Date.now() - t) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 172800) return 'yesterday';
  return new Date(t).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
};
