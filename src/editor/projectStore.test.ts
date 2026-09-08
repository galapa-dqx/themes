import { describe, expect, it } from 'vitest';
import {
  createProjectStore,
  dirtyFiles,
  newDocument,
  newProjectId,
  type Document,
} from './projectStore';

const doc: Document = {
  metadata: {
    formatVersion: 1,
    name: 'Fixture',
    chromeStyle: 'dark',
  } as Document['metadata'],
  tokens: { colors: { accent: '#ff0000' } },
  controls: { panel: { shape: 'path', fill: '{colors.accent}' } },
};

describe('createProjectStore', () => {
  it('runs undoable transactions and reports dirty files', () => {
    const editorStore = createProjectStore(doc);
    const s = editorStore.getState();
    s.edit('rename', (d) => {
      d.metadata.name = 'Renamed';
      d.controls.panel = { shape: 'path', fill: '#00ff00' };
    });
    expect(editorStore.getState().doc?.metadata.name).toBe('Renamed');
    expect(dirtyFiles(editorStore.getState().applied)).toEqual(
      new Set(['metadata.json', 'controls/panel.json']),
    );
    expect(doc.metadata.name).toBe('Fixture'); // structural sharing, no mutation

    s.edit('noop', () => {});
    expect(editorStore.getState().past).toHaveLength(1);

    s.undo();
    expect(editorStore.getState().doc).toEqual(doc);
    expect(dirtyFiles(editorStore.getState().applied)).toEqual(
      new Set(['metadata.json', 'controls/panel.json']),
    );
    s.redo();
    expect(editorStore.getState().doc?.controls.panel).toEqual({
      shape: 'path',
      fill: '#00ff00',
    });
    expect(editorStore.getState().future).toEqual([]);

    s.undo();
    s.edit('tokens', (d) => void (d.tokens.colors!.accent = '#0000ff'));
    expect(editorStore.getState().future).toEqual([]); // a new edit drops redo
    expect(dirtyFiles(editorStore.getState().applied)).toEqual(
      new Set(['tokens.json']),
    );
  });
});

describe('edit coalescing', () => {
  it('merges consecutive same-label edits into one undo step', () => {
    const base = newDocument(newProjectId(), 'Fixture');
    const s = createProjectStore(base).getState;
    s().edit('Rename theme', (d) => void (d.metadata.name = 'A'));
    s().edit('Rename theme', (d) => void (d.metadata.name = 'AB'));
    s().edit('Edit author', (d) => void (d.metadata.author.name = 'me'));
    s().edit('Rename theme', (d) => void (d.metadata.name = 'ABC'));
    expect(s().past.map((t) => t.label)).toEqual([
      'Rename theme',
      'Edit author',
      'Rename theme',
    ]);
    expect(s().applied).toHaveLength(1); // dirty tracking sees only the latest patches
    s().undo();
    s().undo();
    s().undo();
    expect(s().doc).toEqual(base);
    s().redo();
    expect(s().doc.metadata.name).toBe('AB');
  });
});

describe('newDocument', () => {
  it('mints a schema-shaped id', () => {
    expect(newDocument(newProjectId(), 'x').metadata.id).toMatch(
      /^app\.galapa\.themes\.[a-z0-9]{20}$/,
    );
  });
});
