import { describe, expect, it } from 'vitest';
import { packProject, packTheme, unpackProject } from './archive';

const enc = (s: string) => new TextEncoder().encode(s);

describe('archives', () => {
  it('round-trips a project behind its prefix', () => {
    const files = new Map([
      ['metadata.json', enc('{}')],
      ['assets/a.svg', enc('<svg/>')],
    ]);
    const bytes = packProject(files);
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('GLPTHPRJ');
    expect(Object.fromEntries(unpackProject(bytes))).toEqual(
      Object.fromEntries(files),
    );
    expect(() => unpackProject(packTheme(files, 1))).toThrow(
      'not a Galapa theme project',
    );
    expect(() =>
      unpackProject(packProject(new Map([['../x', enc('')]]))),
    ).toThrow('escapes');
  });

  it('stamps the theme prefix', () => {
    const bytes = packTheme(new Map(), 1_700_000_000_000);
    const v = new DataView(bytes.buffer);
    expect(new TextDecoder().decode(bytes.subarray(0, 8))).toBe('GLPTHEME');
    expect(v.getUint16(8)).toBe(1);
    expect(v.getBigUint64(10)).toBe(1_700_000_000_000n);
  });
});
