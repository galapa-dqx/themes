/**
 * The two containers: a project archive (`.galapathemeproj`) and a compiled
 * theme (`.galapatheme`). Each is a fixed prefix in front of an ordinary ZIP;
 * the central directory sits at the tail, so readers that tolerate leading
 * bytes open the payload as-is.
 *
 *   project   "GLPTHPRJ"  u16 BE version                    (10 bytes)
 *   theme     "GLPTHEME"  u16 BE version  u64 BE publishedAt (18 bytes)
 */
import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipReader,
  ZipWriter,
} from '@zip.js/zip.js';
import {
  PROJECT_MAGIC,
  THEME_FORMAT_VERSION,
  THEME_MAGIC,
} from '@/theme/schema';

export class ArchiveError extends Error {}

const PROJECT_PREFIX = 10;
const THEME_PREFIX = 18;
const MiB = 1024 * 1024;
/** The spec's project-archive envelope. */
const LIMITS = {
  compressed: 256 * MiB,
  entries: 4096,
  expanded: 512 * MiB,
  entry: 256 * MiB,
};
const STORE = 0;
const DEFLATE = 8;
const END_RECORD = 22;
const ZIP64_LOCATOR = 0x07064b50;
// ZIP timestamps start in 1980; a fixed one keeps identical input bytes-identical.
const MTIME = new Date('1980-01-02T00:00:00Z');
// Archives here are small; a worker costs more than it saves.
const OPTIONS = { useWebWorkers: false };

const prefix = (magic: string, length: number) => {
  const out = new Uint8Array(length);
  out.set(new TextEncoder().encode(magic));
  new DataView(out.buffer).setUint16(8, THEME_FORMAT_VERSION);
  return out;
};

const zip = async (files: ReadonlyMap<string, Uint8Array>) => {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    ...OPTIONS,
    level: 9,
    lastModDate: MTIME,
    extendedTimestamp: false,
  });
  for (const path of [...files.keys()].sort())
    await writer.add(path, new Uint8ArrayReader(files.get(path)!));
  return writer.close();
};

const concat = (a: Uint8Array, b: Uint8Array) => {
  const out = new Uint8Array(a.length + b.length);
  out.set(a);
  out.set(b, a.length);
  return out;
};

export const packProject = async (files: ReadonlyMap<string, Uint8Array>) =>
  concat(prefix(PROJECT_MAGIC, PROJECT_PREFIX), await zip(files));

export const packTheme = async (
  files: ReadonlyMap<string, Uint8Array>,
  publishedAt: number,
) => {
  const p = prefix(THEME_MAGIC, THEME_PREFIX);
  new DataView(p.buffer).setBigUint64(10, BigInt(publishedAt));
  return concat(p, await zip(files));
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
export const unpackProject = async (bytes: Uint8Array) => {
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
  const payload = bytes.subarray(PROJECT_PREFIX);
  if (payload.length > LIMITS.compressed)
    throw new ArchiveError('The project exceeds 256 MiB compressed.');
  // Strict: local headers must agree with the central directory and nothing
  // may trail the end record. Inflation stops at an entry's declared size, so
  // capping the declarations below caps what is actually expanded.
  const reader = new ZipReader(new Uint8ArrayReader(payload), {
    ...OPTIONS,
    strictness: 'strict',
    checkCrc32: true,
    checkOverlappingEntry: true,
  });
  try {
    const entries = await reader.getEntries();
    if (entries.length > LIMITS.entries)
      throw new ArchiveError(`More than ${LIMITS.entries} entries.`);
    const locator = payload.length - END_RECORD - reader.comment.length - 20;
    if (
      entries.some((e) => e.zip64) ||
      (locator >= 0 &&
        new DataView(payload.buffer, payload.byteOffset).getUint32(
          locator,
          true,
        ) === ZIP64_LOCATOR)
    )
      throw new ArchiveError('ZIP64 archives are not supported.');
    const folded = new Set<string>();
    let expanded = 0;
    for (const entry of entries) {
      const path = entry.filename;
      if (entry.diskNumberStart !== 0)
        throw new ArchiveError('Multipart archives are not supported.');
      if (entry.encrypted) throw new ArchiveError(`${path} is encrypted.`);
      if (entry.symlink) throw new ArchiveError(`${path} is a symbolic link.`);
      if (
        entry.compressionMethod !== STORE &&
        entry.compressionMethod !== DEFLATE
      )
        throw new ArchiveError(
          `${path} uses unsupported compression method ${entry.compressionMethod}.`,
        );
      if (entry.uncompressedSize > LIMITS.entry)
        throw new ArchiveError(`${path} exceeds 256 MiB.`);
      if ((expanded += entry.uncompressedSize) > LIMITS.expanded)
        throw new ArchiveError('The project expands beyond 512 MiB.');
      if (entry.directory) continue;
      checkPath(path);
      if (folded.has(path.toLowerCase()))
        throw new ArchiveError(`${path} collides with another entry.`);
      folded.add(path.toLowerCase());
    }
    const files = new Map<string, Uint8Array>();
    for (const entry of entries)
      if (!entry.directory)
        files.set(entry.filename, await entry.getData(new Uint8ArrayWriter()));
    return files;
  } catch (e) {
    throw e instanceof ArchiveError
      ? e
      : new ArchiveError(
          `The archive is damaged or unsupported (${(e as Error).message}).`,
        );
  } finally {
    await reader.close();
  }
};
