import { unzipSync, zipSync, type Zippable } from 'fflate';
import {
  PROJECT_MAGIC,
  THEME_FORMAT_VERSION,
  type ProjectModel,
} from './schema';
import {
  ROOT_CONTROL_IDS,
  type RootControlId,
} from './catalog';
import {
  ThemeCompilationError,
  errorDiagnostic,
  type ThemeDiagnostic,
} from './diagnostics';
import {
  validateProjectMetadata,
  validateProjectTokens,
} from './validation';

const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
const PROJECT_PREFIX_BYTES = 10;
const ZIP_EOCD = 0x06054b50;
const ZIP_CENTRAL = 0x02014b50;
const ZIP64_SENTINEL_16 = 0xffff;
const ZIP64_SENTINEL_32 = 0xffffffff;
// ZIP's local-time timestamp cannot represent dates before 1980. The second
// day stays safely inside the range in every timezone while remaining fixed.
const ZIP_EPOCH = new Date('1980-01-02T00:00:00.000Z');

export type ArchiveLimits = {
  compressedBytes: number;
  expandedBytes: number;
  entries: number;
  entryBytes: number;
};

export const PROJECT_ARCHIVE_LIMITS: ArchiveLimits = {
  compressedBytes: 256 * 1024 * 1024,
  expandedBytes: 512 * 1024 * 1024,
  entries: 4096,
  entryBytes: 256 * 1024 * 1024,
};

export type ThemeProjectWorkspace = {
  model: ProjectModel;
  files: Map<string, Uint8Array>;
  diagnostics: ThemeDiagnostic[];
};

function equalMagic(bytes: Uint8Array, expected: string): boolean {
  if (bytes.length < expected.length) return false;
  for (let index = 0; index < expected.length; index += 1) {
    if (bytes[index] !== expected.charCodeAt(index)) return false;
  }
  return true;
}

function prefixError(message: string): never {
  throw new ThemeCompilationError(message, [
    errorDiagnostic('invalid-container-prefix', message),
  ]);
}

export function readProjectPrefix(bytes: Uint8Array): number {
  if (!equalMagic(bytes, PROJECT_MAGIC) || bytes.length < PROJECT_PREFIX_BYTES) {
    prefixError('This is not a Galapa theme project.');
  }
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint16(8, false);
}

function pathError(path: string, message: string): never {
  throw new ThemeCompilationError(message, [
    errorDiagnostic('unsafe-archive-path', message, path),
  ]);
}

export function validateArchivePath(path: string): void {
  if (
    !path ||
    path.startsWith('/') ||
    path.includes('\\') ||
    path.includes('\0') ||
    /^[a-zA-Z]:/.test(path)
  ) {
    pathError(path, `Unsafe archive path ${JSON.stringify(path)}.`);
  }
  const segments = path.split('/');
  if (segments.some((segment) => segment === '' || segment === '.' || segment === '..')) {
    pathError(path, `Archive path ${JSON.stringify(path)} escapes its package.`);
  }
  if (path !== path.normalize('NFC')) {
    pathError(path, `Archive path ${JSON.stringify(path)} is not Unicode NFC-normalized.`);
  }
}

function findEndOfCentralDirectory(bytes: Uint8Array): number {
  const minimum = Math.max(0, bytes.length - 65_557);
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let offset = bytes.length - 22; offset >= minimum; offset -= 1) {
    if (view.getUint32(offset, true) === ZIP_EOCD) return offset;
  }
  throw new ThemeCompilationError('ZIP end record is missing.', [
    errorDiagnostic('invalid-zip', 'ZIP end record is missing.'),
  ]);
}

function inspectZip(bytes: Uint8Array, limits: ArchiveLimits): void {
  if (bytes.byteLength > limits.compressedBytes) {
    throw new ThemeCompilationError('Archive exceeds the compressed size limit.', [
      errorDiagnostic('archive-too-large', 'Archive exceeds the compressed size limit.'),
    ]);
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const eocd = findEndOfCentralDirectory(bytes);
  const disk = view.getUint16(eocd + 4, true);
  const centralDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entryCount = view.getUint16(eocd + 10, true);
  const centralSize = view.getUint32(eocd + 12, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  if (
    disk !== 0 ||
    centralDisk !== 0 ||
    entriesOnDisk !== entryCount ||
    entryCount === ZIP64_SENTINEL_16 ||
    centralSize === ZIP64_SENTINEL_32 ||
    centralOffset === ZIP64_SENTINEL_32
  ) {
    throw new ThemeCompilationError('ZIP64 and multipart archives are not supported.', [
      errorDiagnostic('unsupported-zip', 'ZIP64 and multipart archives are not supported.'),
    ]);
  }
  if (entryCount > limits.entries || centralOffset + centralSize > eocd) {
    throw new ThemeCompilationError('ZIP directory is invalid or exceeds its limits.', [
      errorDiagnostic('invalid-zip', 'ZIP directory is invalid or exceeds its limits.'),
    ]);
  }

  let offset = centralOffset;
  let expandedTotal = 0;
  const foldedPaths = new Set<string>();
  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > bytes.length || view.getUint32(offset, true) !== ZIP_CENTRAL) {
      throw new ThemeCompilationError('ZIP central directory is malformed.', [
        errorDiagnostic('invalid-zip', 'ZIP central directory is malformed.'),
      ]);
    }
    const madeBy = view.getUint16(offset + 4, true) >> 8;
    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const expandedSize = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const externalAttributes = view.getUint32(offset + 38, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > bytes.length) {
      throw new ThemeCompilationError('ZIP central directory is truncated.', [
        errorDiagnostic('invalid-zip', 'ZIP central directory is truncated.'),
      ]);
    }
    if (
      compressedSize === ZIP64_SENTINEL_32 ||
      expandedSize === ZIP64_SENTINEL_32 ||
      (flags & 1) !== 0 ||
      (method !== 0 && method !== 8)
    ) {
      throw new ThemeCompilationError('The ZIP uses an unsupported feature.', [
        errorDiagnostic(
          'unsupported-zip',
          'Only unencrypted STORE or DEFLATE ZIP entries are supported.',
        ),
      ]);
    }
    if (madeBy === 3 && ((externalAttributes >>> 16) & 0xf000) === 0xa000) {
      throw new ThemeCompilationError('ZIP symlinks are not supported.', [
        errorDiagnostic('unsupported-zip', 'ZIP symlinks are not supported.'),
      ]);
    }
    if (expandedSize > limits.entryBytes) {
      throw new ThemeCompilationError('A ZIP entry exceeds its size limit.', [
        errorDiagnostic('archive-entry-too-large', 'A ZIP entry exceeds its size limit.'),
      ]);
    }
    expandedTotal += expandedSize;
    if (expandedTotal > limits.expandedBytes) {
      throw new ThemeCompilationError('Archive exceeds the expanded size limit.', [
        errorDiagnostic('archive-too-large', 'Archive exceeds the expanded size limit.'),
      ]);
    }

    const path = decoder.decode(bytes.subarray(offset + 46, offset + 46 + nameLength));
    if (!path.endsWith('/')) {
      validateArchivePath(path);
      const folded = path.normalize('NFC').toLocaleLowerCase('en-US');
      if (foldedPaths.has(folded)) {
        pathError(path, `Archive contains a case-insensitive path collision at ${path}.`);
      }
      foldedPaths.add(folded);
    }
    offset = next;
  }
  if (offset !== centralOffset + centralSize) {
    throw new ThemeCompilationError('ZIP central directory size is inconsistent.', [
      errorDiagnostic('invalid-zip', 'ZIP central directory size is inconsistent.'),
    ]);
  }
}

function unzip(bytes: Uint8Array, limits: ArchiveLimits): Map<string, Uint8Array> {
  inspectZip(bytes, limits);
  const unzipped = unzipSync(bytes);
  return new Map(
    Object.entries(unzipped).filter(([path]) => !path.endsWith('/')),
  );
}

function parseJson(files: Map<string, Uint8Array>, path: string): unknown {
  const bytes = files.get(path);
  if (!bytes) {
    throw new ThemeCompilationError(`Missing required ${path}.`, [
      errorDiagnostic('missing-project-file', `Missing required ${path}.`, path),
    ]);
  }
  try {
    return JSON.parse(decoder.decode(bytes));
  } catch (cause) {
    throw new ThemeCompilationError(`Could not parse ${path}.`, [
      errorDiagnostic(
        'malformed-json',
        cause instanceof Error ? cause.message : `Could not parse ${path}.`,
        path,
      ),
    ]);
  }
}

function schemaErrors(
  diagnostics: ThemeDiagnostic[],
  name: string,
): void {
  if (!diagnostics.length) return;
  throw new ThemeCompilationError(`${name} is invalid.`, diagnostics);
}

function encodePrefix(magic: string, length: number): Uint8Array {
  const prefix = new Uint8Array(length);
  prefix.set(encoder.encode(magic));
  new DataView(prefix.buffer).setUint16(8, THEME_FORMAT_VERSION, false);
  return prefix;
}

function concat(left: Uint8Array, right: Uint8Array): Uint8Array {
  const bytes = new Uint8Array(left.length + right.length);
  bytes.set(left);
  bytes.set(right, left.length);
  return bytes;
}

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, child]) => [key, stable(child)]),
  );
}

function jsonBytes(value: unknown): Uint8Array {
  return encoder.encode(`${JSON.stringify(stable(value), null, 2)}\n`);
}

function zipEntries(files: Map<string, Uint8Array>): Uint8Array {
  const entries: Zippable = {};
  for (const [path, bytes] of [...files].sort(([left], [right]) => left.localeCompare(right))) {
    entries[path] = [bytes, { level: 9, mtime: ZIP_EPOCH }];
  }
  return zipSync(entries);
}

export function loadProjectFolder(files: Map<string, Uint8Array>): ThemeProjectWorkspace {
  const metadata = parseJson(files, 'metadata.json');
  const tokens = parseJson(files, 'tokens.json');
  schemaErrors(validateProjectMetadata(metadata), 'metadata.json');
  // Semantically broken tokens are intentionally recoverable in the editor.
  const diagnostics = validateProjectTokens(tokens);
  const controls: Partial<Record<RootControlId, unknown>> = {};
  for (const id of ROOT_CONTROL_IDS) {
    const path = `controls/${id}.json`;
    if (files.has(path)) controls[id] = parseJson(files, path);
  }
  return {
    model: { metadata: metadata as ProjectModel['metadata'], tokens: tokens as ProjectModel['tokens'], controls },
    files,
    diagnostics,
  };
}

export function loadProjectArchive(bytes: Uint8Array): ThemeProjectWorkspace {
  const version = readProjectPrefix(bytes);
  if (version !== THEME_FORMAT_VERSION) {
    prefixError(
      version > THEME_FORMAT_VERSION
        ? 'This project requires a newer Galapa editor.'
        : `No migrator is available for project format ${version}.`,
    );
  }
  const workspace = loadProjectFolder(unzip(bytes.subarray(PROJECT_PREFIX_BYTES), PROJECT_ARCHIVE_LIMITS));
  if (workspace.model.metadata.formatVersion !== version) {
    prefixError('The project prefix and metadata format versions disagree.');
  }
  return workspace;
}

export function saveProjectArchive(workspace: ThemeProjectWorkspace): Uint8Array {
  const files = new Map(workspace.files);
  files.set('metadata.json', jsonBytes(workspace.model.metadata));
  files.set('tokens.json', jsonBytes(workspace.model.tokens));
  for (const [id, control] of Object.entries(workspace.model.controls)) {
    if (control !== undefined) files.set(`controls/${id}.json`, jsonBytes(control));
  }
  return concat(encodePrefix(PROJECT_MAGIC, PROJECT_PREFIX_BYTES), zipEntries(files));
}
