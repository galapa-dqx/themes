/**
 * An Effect `FileSystem` over the File System API (OPFS or a picked
 * directory). Paths are POSIX-style and absolute from the root handle. Only
 * the operations the compiler and editor need are implemented; the rest fail
 * with NotFound like `FileSystem.makeNoop`. Streams, links, and permissions
 * have no OPFS equivalent.
 */
import { Error as PlatformError, FileSystem } from '@effect/platform';
import { Effect, Layer, Option } from 'effect';

/** The handle surface this layer uses; real handles satisfy it structurally. */
export interface DirHandle {
  readonly kind: 'directory';
  getDirectoryHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<DirHandle>;
  getFileHandle(
    name: string,
    options?: { create?: boolean },
  ): Promise<FileHandle>;
  removeEntry(name: string, options?: { recursive?: boolean }): Promise<void>;
  entries(): AsyncIterable<[string, DirHandle | FileHandle]>;
}
export interface FileHandle {
  readonly kind: 'file';
  getFile(): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    size: number;
    lastModified: number;
  }>;
  createWritable(): Promise<{
    write(data: Uint8Array): Promise<void>;
    close(): Promise<void>;
  }>;
}

const REASONS: Record<string, PlatformError.SystemErrorReason> = {
  NotFoundError: 'NotFound',
  TypeMismatchError: 'BadResource',
  NotAllowedError: 'PermissionDenied',
  NoModificationAllowedError: 'Busy',
  InvalidModificationError: 'Busy',
  QuotaExceededError: 'WriteZero',
};
const systemError = (method: string, path: string) => (e: unknown) =>
  e instanceof PlatformError.SystemError
    ? e
    : new PlatformError.SystemError({
        module: 'FileSystem',
        method,
        reason: REASONS[(e as DOMException).name] ?? 'Unknown',
        description: (e as Error).message,
        pathOrDescriptor: path,
        cause: e,
      });
const badPath = (method: string, path: string) =>
  new PlatformError.BadArgument({
    module: 'FileSystem',
    method,
    description: `invalid path ${path}`,
  });

const segments = (path: string) =>
  path.split('/').filter((s) => s && s !== '.');

export const makeFileSystem = (root: DirHandle): FileSystem.FileSystem => {
  /** Directory handle at `path`, creating missing levels when `create`. */
  const dir = async (path: string, create = false) => {
    let h = root;
    for (const s of segments(path))
      h = await h.getDirectoryHandle(s, { create });
    return h;
  };
  /** Parent handle and entry name; `''` names the root. */
  const parent = async (path: string, create = false) => {
    const segs = segments(path);
    const name = segs.pop() ?? '';
    return { parent: await dir(segs.join('/'), create), name };
  };
  const op = <A>(method: string, path: string, f: () => Promise<A>) =>
    Effect.gen(function* () {
      if (segments(path).includes('..')) return yield* badPath(method, path);
      return yield* Effect.tryPromise({
        try: f,
        catch: systemError(method, path),
      });
    });

  const file = async (path: string) =>
    (await parent(path)).parent.getFileHandle(await nameOf(path));
  const nameOf = async (path: string) => segments(path).pop() ?? '';

  const stat = (path: string) =>
    op('stat', path, async () => {
      const { parent: p, name } = await parent(path);
      const info = (
        type: FileSystem.File.Type,
        size = 0,
        mtime?: number,
      ): FileSystem.File.Info => ({
        type,
        mtime:
          mtime === undefined ? Option.none() : Option.some(new Date(mtime)),
        atime: Option.none(),
        birthtime: Option.none(),
        dev: 0,
        ino: Option.none(),
        mode: 0,
        nlink: Option.none(),
        uid: Option.none(),
        gid: Option.none(),
        rdev: Option.none(),
        size: FileSystem.Size(size),
        blksize: Option.none(),
        blocks: Option.none(),
      });
      if (!name) return info('Directory');
      try {
        const f = await (await p.getFileHandle(name)).getFile();
        return info('File', f.size, f.lastModified);
      } catch (e) {
        if ((e as DOMException).name !== 'TypeMismatchError') throw e;
        return info('Directory');
      }
    });

  const copyInto = async (
    from: DirHandle | FileHandle,
    to: DirHandle,
    name: string,
  ) => {
    if (from.kind === 'file') {
      const w = await (
        await to.getFileHandle(name, { create: true })
      ).createWritable();
      await w.write(new Uint8Array(await (await from.getFile()).arrayBuffer()));
      await w.close();
      return;
    }
    const target = await to.getDirectoryHandle(name, { create: true });
    for await (const [child, handle] of from.entries())
      await copyInto(handle, target, child);
  };

  const remove: FileSystem.FileSystem['remove'] = (path, options) =>
    op('remove', path, async () => {
      const { parent: p, name } = await parent(path);
      await p.removeEntry(name, { recursive: options?.recursive ?? false });
    });

  const makeTempDirectory: FileSystem.FileSystem['makeTempDirectory'] = (
    options,
  ) =>
    op('makeTempDirectory', '/.tmp', async () => {
      const name = `${options?.prefix ?? ''}${crypto.randomUUID()}`;
      await dir(`/.tmp/${name}`, true);
      return `/.tmp/${name}`;
    });

  return FileSystem.make({
    ...FileSystem.makeNoop({}),
    access: (path) => Effect.asVoid(stat(path)),
    stat,
    readFile: (path) =>
      op(
        'readFile',
        path,
        async () =>
          new Uint8Array(
            await (await (await file(path)).getFile()).arrayBuffer(),
          ),
      ),
    writeFile: (path, data) =>
      op('writeFile', path, async () => {
        const { parent: p, name } = await parent(path);
        const w = await (
          await p.getFileHandle(name, { create: true })
        ).createWritable();
        await w.write(data);
        await w.close();
      }),
    readDirectory: (path) =>
      op('readDirectory', path, async () => {
        const names: string[] = [];
        for await (const [name] of (await dir(path)).entries())
          names.push(name);
        return names.sort();
      }),
    makeDirectory: (path, options) =>
      op('makeDirectory', path, async () => {
        if (options?.recursive) return void (await dir(path, true));
        const { parent: p, name } = await parent(path);
        await p.getDirectoryHandle(name, { create: true });
      }),
    remove,
    copy: (from, to) =>
      op('copy', from, async () => {
        const { parent: src, name } = await parent(from);
        const source = name
          ? await src
              .getDirectoryHandle(name)
              .catch(() => src.getFileHandle(name))
          : src;
        const { parent: dst, name: target } = await parent(to, true);
        await copyInto(source, dst, target);
      }),
    copyFile: (from, to) =>
      op('copyFile', from, async () => {
        const { parent: dst, name } = await parent(to);
        await copyInto(await file(from), dst, name);
      }),
    rename: (from, to) =>
      op('rename', from, async () => {
        const { parent: src, name } = await parent(from);
        const source = await src
          .getDirectoryHandle(name)
          .catch(() => src.getFileHandle(name));
        const { parent: dst, name: target } = await parent(to);
        await copyInto(source, dst, target);
        await src.removeEntry(name, { recursive: true });
      }),
    makeTempDirectory,
    makeTempDirectoryScoped: (options) =>
      Effect.acquireRelease(makeTempDirectory(options), (path) =>
        Effect.ignore(remove(path, { recursive: true })),
      ),
  });
};

export const layer = (root: DirHandle) =>
  Layer.succeed(FileSystem.FileSystem, makeFileSystem(root));

/** The browser's origin-private file system. */
export const layerOpfs = Layer.effect(
  FileSystem.FileSystem,
  Effect.map(
    Effect.promise(() => navigator.storage.getDirectory()),
    (root) => makeFileSystem(root as unknown as DirHandle),
  ),
);
