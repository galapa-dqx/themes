/**
 * Renders a nine-slice asset as a CSS grid of slice viewports, over the
 * authoring model (`Asset` + `cells`). Port of main's SliceGrid: fixed tracks
 * for caps, `1fr` for bands; undersized hosts shrink every cap by the single
 * border-image factor `f = min(1, w/(L+R), h/(T+B))` via container-query
 * units; repeating bands become background tiles.
 */
import type { CSSProperties, ReactNode } from 'react';
import { cells, type Asset, type Rect } from '@/editor/nineSlice';

type Caps = { x: number; y: number };

/** A fixed length that shrinks by the frame's uniform reduction factor. */
const scaled = (px: number, caps: Caps) => {
  const terms = [`${px}px`];
  if (caps.x > 0) terms.push(`${((px / caps.x) * 100).toFixed(4)}cqw`);
  if (caps.y > 0) terms.push(`${((px / caps.y) * 100).toFixed(4)}cqh`);
  return terms.length > 1 ? `min(${terms.join(', ')})` : terms[0];
};
const tracks = (sizes: (number | null)[], caps: Caps) =>
  sizes.map((s) => (s === null ? 'minmax(0, 1fr)' : scaled(s, caps))).join(' ');

/** The artwork sized to its viewBox so an outer viewBox can crop it to one cell. */
const placed = (asset: Asset) =>
  asset.art
    .replace(/<\?xml[^>]*\?>/, '')
    .replace(
      /<svg\b/,
      `<svg x="0" y="0" width="${asset.viewBox[2]}" height="${asset.viewBox[3]}"`,
    );
const cellSvg = (asset: Asset, rect: Rect, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${rect.join(' ')}" preserveAspectRatio="none"${extra}>${placed(asset)}</svg>`;

export function SliceGrid({
  asset,
  label,
  className,
  style,
}: {
  asset: Asset;
  /** Seated in the top-middle cell; the edge art reflows beside it. */
  label?: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  // ponytail: per-slice preserveAspectRatio unsupported; port main's parseNineSlice if a theme needs it.
  const s = asset.slicing;
  const grid = s
    ? cells(asset.viewBox, s)
    : [{ col: 0, row: 0, rect: asset.viewBox, fixed: false }];
  const cols: (number | null)[] =
    s && (s.slices.left || s.slices.right)
      ? [s.slices.left, null, s.slices.right]
      : [null];
  const rows: (number | null)[] =
    s && (s.slices.top || s.slices.bottom)
      ? [s.slices.top, null, s.slices.bottom]
      : [null];
  const caps: Caps = {
    x: cols.reduce<number>((t, c) => t + (c ?? 0), 0),
    y: rows.reduce<number>((t, r) => t + (r ?? 0), 0),
  };
  const art = placed(asset);
  return (
    <div className={className} style={{ containerType: 'size', ...style }}>
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: tracks(cols, caps),
          gridTemplateRows: tracks(rows, caps),
        }}
      >
        {grid.map(({ col, row, rect, fixed }) => {
          const key = `${col}_${row}`;
          const placement: CSSProperties = {
            minWidth: 0,
            minHeight: 0,
            gridColumn: col + 1,
            gridRow: row + 1,
          };
          const seats = label !== undefined && col === 1 && row === 0;
          const box = seats ? { flex: 1, minWidth: 0 } : placement;
          // Tile only along an axis where a band runs between fixed caps.
          const tileX = !fixed && cols.length === 3 && cols[col] === null;
          const tileY = !fixed && rows.length === 3 && rows[row] === null;
          const tiled =
            s && s.repeat !== 'stretch' && (tileX || tileY)
              ? {
                  backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(cellSvg(asset, rect))}")`,
                  backgroundSize: `${tileX ? scaled(rect[2], caps) : '100%'} ${tileY ? scaled(rect[3], caps) : '100%'}`,
                  backgroundRepeat: `${tileX ? s.repeat : 'no-repeat'} ${tileY ? s.repeat : 'no-repeat'}`,
                  backgroundPosition: 'center',
                }
              : undefined;
          const cell = tiled ? (
            <div key={key} aria-hidden="true" style={{ ...box, ...tiled }} />
          ) : (
            <svg
              key={key}
              aria-hidden="true"
              viewBox={rect.join(' ')}
              preserveAspectRatio="none"
              style={{
                display: 'block',
                width: '100%',
                height: '100%',
                ...box,
              }}
              dangerouslySetInnerHTML={{ __html: art }}
            />
          );
          if (!seats) return cell;
          return (
            <div
              key={key}
              style={{ ...placement, display: 'flex', alignItems: 'center' }}
            >
              {label}
              {cell}
            </div>
          );
        })}
      </div>
    </div>
  );
}
