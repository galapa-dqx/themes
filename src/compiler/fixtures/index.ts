/**
 * Test fixtures. `full/` is a complete valid project that exercises every
 * compiler path; the other directories hold only the files they change and
 * are layered over it. Test-only (Node paths).
 */
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';

export const FIXTURES = import.meta.dirname;

/**
 * Copies `layers` in order into a fresh scoped temp directory (later layers
 * overwrite), then writes `files` (string, bytes, or JSON) on top.
 */
export const fixtureProject = (
  layers: string[] = ['full'],
  files: Record<string, unknown> = {},
) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped();
    for (const layer of layers) {
      yield* fs.copy(`${FIXTURES}/${layer}`, dir, { overwrite: true });
    }
    for (const [name, value] of Object.entries(files)) {
      yield* fs.makeDirectory(`${dir}/${name}`.replace(/\/[^/]+$/, ''), {
        recursive: true,
      });
      if (value instanceof Uint8Array)
        yield* fs.writeFile(`${dir}/${name}`, value);
      else {
        const body = typeof value === 'string' ? value : JSON.stringify(value);
        yield* fs.writeFileString(`${dir}/${name}`, body);
      }
    }
    return dir;
  });
