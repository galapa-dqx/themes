import { FileSystem } from '@effect/platform';
import { Effect, Exit, Scope } from 'effect';
import { describe, expect, it } from 'vitest';
import { MemoryDirectory } from '@/compiler/fixtures/memoryHandles';
import { layer } from '@/compiler/opfs';
import { openProject, projectDir } from './persistence';

const OPTS = { window: '20 millis', snapshotWait: '30 millis' } as const;
const tick = (ms = 60) => new Promise((r) => setTimeout(r, ms));

const setup = (id: string) => {
  const fs = layer(new MemoryDirectory());
  const read = (file: string) =>
    Effect.runPromise(
      Effect.gen(function* () {
        const f = yield* FileSystem.FileSystem;
        if (!(yield* f.exists(`${projectDir(id)}/${file}`))) return undefined;
        return JSON.parse(yield* f.readFileString(`${projectDir(id)}/${file}`));
      }).pipe(Effect.provide(fs)),
    );
  const open = () => {
    const scope = Effect.runSync(Scope.make());
    return Effect.runPromise(
      openProject(id, OPTS).pipe(Scope.extend(scope), Effect.provide(fs)),
    ).then((opened) => ({
      ...opened,
      close: () => Effect.runPromise(Scope.close(scope, Exit.void)),
    }));
  };
  return { read, open };
};

describe('openProject', () => {
  it('creates, batches writes, deletes removed controls, and flushes on close', async () => {
    const id = 'abcdefghij0123456789';
    const { read, open } = setup(id);
    const a = await open();
    expect(a.fresh).toBe(true);
    await tick();
    expect(await read('metadata.json')).toMatchObject({
      $schema: expect.stringContaining('metadata.schema.json'),
      id: `app.galapa.themes.${id}`,
      name: 'Untitled theme',
    });
    expect(await read('tokens.json')).toMatchObject({
      $schema: expect.any(String),
    });

    const s = a.store.getState();
    s.edit('add', (d) => {
      d.tokens.colors = { bg: '#123456' };
      d.controls.panel = { shape: 'path', fill: '{colors.bg}' };
    });
    expect(a.store.getState().saving).toBe(true);
    expect(await read('controls/panel.json')).toBeUndefined(); // batched
    await tick();
    expect(await read('controls/panel.json')).toMatchObject({ shape: 'path' });
    expect(await read('tokens.json')).toMatchObject({
      colors: { bg: '#123456' },
    });
    expect(a.store.getState().saving).toBe(false);

    s.undo();
    await tick();
    expect(await read('controls/panel.json')).toBeUndefined();

    s.edit('rename', (d) => void (d.metadata.name = 'Named'));
    await a.close(); // flushes without waiting for the window
    expect(await read('metadata.json')).toMatchObject({ name: 'Named' });

    const b = await open();
    expect(b.fresh).toBe(false);
    expect(b.store.getState().doc).toEqual(a.store.getState().doc);
    await b.close();
  });

  it('syncs patches between tabs and seeds a new tab from a peer', async () => {
    const id = 'sync0000000000000000';
    const { open } = setup(id);
    const a = await open();
    a.store.getState().edit('name', (d) => void (d.metadata.name = 'From A'));
    const b = await open(); // snapshot from A, not from disk (nothing flushed yet)
    expect(b.store.getState().doc.metadata.name).toBe('From A');

    b.store
      .getState()
      .edit('tokens', (d) => void (d.tokens.colors = { x: '#000000' }));
    await tick(10);
    expect(a.store.getState().doc.tokens.colors).toEqual({ x: '#000000' });
    expect(a.store.getState().remote).toBe(true);
    expect(a.store.getState().past).toHaveLength(1); // peer edits are not in A's history
    await a.close();
    await b.close();
  });
});
