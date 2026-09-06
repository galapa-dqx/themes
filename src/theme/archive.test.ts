import { describe, expect, it } from 'vitest';
import {
  loadProjectArchive,
  saveProjectArchive,
  validateArchivePath,
  type ThemeProjectWorkspace,
} from './archive';

const workspace = (): ThemeProjectWorkspace => ({
  model: {
    metadata: {
      formatVersion: 1,
      id: 'app.galapa.themes.0123456789abcdefghij',
      name: 'Archive test',
      author: { name: 'Galapa' },
      updates: null,
      chromeStyle: 'light',
    },
    tokens: {},
    controls: {},
  },
  files: new Map([
    ['assets/Unused.svg', new TextEncoder().encode('<svg/>')],
  ]),
  diagnostics: [],
});

describe('project archives', () => {
  it('round-trips the prefix, JSON, and unused project assets', () => {
    const archive = saveProjectArchive(workspace());
    const loaded = loadProjectArchive(archive);

    expect(new TextDecoder().decode(archive.subarray(0, 8))).toBe('GLPTHPRJ');
    expect(loaded.model.metadata.name).toBe('Archive test');
    expect(loaded.files.has('assets/Unused.svg')).toBe(true);
  });

  it('rejects paths that can escape or collide across platforms', () => {
    expect(() => validateArchivePath('../theme.json')).toThrow(/escapes/);
    expect(() => validateArchivePath('assets\\theme.svg')).toThrow(/Unsafe/);
    expect(() => validateArchivePath('assets/e\u0301.svg')).toThrow(/NFC/);
  });
});
