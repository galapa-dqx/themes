// Downloads the pinned fontTools wheel (SHA-256 verified) into .pyodide-assets.
// Vite copies it next to the Pyodide core into dist/pyodide; Node tests use the
// directory as Pyodide's package cache. Usage: pnpm pyodide:prepare
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pyodide from 'pyodide/package.json' with { type: 'json' };
import lock from 'pyodide/pyodide-lock.json' with { type: 'json' };

const dir = resolve(import.meta.dirname, '..', '.pyodide-assets');
const pkg = lock.packages.fonttools;
const file = resolve(dir, pkg.file_name);
const sha256 = (b: Uint8Array) => createHash('sha256').update(b).digest('hex');

const existing = await readFile(file).catch(() => undefined);
if (existing && sha256(existing) === pkg.sha256) process.exit(0);

const url = `https://cdn.jsdelivr.net/pyodide/v${pyodide.version}/full/${pkg.file_name}`;
const res = await fetch(url);
if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
const bytes = new Uint8Array(await res.arrayBuffer());
if (sha256(bytes) !== pkg.sha256)
  throw new Error(`${pkg.file_name}: SHA-256 mismatch`);
await mkdir(dir, { recursive: true });
await writeFile(file, bytes);
console.log(`fetched ${pkg.file_name}`);
