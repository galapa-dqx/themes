import { useMemo, useRef } from 'react';
import { cellRects, type SlicerDoc } from './doc';
import styles from '../Studio.module.css';

export type CellSel = { col: number; row: number };

/** Overlay colours (studio chrome: hardcoded, never themed). */
const CUT = '#7cc4ff';
const FRAME = '#ffd43b';
const CONTENT = '#86e29b';

type Pt = { x: number; y: number };
type DragMove = (p: Pt) => void;

const snap = (v: number) => Math.round(v * 2) / 2;
const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

/**
 * Interactive slicing canvas: renders the source artwork with the cut lines
 * (dotted, blue), the layout frame (amber) and the content box (green) as
 * draggable overlays, plus click-to-select cell hit areas.
 */
export default function SlicerCanvas({
  doc,
  viewBox,
  art,
  selection,
  onSelect,
  onChange,
}: {
  doc: SlicerDoc;
  viewBox: [number, number, number, number];
  /** Inner markup of the source svg, tokens already resolved for display. */
  art: string;
  selection: CellSel | null;
  onSelect: (sel: CellSel | null) => void;
  onChange: (doc: SlicerDoc) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<DragMove | null>(null);

  const [minX, minY, w, h] = viewBox;
  const pad = Math.max(w, h) * 0.09 + 2;
  const hs = Math.max(w, h) * 0.028; // handle half-size, art units

  const threeCols = doc.grid !== '1x3';
  const threeRows = doc.grid !== '3x1';
  const { bands, outset, content } = doc;

  const frame = {
    x: minX + outset.left,
    y: minY + outset.top,
    w: w - outset.left - outset.right,
    h: h - outset.top - outset.bottom,
  };
  const cbox = {
    x: frame.x + content.left,
    y: frame.y + content.top,
    w: frame.w - content.left - content.right,
    h: frame.h - content.top - content.bottom,
  };
  const hasOutset = Boolean(
    outset.top || outset.right || outset.bottom || outset.left,
  );
  const cells = useMemo(() => cellRects(doc, w, h), [doc, w, h]);

  const toSvg = (e: React.PointerEvent): Pt => {
    const m = svgRef.current?.getScreenCTM();
    if (!m) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
    return { x: p.x, y: p.y };
  };

  const start = (move: DragMove) => (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    dragRef.current = move;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  // Each drag writes exactly one field; the other fields it reads for
  // clamping can't change mid-drag, so closing over this render's doc is
  // safe even though dragRef holds the closure from the drag's start.
  const setBand = (side: keyof SlicerDoc['bands'], v: number) =>
    onChange({ ...doc, bands: { ...doc.bands, [side]: v } });
  const moveBand: Record<string, DragMove> = {
    left: ({ x }) =>
      setBand('left', clamp(snap(x - minX), 1, w - bands.right - 1)),
    right: ({ x }) =>
      setBand('right', clamp(snap(minX + w - x), 1, w - bands.left - 1)),
    top: ({ y }) =>
      setBand('top', clamp(snap(y - minY), 1, h - bands.bottom - 1)),
    bottom: ({ y }) =>
      setBand('bottom', clamp(snap(minY + h - y), 1, h - bands.top - 1)),
  };

  const setOutset = (side: keyof SlicerDoc['outset'], v: number) =>
    onChange({ ...doc, outset: { ...doc.outset, [side]: v } });
  const contentW = content.left + content.right;
  const contentH = content.top + content.bottom;
  const moveOutset: Record<string, DragMove> = {
    left: ({ x }) =>
      setOutset('left', clamp(snap(x - minX), 0, w - outset.right - contentW - 1)),
    right: ({ x }) =>
      setOutset('right', clamp(snap(minX + w - x), 0, w - outset.left - contentW - 1)),
    top: ({ y }) =>
      setOutset('top', clamp(snap(y - minY), 0, h - outset.bottom - contentH - 1)),
    bottom: ({ y }) =>
      setOutset('bottom', clamp(snap(minY + h - y), 0, h - outset.top - contentH - 1)),
  };

  const setContent = (side: keyof SlicerDoc['content'], v: number) =>
    onChange({ ...doc, content: { ...doc.content, [side]: v } });
  const moveContent: Record<string, DragMove> = {
    left: ({ x }) =>
      setContent('left', clamp(snap(x - frame.x), 0, frame.w - content.right)),
    right: ({ x }) =>
      setContent('right', clamp(snap(frame.x + frame.w - x), 0, frame.w - content.left)),
    top: ({ y }) =>
      setContent('top', clamp(snap(y - frame.y), 0, frame.h - content.bottom)),
    bottom: ({ y }) =>
      setContent('bottom', clamp(snap(frame.y + frame.h - y), 0, frame.h - content.top)),
  };

  const cutLine = (
    key: string,
    vertical: boolean,
    at: number,
    move: DragMove,
  ) => {
    const cursor = vertical ? 'ew-resize' : 'ns-resize';
    const a = vertical ? minY - pad * 0.5 : minX - pad * 0.5;
    const b = vertical ? minY + h + pad * 0.5 : minX + w + pad * 0.5;
    const [x1, y1, x2, y2] = vertical ? [at, a, at, b] : [a, at, b, at];
    return (
      <g key={key} style={{ cursor }}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={CUT}
          strokeWidth={1.2}
          strokeDasharray="4 4"
          vectorEffect="non-scaling-stroke"
          pointerEvents="none"
        />
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke="transparent"
          strokeWidth={10}
          vectorEffect="non-scaling-stroke"
          onPointerDown={start(move)}
        />
        <rect
          className={styles.Handle}
          x={(vertical ? at : x1) - hs}
          y={(vertical ? y1 : at) - hs}
          width={hs * 2}
          height={hs * 2}
          fill={CUT}
          onPointerDown={start(move)}
        />
      </g>
    );
  };

  const edgeHandle = (
    key: string,
    shape: 'diamond' | 'circle',
    color: string,
    cx: number,
    cy: number,
    vertical: boolean,
    move: DragMove,
  ) => {
    const cursor = vertical ? 'ew-resize' : 'ns-resize';
    return shape === 'circle' ? (
      <circle
        key={key}
        className={styles.Handle}
        cx={cx}
        cy={cy}
        r={hs * 0.75}
        fill={color}
        style={{ cursor }}
        onPointerDown={start(move)}
      />
    ) : (
      <rect
        key={key}
        className={styles.Handle}
        x={cx - hs * 0.7}
        y={cy - hs * 0.7}
        width={hs * 1.4}
        height={hs * 1.4}
        transform={`rotate(45 ${cx} ${cy})`}
        fill={color}
        style={{ cursor }}
        onPointerDown={start(move)}
      />
    );
  };

  return (
    <svg
      ref={svgRef}
      className={styles.CanvasSvg}
      viewBox={`${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`}
      preserveAspectRatio="xMidYMid meet"
      onPointerMove={(e) => {
        if (dragRef.current) {
          e.preventDefault();
          dragRef.current(toSvg(e));
        }
      }}
      onPointerUp={() => (dragRef.current = null)}
      onPointerCancel={() => (dragRef.current = null)}
    >
      {/* Click-away target */}
      <rect
        x={minX - pad}
        y={minY - pad}
        width={w + pad * 2}
        height={h + pad * 2}
        fill="transparent"
        onPointerDown={() => onSelect(null)}
      />
      <g pointerEvents="none" dangerouslySetInnerHTML={{ __html: art }} />
      {hasOutset && (
        <path
          d={`M${minX} ${minY}h${w}v${h}h${-w}Z M${frame.x} ${frame.y}h${frame.w}v${frame.h}h${-frame.w}Z`}
          fill="rgb(0 0 0 / 30%)"
          fillRule="evenodd"
          pointerEvents="none"
        />
      )}
      {cells.map((cell) => {
        const sel =
          selection && selection.col === cell.col && selection.row === cell.row;
        return (
          <rect
            key={`${cell.col}_${cell.row}`}
            x={minX + cell.x}
            y={minY + cell.y}
            width={cell.w}
            height={cell.h}
            fill={sel ? 'rgb(124 196 255 / 16%)' : 'transparent'}
            stroke={sel ? CUT : 'none'}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            style={{ cursor: 'pointer' }}
            onPointerDown={(e) => {
              e.stopPropagation();
              onSelect({ col: cell.col, row: cell.row });
            }}
          />
        );
      })}
      {threeCols && cutLine('cut-l', true, minX + bands.left, moveBand.left)}
      {threeCols && cutLine('cut-r', true, minX + w - bands.right, moveBand.right)}
      {threeRows && cutLine('cut-t', false, minY + bands.top, moveBand.top)}
      {threeRows && cutLine('cut-b', false, minY + h - bands.bottom, moveBand.bottom)}

      <rect
        x={frame.x}
        y={frame.y}
        width={frame.w}
        height={frame.h}
        fill="none"
        stroke={FRAME}
        strokeWidth={1.2}
        strokeDasharray="7 3"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {edgeHandle('fr-l', 'diamond', FRAME, frame.x, frame.y + frame.h / 2, true, moveOutset.left)}
      {edgeHandle('fr-r', 'diamond', FRAME, frame.x + frame.w, frame.y + frame.h / 2, true, moveOutset.right)}
      {edgeHandle('fr-t', 'diamond', FRAME, frame.x + frame.w / 2, frame.y, false, moveOutset.top)}
      {edgeHandle('fr-b', 'diamond', FRAME, frame.x + frame.w / 2, frame.y + frame.h, false, moveOutset.bottom)}

      <rect
        x={cbox.x}
        y={cbox.y}
        width={cbox.w}
        height={cbox.h}
        fill="none"
        stroke={CONTENT}
        strokeWidth={1.2}
        strokeDasharray="3 3"
        vectorEffect="non-scaling-stroke"
        pointerEvents="none"
      />
      {edgeHandle('ct-l', 'circle', CONTENT, cbox.x, cbox.y + cbox.h / 2, true, moveContent.left)}
      {edgeHandle('ct-r', 'circle', CONTENT, cbox.x + cbox.w, cbox.y + cbox.h / 2, true, moveContent.right)}
      {edgeHandle('ct-t', 'circle', CONTENT, cbox.x + cbox.w / 2, cbox.y, false, moveContent.top)}
      {edgeHandle('ct-b', 'circle', CONTENT, cbox.x + cbox.w / 2, cbox.y + cbox.h, false, moveContent.bottom)}
    </svg>
  );
}
