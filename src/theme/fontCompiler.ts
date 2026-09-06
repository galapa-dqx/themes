import type { FontRequest, ThemeResourceCompiler } from './controlCompiler';
import {
  ThemeCompilationError,
  errorDiagnostic,
  type ThemeDiagnostic,
} from './diagnostics';
import type {
  FontLicenseMetadata,
  FontWorkerRequest,
  FontWorkerResponse,
  FontWorkerSuccess,
} from './fontProtocol';
import { fetchGoogleFonts, type GoogleFontEntry } from './googleFonts';
import type { LicenseEntry } from './schema';
import { shortContentHash } from './svgCompiler';

export type FontBackendResult = Omit<FontWorkerSuccess, 'id' | 'ok'>;

export type FontBackend = {
  compile: (bytes: Uint8Array, request: FontRequest) => Promise<FontBackendResult>;
};

type Pending = {
  resolve: (result: FontBackendResult) => void;
  reject: (error: Error) => void;
};

export class WorkerFontBackend implements FontBackend {
  private readonly worker: Worker;
  private readonly pending = new Map<number, Pending>();
  private nextId = 1;

  constructor() {
    this.worker = new Worker(new URL('./fontWorker.ts', import.meta.url), {
      type: 'module',
      name: 'galapa-font-compiler',
    });
    this.worker.onmessage = (event: MessageEvent<FontWorkerResponse>) => {
      const response = event.data;
      const pending = this.pending.get(response.id);
      if (!pending) return;
      this.pending.delete(response.id);
      if (response.ok) {
        pending.resolve({
          bytes: response.bytes,
          extension: response.extension,
          license: response.license,
        });
      } else {
        pending.reject(new Error(response.message));
      }
    };
  }

  compile(bytes: Uint8Array, request: FontRequest): Promise<FontBackendResult> {
    const id = this.nextId;
    this.nextId += 1;
    const transferable = Uint8Array.from(bytes);
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message: FontWorkerRequest = { id, bytes: transferable, request };
      this.worker.postMessage(message, [transferable.buffer]);
    });
  }
}

function googleFamily(source: string): string | undefined {
  if (!source.startsWith('gfont:')) return undefined;
  try {
    return decodeURIComponent(source.slice(6).replaceAll('+', ' '));
  } catch {
    return undefined;
  }
}

function variantUrl(entry: GoogleFontEntry, request: FontRequest): string | undefined {
  const italic = request.style === 'italic';
  const weight = request.weight === 400 ? 'regular' : String(request.weight);
  const keys = italic
    ? ['italic', `${request.weight}italic`]
    : ['regular', weight];
  for (const key of keys) {
    if (entry.files[key]) return entry.files[key].replace(/^http:/, 'https:');
  }
  return undefined;
}

function noticeText(license: FontLicenseMetadata): string | undefined {
  const sections = [license.copyright, license.description, license.url].filter(Boolean);
  return sections.length ? `${sections.join('\n\n')}\n` : undefined;
}

export class FontCompiler {
  readonly resources = new Map<string, Uint8Array>();
  readonly diagnostics: ThemeDiagnostic[] = [];
  private readonly projectFiles: ReadonlyMap<string, Uint8Array>;
  private readonly backend: FontBackend;
  private readonly fetcher: typeof fetch;
  private readonly catalog: () => Promise<GoogleFontEntry[]>;
  private readonly licenses = new Map<string, { license: string; licenseFile?: string }>();
  private readonly cache = new Map<string, Promise<string>>();

  constructor(options: {
    projectFiles: ReadonlyMap<string, Uint8Array>;
    backend?: FontBackend;
    fetcher?: typeof fetch;
    catalog?: () => Promise<GoogleFontEntry[]>;
  }) {
    this.projectFiles = options.projectFiles;
    this.backend = options.backend ?? new WorkerFontBackend();
    this.fetcher = options.fetcher ?? fetch;
    this.catalog = options.catalog ?? fetchGoogleFonts;
  }

  private async sourceBytes(request: FontRequest): Promise<Uint8Array> {
    const family = googleFamily(request.source);
    if (family !== undefined) {
      const catalog = await this.catalog();
      const entry = catalog.find(
        (candidate) => candidate.family.toLocaleLowerCase('en-US') === family.toLocaleLowerCase('en-US'),
      );
      if (!entry) {
        throw new ThemeCompilationError(`Google Font ${family} does not exist.`, [
          errorDiagnostic('unknown-google-font', `Google Font ${family} does not exist.`, request.path),
        ]);
      }
      const url = variantUrl(entry, request);
      if (!url) {
        throw new ThemeCompilationError(
          `${entry.family} does not provide ${request.weight} ${request.style}.`,
          [
            errorDiagnostic(
              'missing-font-face',
              `${entry.family} does not provide ${request.weight} ${request.style}.`,
              request.path,
            ),
          ],
        );
      }
      const response = await this.fetcher(url, {
        signal: AbortSignal.timeout(30_000),
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
      });
      if (!response.ok) {
        throw new ThemeCompilationError(`Could not download ${entry.family}.`, [
          errorDiagnostic(
            'font-download-failed',
            `Could not download ${entry.family}: HTTP ${response.status}.`,
            request.path,
          ),
        ]);
      }
      return new Uint8Array(await response.arrayBuffer());
    }
    const path = request.source.startsWith('./') ? request.source.slice(2) : request.source;
    const bytes = this.projectFiles.get(path);
    if (!bytes) {
      throw new ThemeCompilationError(`Font ${request.source} does not exist.`, [
        errorDiagnostic('missing-font', `Font ${request.source} does not exist.`, request.path),
      ]);
    }
    return bytes;
  }

  async compileFont(request: FontRequest): Promise<string> {
    const key = JSON.stringify({
      source: request.source,
      weight: request.weight,
      style: request.style,
      axes: Object.fromEntries(Object.entries(request.axes).sort()),
    });
    const cached = this.cache.get(key);
    if (cached) return cached;
    const compilation = this.compileUncached(request);
    this.cache.set(key, compilation);
    return compilation;
  }

  private async compileUncached(request: FontRequest): Promise<string> {
    try {
      const source = await this.sourceBytes(request);
      const compiled = await this.backend.compile(source, request);
      const hash = await shortContentHash(compiled.bytes);
      const path = `./assets/fonts/${hash}.${compiled.extension}`;
      this.resources.set(path, compiled.bytes);
      if (compiled.license.identifier) {
        const notice = noticeText(compiled.license);
        let licenseFile: string | undefined;
        if (notice) {
          const bytes = new TextEncoder().encode(notice);
          const noticeHash = await shortContentHash(bytes);
          licenseFile = `./licenses/${noticeHash}.txt`;
          this.resources.set(licenseFile, bytes);
        }
        this.licenses.set(path, {
          license: compiled.license.identifier,
          ...(licenseFile ? { licenseFile } : {}),
        });
      } else {
        this.diagnostics.push({
          severity: 'warning',
          code: 'unknown-font-license',
          message: `No recognized license metadata was found for ${request.source}.`,
          path: request.path,
        });
      }
      return path;
    } catch (error) {
      if (error instanceof ThemeCompilationError) throw error;
      throw new ThemeCompilationError(`Could not compile ${request.source}.`, [
        errorDiagnostic(
          'font-compilation-failed',
          error instanceof Error ? error.message : `Could not compile ${request.source}.`,
          request.path,
        ),
      ]);
    }
  }

  licenseEntries(): LicenseEntry[] {
    const groups = new Map<string, LicenseEntry>();
    for (const [file, metadata] of this.licenses) {
      const key = `${metadata.license}\0${metadata.licenseFile ?? ''}`;
      const group = groups.get(key) ?? {
        files: [],
        license: metadata.license,
        ...(metadata.licenseFile ? { licenseFile: metadata.licenseFile } : {}),
      };
      group.files.push(file);
      groups.set(key, group);
    }
    return [...groups.values()].map((entry) => ({
      ...entry,
      files: entry.files.sort(),
    }));
  }
}

export function combineResourceCompilers(
  assets: Pick<ThemeResourceCompiler, 'compileAsset' | 'compileBuiltInAsset'>,
  fonts: Pick<ThemeResourceCompiler, 'compileFont'>,
): ThemeResourceCompiler {
  return {
    compileAsset: assets.compileAsset.bind(assets),
    compileBuiltInAsset: assets.compileBuiltInAsset.bind(assets),
    compileFont: fonts.compileFont.bind(fonts),
  };
}

