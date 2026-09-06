import { describe, expect, it } from 'vitest';
import { ThemeCompilationError } from './diagnostics';
import { compileSvg } from './svgCompiler';

const options = {
  profile: 'image' as const,
  path: './assets/test.svg',
  resolveColor: (value: unknown) => (value === '{colors.accent}' ? '#123456' : String(value)),
};

describe('compileSvg', () => {
  it('inlines safe CSS, resolves color tokens, and removes root dimensions', () => {
    const compiled = compileSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24">
        <style>.shape { stroke: #abcdef; }</style>
        <path class="shape" fill="{colors.accent}" d="M0 0h24v24z" />
      </svg>`,
      options,
    );
    const output = new TextDecoder().decode(compiled.bytes);

    expect(output).toContain('fill="#123456"');
    expect(output).toContain('stroke="#abcdef"');
    expect(output).not.toContain('<style');
    expect(output).not.toMatch(/<svg[^>]+\swidth=/);
    expect(output).not.toMatch(/<svg[^>]+\sheight=/);
  });

  it('preserves currentColor and reports that the consumer must supply it', () => {
    const compiled = compileSvg(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path fill="currentColor" d="M0 0h10v10z"/></svg>',
      options,
    );
    expect(compiled.usesCurrentColor).toBe(true);
  });

  it('rejects visible unsupported content rather than silently deleting it', () => {
    expect(() =>
      compileSvg(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><text>nope</text></svg>',
        options,
      ),
    ).toThrowError(ThemeCompilationError);
  });

  it('validates and materializes a complete 1x1 nine-slice', () => {
    const compiled = compileSvg(
      `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
        <rect id="frame" x="1" y="1" width="18" height="18" fill="none"/>
        <rect id="content" x="4" y="4" width="12" height="12" fill="none"/>
        <svg id="0_0" x="0" y="0" width="20" height="20">
          <rect width="20" height="20" fill="#123456"/>
        </svg>
      </svg>`,
      { ...options, profile: 'nine-slice' },
    );
    expect(compiled.nineSlice).toEqual({ content: [4, 4, 12, 12] });
    expect(new TextDecoder().decode(compiled.bytes)).toContain(
      'data-slice-repeat="stretch"',
    );
  });
});

