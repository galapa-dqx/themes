import type { CSSProperties } from 'react';
import type { SliceCell, SliceSet } from '@/theme/nineSlice';

/** Renders a parsed .9.svg as a grid of slice viewports. CSS does all the
 *  stretching: fixed tracks for caps, 1fr tracks for bands. Bands with a
 *  repeat mode render as CSS background tiles instead — background-repeat
 *  speaks the same repeat/round/space vocabulary as border-image, and the
 *  slices are self-contained documents thanks to token pre-substitution.
 *
 *  Undersized hosts follow border-image's reduction rule (also the contract
 *  the Skia port must match): a SINGLE factor
 *  f = min(1, w/(left+right), h/(top+bottom)) shrinks every fixed track, so
 *  corners scale down uniformly — never distorted, never letterboxed — and
 *  the perpendicular edges absorb the freed space. Repeat tiles scale by
 *  the same factor, as border-image scales its edge tiles. The factor mixes
 *  both container dimensions, which plain percentages can't see — hence the
 *  container-type wrapper and cq units: a shrinking length L·f expands to
 *  min(Lpx, shareX·cqw, shareY·cqh). */

type CapSums = { x: number; y: number };

const sum = (sizes: (number | null)[]) =>
  sizes.reduce((total: number, s) => total + (s ?? 0), 0);

/** A fixed length that shrinks by the frame's uniform reduction factor. */
const scaled = (px: number, caps: CapSums) => {
  const terms = [`${px}px`];
  if (caps.x > 0) terms.push(`${((px / caps.x) * 100).toFixed(4)}cqw`);
  if (caps.y > 0) terms.push(`${((px / caps.y) * 100).toFixed(4)}cqh`);
  return terms.length > 1 ? `min(${terms.join(', ')})` : terms[0];
};

const tracks = (sizes: (number | null)[], caps: CapSums) =>
  sizes.map((s) => (s === null ? 'minmax(0, 1fr)' : scaled(s, caps))).join(' ');

function tileStyle(
  cell: SliceCell,
  set: SliceSet,
  caps: CapSums,
): CSSProperties | null {
  if (cell.repeat === 'stretch') return null;
  // A cell tiles along an axis only where a stretching band runs between
  // fixed caps; single-track axes always stretch to fill.
  const tileX = set.cols === 3 && set.colSizes[cell.col] === null;
  const tileY = set.rows === 3 && set.rowSizes[cell.row] === null;
  if (!tileX && !tileY) return null;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${cell.vb}" preserveAspectRatio="none">${cell.markup}</svg>`;
  return {
    backgroundImage: `url("data:image/svg+xml,${encodeURIComponent(svg)}")`,
    backgroundSize: `${tileX ? scaled(cell.w, caps) : '100%'} ${tileY ? scaled(cell.h, caps) : '100%'}`,
    backgroundRepeat: `${tileX ? cell.repeat : 'no-repeat'} ${tileY ? cell.repeat : 'no-repeat'}`,
    backgroundPosition: 'center',
  };
}

export default function SliceGrid({
  set,
  className,
  style,
}: {
  set: SliceSet;
  className?: string;
  style?: CSSProperties;
}) {
  const caps: CapSums = { x: sum(set.colSizes), y: sum(set.rowSizes) };
  return (
    <div
      className={className}
      aria-hidden="true"
      // Positioning/sizing stays the caller's business (class or style);
      // adding e.g. an inline position here would override their class.
      style={{ containerType: 'size', ...style }}
    >
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: tracks(set.colSizes, caps),
          gridTemplateRows: tracks(set.rowSizes, caps),
        }}
      >
        {set.cells.map((cell) => {
          const placement: CSSProperties = {
            minWidth: 0,
            minHeight: 0,
            gridColumn: cell.col + 1,
            gridRow: cell.row + 1,
          };
          const tiled = tileStyle(cell, set, caps);
          return tiled ? (
            <div key={`${cell.col}_${cell.row}`} style={{ ...placement, ...tiled }} />
          ) : (
            <svg
              key={`${cell.col}_${cell.row}`}
              viewBox={cell.vb}
              preserveAspectRatio={cell.par}
              style={{ display: 'block', width: '100%', height: '100%', ...placement }}
              dangerouslySetInnerHTML={{ __html: cell.markup }}
            />
          );
        })}
      </div>
    </div>
  );
}
