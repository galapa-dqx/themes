import { describe, expect, it } from 'vitest';
import { MATERIAL_HINTS, NEWS_GEMS } from './builtin';
import { colorRefs, compileSvg, SvgError } from './svg';

const wrap = (body: string, attrs = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"${attrs}>${body}</svg>`;
const image = (source: string, colors?: Record<string, string>) =>
  compileSvg(source, { profile: 'image', colors });
const rejects = (
  source: string,
  message: string,
  profile: 'image' | 'nine-slice' = 'image',
) =>
  expect(() => compileSvg(source, { profile })).toThrow(new SvgError(message));

describe('compileSvg (image)', () => {
  it('inlines CSS, bakes tokens, canonicalizes paints, and strips inert material', () => {
    const r = image(
      `<?xml version="1.0"?><!-- hi --><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10" overflow="hidden">
        <title>t</title><desc>d</desc><metadata>m</metadata>
        <style>.a { stroke: white }</style>
        <defs><linearGradient id="g"><stop offset="0%" stop-color="rgb(255, 0, 0)"/></linearGradient></defs>
        <rect class="a" data-name="Layer 1" aria-hidden="true" width="5" height="5" fill="{colors.accent}"/>
        <circle r="1" fill="url(#g)" stroke="currentColor" style="opacity:0.5;mask-type: alpha"/>
      </svg>`,
      { accent: '#123456' },
    );
    expect(r.usesCurrentColor).toBe(true);
    expect(r.content).toBeUndefined();
    expect(r.svg).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0%" stop-color="#ff0000"/></linearGradient></defs><rect width="5" height="5" fill="#123456" stroke="#ffffff"/><circle r="1" fill="url(#g)" stroke="currentColor" mask-type="alpha" opacity="0.5"/></svg>\n',
    );
    expect(
      colorRefs(
        '<a fill="{colors.x}" stroke="{colors.x}"/><b fill="{colors.y-z}"/>',
      ),
    ).toEqual(['x', 'y-z']);
  });

  it('rejects unsupported and hostile content with a source-oriented message', () => {
    rejects(wrap('<text>hi</text>'), '<text>: convert text to outlines');
    rejects(wrap('<script>1</script>'), '<script>: scripts are not supported');
    rejects(wrap('<filter id="f"/>'), '<filter id="f">: disable effects');
    rejects(
      wrap('<rect width="1" height="1" onclick="x"/>'),
      '<rect>: unsupported attribute onclick',
    );
    rejects(
      wrap('<rect width="1" height="1" pointer-events="none"/>'),
      '<rect>: unsupported attribute pointer-events',
    );
    rejects(
      wrap('<rect width="1" height="1" color="red"/>'),
      '<rect>: unsupported attribute color',
    );
    rejects(
      wrap('<use href="http://x/y#z"/>'),
      '<use>: only same-document #fragment references are supported',
    );
    rejects(wrap('<use href="#nope"/>'), '<use>: unknown fragment #nope');
    rejects(
      wrap('<rect width="1" height="1" fill="url(#g) currentColor"/>'),
      '<rect>: only same-document url(#fragment) references are supported',
    );
    rejects(
      wrap('<rect width="1" height="1" fill="{colors.nope}"/>'),
      '<rect>: unknown color token {colors.nope}',
    );
    rejects(
      wrap('<rect width="1" height="1" style="mix-blend-mode:multiply"/>'),
      '<rect>: unsupported CSS "mix-blend-mode:multiply"',
    );
    rejects(
      wrap('<rect width="1em" height="1"/>'),
      '<rect>: width must be a plain number, got "1em"',
    );
    rejects(wrap('<g id="a"/><g id="a"/>'), '<g id="a">: duplicate id "a"');
    rejects(
      wrap('', ' overflow="visible"'),
      '<svg>: artwork is always clipped; remove overflow',
    );
    rejects(
      '<svg xmlns="http://www.w3.org/2000/svg" width="100%"/>',
      '<svg>: a finite, positive viewBox is required',
    );
    rejects(
      '<!DOCTYPE svg [<!ENTITY x "y">]><svg/>',
      'entity declarations are not supported',
    );
    rejects('<svg', 'document must contain one <svg> root');
    rejects(
      '<svg><rect></svg>',
      'cannot parse: <input>:1:17: Unexpected close tag',
    );
  });
});

const slice = (
  id: string,
  x: number,
  y: number,
  w: number,
  h: number,
  extra = '',
) =>
  `<svg id="${id}" x="${x}" y="${y}" width="${w}" height="${h}"${extra}><rect width="${w}" height="${h}" fill="#000000"/></svg>`;
const grid3 = [
  slice('0_0', 0, 0, 2, 2, ' data-slice-repeat="repeat"'),
  slice('1_0', 2, 0, 6, 2),
  slice('2_0', 8, 0, 2, 2),
  slice('0_1', 0, 2, 2, 6),
  slice('1_1', 2, 2, 6, 6, ' preserveAspectRatio="xMidYMid meet"'),
  slice('2_1', 8, 2, 2, 6),
  slice('0_2', 0, 8, 2, 2),
  slice('1_2', 2, 8, 6, 2),
  slice('2_2', 8, 8, 2, 2),
].join('');
const markers =
  '<rect id="frame" x="1" y="1" width="8" height="8" fill="none"/><rect id="content" x="2" y="2" width="6" height="6" fill="none"/>';
const nine = (body: string) =>
  compileSvg(wrap(body), { profile: 'nine-slice' });

describe('compileSvg (nine-slice)', () => {
  it('validates the grid, materializes slice defaults, and returns the content rect', () => {
    const r = nine(markers + grid3);
    expect(r.content).toEqual([2, 2, 6, 6]);
    expect(r.svg).toContain(
      '<svg id="0_0" width="2" height="2" x="0" y="0" data-slice-repeat="repeat">',
    );
    expect(r.svg).toContain(
      '<svg id="1_0" width="6" height="2" x="2" y="0" data-slice-repeat="stretch" preserveAspectRatio="none">',
    );
    expect(r.svg).toContain(
      'data-slice-repeat="stretch" preserveAspectRatio="xMidYMid meet"',
    );
    expect(nine(markers + slice('0_0', 0, 0, 10, 10)).content).toEqual([
      2, 2, 6, 6,
    ]);
  });

  it('rejects broken profiles', () => {
    const n = (body: string, message: string) =>
      rejects(wrap(body), message, 'nine-slice');
    n(grid3, '<svg>: nine-slice requires a direct child <rect id="frame">');
    n(
      markers.replace('id="frame" x="1"', 'id="frame" x="-1"') + grid3,
      '<rect id="frame">: frame must lie within the viewBox',
    );
    n(
      markers.replace(
        'fill="none"/><rect id="content"',
        'fill="#fff"/><rect id="content"',
      ) + grid3,
      '<rect id="frame">: marker rectangles must not paint',
    );
    n(
      markers + grid3 + '<defs/>',
      '<defs>: nine-slice root may only contain markers and <svg id="col_row"> slices',
    );
    n(
      markers + grid3.replace('id="2_2"', 'id="2_3"'),
      '<svg>: slices must form a complete 1x1, 1x3, 3x1, or 3x3 grid',
    );
    n(
      markers + grid3.replace('id="1_1" x="2"', 'id="1_1" x="3"'),
      '<svg>: slice 1_1 does not tile its row and column',
    );
    n(
      markers + slice('0_0', 0, 0, 5, 10),
      '<svg>: slices do not span the viewBox width',
    );
    n(
      markers + slice('0_0', 0, 0, 10, 10, ' data-slice-repeat="tile"'),
      '<svg id="0_0">: unknown repeat mode "tile"',
    );
    n(
      markers +
        slice(
          '0_0',
          0,
          0,
          10,
          10,
          ' data-slice-repeat="round" preserveAspectRatio="none"',
        ),
      '<svg id="0_0">: round slices may not set preserveAspectRatio',
    );
    n(
      markers +
        slice('0_0', 0, 0, 10, 10, ' preserveAspectRatio="xMinYMin slice"'),
      '<svg id="0_0">: stretch slices support only preserveAspectRatio none or xMidYMid meet',
    );
  });

  it('requires fragment references to stay inside their slice', () => {
    const defs =
      '<defs><linearGradient id="g"><stop offset="0"/></linearGradient></defs>';
    const use = `<svg id="0_0" width="10" height="10"><rect width="10" height="10" fill="url(#g)"/></svg>`;
    rejects(
      wrap(markers + defs + use),
      '<defs>: nine-slice root may only contain markers and <svg id="col_row"> slices',
      'nine-slice',
    );
    const self = `<svg id="0_0" width="10" height="10">${defs}<rect width="10" height="10" fill="url(#g)"/></svg>`;
    expect(nine(markers + self).content).toEqual([2, 2, 6, 6]);
  });
});

describe('built-in artwork', () => {
  it('compiles and uses currentColor', () => {
    for (const source of [
      ...Object.values(MATERIAL_HINTS),
      ...Object.values(NEWS_GEMS),
    ]) {
      expect(image(source).usesCurrentColor).toBe(true);
    }
  });
});
