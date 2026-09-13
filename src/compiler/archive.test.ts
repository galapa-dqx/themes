import {
  Uint8ArrayReader,
  Uint8ArrayWriter,
  ZipWriter,
  type ZipWriterConstructorOptions,
} from '@zip.js/zip.js';
import { describe, expect, it } from 'vitest';
import { ArchiveError, packProject, packTheme, unpackProject } from './archive';

const enc = (s: string) => new TextEncoder().encode(s);
const MiB = 1024 * 1024;
const CENTRAL = 0x02014b50;
const LOCAL = 0x04034b50;
const END = 0x06054b50;

/** A project archive around a hand-configured ZIP, to reach past what packProject writes. */
const project = async (
  entries: Record<string, string>,
  options: ZipWriterConstructorOptions = {},
) => {
  const writer = new ZipWriter(new Uint8ArrayWriter(), {
    useWebWorkers: false,
    level: 0,
    dataDescriptor: false,
    ...options,
  });
  for (const [name, data] of Object.entries(entries))
    await writer.add(name, new Uint8ArrayReader(enc(data)));
  const prefix = (await packProject(new Map())).subarray(0, 10);
  const zip = await writer.close();
  const out = new Uint8Array(prefix.length + zip.length);
  out.set(prefix);
  out.set(zip, prefix.length);
  return out;
};

/** Overwrites a little-endian field in every header carrying `signature`. */
const patch = (
  bytes: Uint8Array,
  signature: number,
  offset: number,
  value: number,
  width: 2 | 4,
) => {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  for (let i = 0; i + 4 <= bytes.length; i++) {
    if (view.getUint32(i, true) !== signature) continue;
    if (width === 2) view.setUint16(i + offset, value, true);
    else view.setUint32(i + offset, value, true);
  }
  return bytes;
};

/** Replaces every occurrence of an equal-length byte string. */
const rename = (bytes: Uint8Array, from: string, to: string) => {
  const [f, t] = [enc(from), enc(to)];
  for (let i = 0; i + f.length <= bytes.length; i++)
    if (f.every((b, j) => bytes[i + j] === b)) bytes.set(t, i);
  return bytes;
};

const rejects = (bytes: Uint8Array | Promise<Uint8Array>, reason: RegExp) =>
  expect(Promise.resolve(bytes).then(unpackProject)).rejects.toThrow(reason);

describe('project archives', () => {
  it('round-trips files behind the prefix, byte-identically', async () => {
    const files = new Map([
      ['metadata.json', enc('{}')],
      ['assets/a.svg', enc('<svg/>')],
    ]);
    const bytes = await packProject(files);
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('GLPTHPRJ');
    expect(await unpackProject(bytes)).toEqual(files);
    expect(await packProject(files)).toEqual(bytes);
    // Directory entries are allowed and carry nothing.
    expect([
      ...(
        await unpackProject(await project({ 'assets/': '', 'a.json': '' }))
      ).keys(),
    ]).toEqual(['a.json']);
  });

  it('rejects the wrong magic, a short file, and other format versions', async () => {
    const bytes = await packProject(new Map([['a.json', enc('{}')]]));
    const version = (v: number) => {
      const copy = bytes.slice();
      new DataView(copy.buffer).setUint16(8, v);
      return copy;
    };
    await rejects(packTheme(new Map(), 1), /not a Galapa theme project/);
    await rejects(enc('GLPTHP'), /not a Galapa theme project/);
    await rejects(version(2), /newer editor/);
    await rejects(version(0), /No migrator .* format 0/);
  });

  it('rejects a payload over 256 MiB before reading it', async () => {
    const big = new Uint8Array(10 + 256 * MiB + 1);
    big.set((await packProject(new Map())).subarray(0, 10));
    await rejects(big, /256 MiB compressed/);
  });

  it.each(['../x', '/abs', 'a//b', 'a\\b', 'C:/x', './x', 'cafe\u0301.json'])(
    'rejects the path %j',
    (path) =>
      rejects(project({ [path]: 'x' }), /escapes its package|Unsafe filename/),
  );

  it('rejects duplicate paths, including after case folding', async () => {
    await rejects(
      project({ 'a.json': 'x', 'A.json': 'y' }),
      /A\.json collides/,
    );
    await rejects(
      project({ 'a.json': 'x', 'b.json': 'y' }).then((b) =>
        rename(b, 'b.json', 'a.json'),
      ),
      /collides|Ambiguous archive/,
    );
  });

  it('rejects ZIP64, encryption, symlinks, and methods besides STORE and DEFLATE', async () => {
    await rejects(project({ 'a.json': '{}' }, { zip64: true }), /ZIP64/);
    await rejects(project({ 'a.json': '{}' }, { password: 'pw' }), /encrypted/);
    await rejects(
      project({ 'a.json': 'target' }, { unixMode: 0o120777 }),
      /symbolic link/,
    );
    // Deflate64, which zip.js would otherwise inflate.
    await rejects(
      project({ 'a.json': '{}' }).then((b) =>
        patch(patch(b, CENTRAL, 10, 9, 2), LOCAL, 8, 9, 2),
      ),
      /compression method 9/,
    );
  });

  it('rejects multipart archives', async () => {
    await rejects(
      project({ 'a.json': '{}' }).then((b) =>
        patch(patch(b, END, 4, 1, 2), END, 6, 1, 2),
      ),
      /Multipart|Split zip file/,
    );
    await rejects(
      project({ 'a.json': '{}' }).then((b) => patch(b, CENTRAL, 34, 1, 2)),
      /Multipart/,
    );
  });

  it('enforces the entry-count, per-entry, and expanded limits', async () => {
    await rejects(
      project(
        Object.fromEntries(
          Array.from({ length: 4097 }, (_, i) => [`f${i}`, '']),
        ),
      ),
      /More than 4096 entries/,
    );
    await rejects(
      project({ 'a.json': '{}' }).then((b) =>
        patch(b, CENTRAL, 24, 256 * MiB + 1, 4),
      ),
      /a\.json exceeds 256 MiB/,
    );
    await rejects(
      project({ a: '1', b: '2', c: '3' }).then((b) =>
        patch(b, CENTRAL, 24, 200 * MiB, 4),
      ),
      /beyond 512 MiB/,
    );
  });

  it('stops an entry that inflates past its declared size', async () => {
    const lying = await project(
      { 'a.json': '0123456789'.repeat(100) },
      { level: 9 },
    );
    patch(patch(lying, CENTRAL, 24, 10, 4), LOCAL, 22, 10, 4);
    await expect(unpackProject(lying)).rejects.toThrow(ArchiveError);
  });
});

describe('compiled themes', () => {
  it('stamps the theme prefix', async () => {
    const bytes = await packTheme(new Map(), 1_700_000_000_000);
    const v = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('GLPTHEME');
    expect(v.getUint16(8)).toBe(1);
    expect(v.getBigUint64(10)).toBe(1_700_000_000_000n);
  });
});
