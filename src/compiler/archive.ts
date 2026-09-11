/**
 * The two containers: a project archive (`.galapathemeproj`) and a compiled
 * theme (`.galapatheme`). Each is a fixed prefix in front of an ordinary ZIP;
 * the central directory sits at the tail, so readers that tolerate leading
 * bytes open the payload as-is.
 *
 *   project   "GLPTHPRJ"  u16 BE version                    (10 bytes)
 *   theme     "GLPTHEME"  u16 BE version  u64 BE publishedAt (18 bytes)
 */
import { unzipSync, zipSync, type Zippable } from 'fflate';
import {
  PROJECT_MAGIC,
  THEME_FORMAT_VERSION,
  THEME_MAGIC,
} from '@/theme/schema';

export class ArchiveError extends Error {}

const PROJECT_PREFIX = 10;
const THEME_PREFIX = 18;
/** The spec's project-archive envelope. */
const LIMITS = {
  entries: 4096,
  expanded: 512 * 1024 * 1024,
  entry: 256 * 1024 * 1024,
};
// ZIP timestamps start in 1980; a fixed one keeps identical input bytes-identical.
const MTIME = new Date('1980-01-02T00:00:00Z');

const prefix = (magic: string, length: number) => {
  const out = new Uint8Array(length);
  out.set(new TextEncoder().encode(magic));
  new DataView(out.buffer).setUint16(8, THEME_FORMAT_VERSION);
  return out;
};

const zip = (files: ReadonlyMap<string, Uint8Array>) => {
  const entries: Zippable = {};
  for (const path of [...files.keys()].sort())
    entries[path] = [files.get(path)!, { level: 9, mtime: MTIME }];
  return zipSync(entries);
};

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

export const packProject = (files: ReadonlyMap<string, Uint8Array>) =>
  concat(prefix(PROJECT_MAGIC, PROJECT_PREFIX), zip(files));

export const packTheme = (
  files: ReadonlyMap<string, Uint8Array>,
  publishedAt: number,
) => {
  const p = prefix(THEME_MAGIC, THEME_PREFIX);
  new DataView(p.buffer).setBigUint64(10, BigInt(publishedAt));
  return concat(p, zip(files));
};

/** Archive-relative, no drive, no `.`/`..`, NFC. */
const checkPath = (path: string) => {
  const segments = path.normalize('NFC').split('/');
  if (
    path !== path.normalize('NFC') ||
    /[\\\0]|^[a-zA-Z]:/.test(path) ||
    segments.some((s) => s === '' || s === '.' || s === '..')
  )
    throw new ArchiveError(
      `Archive path ${JSON.stringify(path)} escapes its package.`,
    );
};

/** The files of a project archive, keyed by archive-relative path. */
export const unpackProject = (bytes: Uint8Array) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (
    bytes.length < PROJECT_PREFIX ||
    new TextDecoder().decode(bytes.subarray(0, 8)) !== PROJECT_MAGIC
  )
    throw new ArchiveError('This is not a Galapa theme project.');
  const version = view.getUint16(8);
  if (version !== THEME_FORMAT_VERSION)
    throw new ArchiveError(
      version > THEME_FORMAT_VERSION
        ? 'This project needs a newer editor.'
        : `No migrator is available for project format ${version}.`,
    );
  // The filter sees each entry's declared size before it is inflated.
  // ponytail: a lying declaration still inflates in full; a streaming unzip
  // would cut it off mid-entry. ZIP64 and multipart are not detected either.
  let entries = 0;
  let expanded = 0;
  const raw = unzipSync(bytes.subarray(PROJECT_PREFIX), {
    filter: (f) => {
      if (++entries > LIMITS.entries)
        throw new ArchiveError(`More than ${LIMITS.entries} entries.`);
      if (f.originalSize > LIMITS.entry)
        throw new ArchiveError(`${f.name} exceeds 256 MiB.`);
      if ((expanded += f.originalSize) > LIMITS.expanded)
        throw new ArchiveError('The project expands beyond 512 MiB.');
      return !f.name.endsWith('/');
    },
  });
  const files = new Map<string, Uint8Array>();
  for (const [path, data] of Object.entries(raw)) {
    checkPath(path);
    if (files.has(path))
      throw new ArchiveError(`${path} appears twice in the archive.`);
    files.set(path, data);
  }
  return files;
};
