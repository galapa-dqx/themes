/**
 * The compiled package under construction: content-addressed files plus the
 * license map. Paths are archive-relative (`assets/<hash>.svg`); JSON
 * references prefix `./`.
 */
import { Effect } from 'effect';
import type { CompiledLicenses } from '@/theme/schema';
import { Diagnostics } from './diagnostics';

const utf8 = new TextEncoder();

/** First 12 hex characters of the SHA-256 of `bytes`. */
export const shortHash = (bytes: Uint8Array) =>
  Effect.promise(async () => {
    const digest = await crypto.subtle.digest('SHA-256', bytes as BufferSource);
    return [...new Uint8Array(digest, 0, 6)]
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  });

export class Package {
  readonly files = new Map<string, Uint8Array>();
  /** `license\0licenseFile` -> referencing files. */
  private readonly licenses = new Map<string, Set<string>>();

  /** Stores `bytes` under `<dir>/<hash>.<ext>` and returns its `./` reference. */
  add(dir: string, ext: string, bytes: Uint8Array) {
    return Effect.gen(this, function* () {
      const path = `${dir}/${yield* shortHash(bytes)}.${ext}`;
      const existing = this.files.get(path);
      if (existing && !equal(existing, bytes)) {
        yield* (yield* Diagnostics).error(
          'package',
          `content hash collision at ${path}`,
        );
      }
      this.files.set(path, bytes);
      return `./${path}`;
    });
  }

  /** Records that `file` is covered by `license`, packaging `text` as its notice when given. */
  license(file: string, license: string, text?: string) {
    return Effect.gen(this, function* () {
      const notice = text
        ? yield* this.add('licenses', 'txt', utf8.encode(text))
        : '';
      const key = `${license}\0${notice}`;
      if (!this.licenses.has(key)) this.licenses.set(key, new Set());
      this.licenses.get(key)!.add(file);
    });
  }

  manifest(): CompiledLicenses {
    return [...this.licenses]
      .map(([key, files]) => {
        const [license, licenseFile] = key.split('\0');
        return {
          files: [...files].sort(),
          license,
          ...(licenseFile ? { licenseFile } : {}),
        };
      })
      .sort((a, b) => a.license.localeCompare(b.license));
  }
}

const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((v, i) => v === b[i]);
