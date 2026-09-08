/**
 * In-memory File System API handles for tests: the subset `opfs.ts` uses,
 * with the same DOMException names a browser throws.
 */
import type { DirHandle, FileHandle } from '@/compiler/opfs';

const dom = (name: string, message: string) => {
  const e = new Error(message);
  e.name = name;
  return e;
};

class MemoryFile implements FileHandle {
  readonly kind = 'file' as const;
  bytes = new Uint8Array();
  lastModified = 0;
  async getFile() {
    const bytes = this.bytes;
    return {
      size: bytes.length,
      lastModified: this.lastModified,
      arrayBuffer: async () => bytes.slice().buffer as ArrayBuffer,
    };
  }
  async createWritable() {
    const chunks: Uint8Array[] = [];
    return {
      write: async (data: Uint8Array) => void chunks.push(data),
      close: async () => {
        this.bytes = new Uint8Array(chunks.flatMap((c) => [...c]));
        this.lastModified = Date.now();
      },
    };
  }
}

export class MemoryDirectory implements DirHandle {
  readonly kind = 'directory' as const;
  readonly children = new Map<string, MemoryDirectory | MemoryFile>();

  private get(name: string, kind: 'directory' | 'file', create?: boolean) {
    const existing = this.children.get(name);
    if (existing) {
      if (existing.kind !== kind) throw dom('TypeMismatchError', `${name} is a ${existing.kind}`);
      return existing;
    }
    if (!create) throw dom('NotFoundError', `${name} not found`);
    const made = kind === 'directory' ? new MemoryDirectory() : new MemoryFile();
    this.children.set(name, made);
    return made;
  }
  async getDirectoryHandle(name: string, options?: { create?: boolean }) {
    return this.get(name, 'directory', options?.create) as MemoryDirectory;
  }
  async getFileHandle(name: string, options?: { create?: boolean }) {
    return this.get(name, 'file', options?.create) as MemoryFile;
  }
  async removeEntry(name: string, options?: { recursive?: boolean }) {
    const entry = this.children.get(name);
    if (!entry) throw dom('NotFoundError', `${name} not found`);
    if (entry.kind === 'directory' && entry.children.size && !options?.recursive) {
      throw dom('InvalidModificationError', `${name} is not empty`);
    }
    this.children.delete(name);
  }
  async *entries(): AsyncIterable<[string, DirHandle | FileHandle]> {
    yield* this.children;
  }
}
