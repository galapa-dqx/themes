import { describe, expect, it } from 'vitest';
import { cells, normalize, parseAsset } from './nineSlice';

describe('nine-slice model', () => {
  it('reads a plain SVG and folds a non-zero origin into the artwork', () => {
    const asset = parseAsset(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="5 5 80 40" width="160" height="80"><rect x="5" y="5" width="80" height="40"/></svg>',
    );
    expect(asset.viewBox).toEqual([0, 0, 80, 40]);
    expect(asset.slicing).toBeUndefined();
    expect(asset.art).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 40"><g transform="translate(-5 -5)"><rect x="5" y="5" width="80" height="40"/></g></svg>\n',
    );
  });

  it('reads a sliced file and reassembles its artwork', () => {
    const asset = parseAsset(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect id="frame" x="1" y="1" width="8" height="8" fill="none"/><rect id="content" x="3" y="3" width="4" height="4" fill="none"/>' +
        '<svg id="0_0" width="10" height="4" viewBox="0 0 10 4"><path d="M0 0h10v4H0z"/></svg>' +
        '<svg id="0_1" y="4" width="10" height="3"><path d="M0 0h10v3H0z"/></svg>' +
        '<svg id="0_2" y="7" width="10" height="3" viewBox="0 7 10 3" data-slice-repeat="round"><path d="M0 7h10v3H0z"/></svg></svg>',
    );
    expect(asset.slicing).toEqual({
      slices: { top: 4, right: 0, bottom: 3, left: 0 },
      overdraw: { top: 1, right: 1, bottom: 1, left: 1 },
      content: { top: 2, right: 2, bottom: 2, left: 2 },
      repeat: 'stretch',
    });
    expect(asset.art).toBe(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><path d="M0 0h10v4H0z"/><g transform="translate(0 4)"><path d="M0 0h10v3H0z"/></g><path d="M0 7h10v3H0z"/></svg>\n',
    );
  });

  it('lays out cells for every topology', () => {
    const s = normalize(
      {
        slices: { top: 2, right: 3, bottom: 2, left: 3 },
        overdraw: { top: 0, right: 0, bottom: 0, left: 0 },
        content: { top: 0, right: 0, bottom: 0, left: 0 },
        repeat: 'stretch',
      },
      [0, 0, 10, 10],
    );
    const grid = cells([0, 0, 10, 10], s);
    expect(grid).toHaveLength(9);
    expect(grid.filter((c) => c.fixed)).toHaveLength(4);
    expect(grid[4].rect).toEqual([3, 2, 4, 6]);
    expect(
      cells([0, 0, 10, 10], {
        ...s,
        slices: { ...s.slices, top: 0, bottom: 0 },
      }),
    ).toHaveLength(3);
    expect(
      cells([0, 0, 10, 10], {
        ...s,
        slices: { top: 0, right: 0, bottom: 0, left: 0 },
      }),
    ).toHaveLength(1);
  });

  it('normalizes tracks so nothing collapses', () => {
    const s = normalize(
      {
        slices: { top: 0, right: 5, bottom: 0, left: 0 },
        overdraw: { top: 0, right: 0, bottom: 0, left: 100 },
        content: { top: 30, right: 0, bottom: 30, left: 0 },
        repeat: 'stretch',
      },
      [0, 0, 20, 40],
    );
    expect(s.slices).toEqual({ top: 0, right: 5, bottom: 0, left: 1 });
    expect(s.overdraw.left).toBe(19);
    expect(s.content.top + s.content.bottom).toBeLessThan(40);
  });
});
