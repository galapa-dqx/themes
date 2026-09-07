/**
 * The smallest schema-valid project: every required root and part, nothing
 * optional. Test-only. Keyed by project-relative path.
 */
import { FileSystem } from '@effect/platform';
import { Effect } from 'effect';

const font = 'gfont:Space+Grotesk';
const typography = { font, fontWeight: 400, fontSize: 12 };
const text = { color: '#111111', typography };
const path = { shape: 'path' };
const svg = './assets/dot.svg';

export const MINIMAL_PROJECT: Record<string, unknown> = {
  'metadata.json': {
    formatVersion: 1,
    id: 'app.galapa.themes.abcdefghij0123456789',
    name: 'Minimal',
    author: { name: 'Test' },
    updates: null,
    chromeStyle: 'light',
  },
  'tokens.json': {},
  'controls/window.json': { fill: '#ffffff' },
  'controls/focus-ring.json': { color: '#0000ff' },
  'controls/panel.json': path,
  'controls/button.json': { ...path, parts: { text } },
  'controls/input.json': {
    ...path,
    parts: {
      label: text,
      value: text,
      placeholder: text,
      caret: { color: '#000000' },
    },
  },
  'controls/tab.json': { ...path, parts: { text } },
  'controls/subtab.json': { ...path, parts: { text } },
  'controls/carousel.json': {
    ...path,
    parts: { nav: { asset: svg }, pip: { asset: svg } },
  },
  'controls/switch.json': { parts: { track: path, thumb: path } },
  'controls/news-item.json': {
    ...path,
    parts: { title: text, date: text, gem: { currentColor: '#000000' } },
  },
  'controls/setting-row.json': { ...path, parts: { label: text, value: text } },
  'controls/titlebar.json': {
    ...path,
    parts: {
      wordmark: text,
      caption: path,
      'caption-icon': { color: '#000000' },
      close: path,
      'close-icon': { color: '#000000' },
    },
  },
  'controls/subtabs.json': path,
  'controls/scrollbar.json': { parts: { track: path, thumb: path } },
  'controls/progress.json': { parts: { track: path, indicator: path } },
  'controls/tab-bar.json': { parts: { hint: { currentColor: '#000000' } } },
  'controls/settings.json': { parts: { heading: text } },
  'controls/setting-help.json': { parts: { title: text, body: text } },
  'assets/dot.svg':
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"><circle r="1"/></svg>',
};

/** Writes a file map into a fresh scoped temp directory and returns its path. */
export const writeProject = (files: Record<string, unknown>) =>
  Effect.gen(function* () {
    const fs = yield* FileSystem.FileSystem;
    const dir = yield* fs.makeTempDirectoryScoped();
    for (const [name, value] of Object.entries(files)) {
      if (value === undefined) continue;
      yield* fs.makeDirectory(`${dir}/${name}`.replace(/\/[^/]+$/, ''), {
        recursive: true,
      });
      const body = typeof value === 'string' ? value : JSON.stringify(value);
      yield* fs.writeFileString(`${dir}/${name}`, body);
    }
    return dir;
  });
