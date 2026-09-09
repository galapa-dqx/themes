import { describe, expect, it } from 'vitest';
import { createProjectStore, type Document } from '@/editor/projectStore';
import { EMPTY } from '@/editor/tokensUtil';
import { controlEdit, type Raw } from './useControlEdit';

const doc: Document = {
  metadata: { formatVersion: 1, name: 'Fixture' } as Document['metadata'],
  tokens: { colors: { text: '#111111' }, typography: { body: {} } },
  controls: {},
};

const setup = () => {
  const store = createProjectStore(doc);
  const button = () => store.getState().doc.controls.button as Raw | undefined;
  const edit = () =>
    controlEdit('button', button() ?? EMPTY, store.getState().edit);
  return { store, button, edit };
};

describe('controlEdit', () => {
  it('creates the control from the skeleton and writes dotted keys', () => {
    const { button, edit } = setup();
    edit().set([], 'default', 'border.thickness', 2);
    expect(button()).toEqual({
      shape: 'path',
      border: { thickness: 2 },
      parts: {
        text: { color: '{colors.text}', typography: '{typography.body}' },
      },
    });
    edit().set(['text'], 'hover', 'color', '#ff0000');
    expect((button()!.parts as Raw).text).toMatchObject({
      states: { hover: { color: '#ff0000' } },
    });
  });

  it('creates a frame from the conventional surface tokens', () => {
    const store = createProjectStore({
      ...doc,
      tokens: { colors: { surface: '#ffffff', border: '#000000' } },
    });
    controlEdit('panel', EMPTY, store.getState().edit).create();
    expect(store.getState().doc.controls.panel).toEqual({
      shape: 'path',
      fill: '{colors.surface}',
      border: { color: '{colors.border}', thickness: 1 },
    });
  });

  it('writes only the edited field into a missing frame', () => {
    const store = createProjectStore({
      ...doc,
      tokens: { colors: { surface: '#ffffff', border: '#000000' } },
    });
    controlEdit('panel', EMPTY, store.getState().edit).set(
      [],
      'default',
      'radius',
      6,
    );
    expect(store.getState().doc.controls.panel).toEqual({
      shape: 'path',
      radius: 6,
    });
  });

  it('deletes through the chain and prunes emptied states', () => {
    const { button, edit } = setup();
    edit().set([], 'hover', 'border.thickness', 2);
    edit().set([], 'hover', 'border.thickness', undefined);
    expect(button()!.states).toBeUndefined();
    edit().set([], 'default', 'border.thickness', undefined);
    expect(button()!.border).toBeUndefined();
  });

  it('copies a state (showRing stripped) and resets it at every node', () => {
    const { button, edit } = setup();
    edit().set([], 'focused', 'fill', '#00ff00');
    edit().set([], 'focused', 'showRing', false);
    edit().set(['text'], 'hover', 'color', '#ff0000');
    edit().copyState('focused', 'hover');
    expect(button()!.states).toEqual({
      focused: { fill: '#00ff00', showRing: false },
      hover: { fill: '#00ff00' },
    });
    // No source at the part: the destination is dropped.
    expect((button()!.parts as Raw).text).not.toHaveProperty('states');
    edit().resetState('focused');
    expect(button()!.states).toEqual({ hover: { fill: '#00ff00' } });
  });

  it('switches shape keeping opacity, size, parts and shape-free state overrides', () => {
    const { button, edit } = setup();
    edit().set([], 'default', 'fill', '#00ff00');
    edit().set([], 'default', 'opacity', 0.5);
    edit().set([], 'hover', 'fill', '#0000ff');
    edit().set([], 'hover', 'opacity', 0.8);
    edit().set([], 'pressed', 'radius', 4);
    edit().setShape([], 'asset');
    expect(button()).toEqual({
      shape: 'asset',
      opacity: 0.5,
      states: { hover: { opacity: 0.8 } },
      parts: {
        text: { color: '{colors.text}', typography: '{typography.body}' },
      },
    });
  });
});
