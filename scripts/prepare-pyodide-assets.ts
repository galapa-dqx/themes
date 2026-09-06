import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pyodidePackage from 'pyodide/package.json' with { type: 'json' };
import pyodideLock from 'pyodide/pyodide-lock.json' with { type: 'json' };

const root = resolve(import.meta.dirname, '..');
const target = resolve(root, '.pyodide-assets');
const fonttools = pyodideLock.packages.fonttools;
const output = resolve(target, fonttools.file_name);
const expected = fonttools.sha256;

const digest = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const existing = await readFile(output).catch(() => undefined);
if (!existing || digest(existing) !== expected) {
  const url = `https://cdn.jsdelivr.net/pyodide/v${pyodidePackage.version}/full/${fonttools.file_name}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Could not download fontTools: HTTP ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (digest(bytes) !== expected) throw new Error('Downloaded fontTools wheel failed SHA-256 verification.');
  await mkdir(target, { recursive: true });
  await writeFile(output, bytes);
}

