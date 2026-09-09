/**
 * The nine-slice editor from 4a/4i: artwork under draggable cut lines, the
 * layout frame, and the content box, plus the Slices / Content area /
 * Overdraw margin inset groups. Everything is in root viewBox units.
 */
import { useRef, useState, type PointerEvent, type ReactNode } from 'react';
import {
  ActionIcon,
  Group,
  NativeSelect,
  SegmentedControl,
  Stack,
  Text,
} from '@mantine/core';
import { useElementSize } from '@mantine/hooks';
import {
  IconLayoutColumns,
  IconLayoutGrid,
  IconSquare,
} from '@tabler/icons-react';
import {
  normalize,
  rects,
  REPEATS,
  SIDES,
  type Box,
  type Rect,
  type Repeat,
  type Side,
  type Slicing,
} from './nineSlice';

const BLUE = 'var(--mantine-color-blue-6)';
const TEAL = 'var(--mantine-color-teal-6)';
const ORANGE = 'var(--mantine-color-orange-6)';
const CHECKER =
  'repeating-conic-gradient(var(--mantine-color-gray-1) 0 25%, var(--mantine-color-gray-0) 0 50%) 0 0 / 16px 16px';
const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};
type Grp = 'slices' | 'overdraw' | 'content';

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(Math.max(v, lo), Math.max(lo, hi));

export function SliceEditor({
  art,
  viewBox,
  value,
  onChange,
  height,
}: {
  /** The unsliced artwork as SVG text, colors already baked. */
  art: string;
  viewBox: Rect;
  value: Slicing;
  onChange(next: Slicing): void;
  height: number;
}) {
  const { frame } = rects(viewBox, value);
  /** Sets sides of one group, pairing slice tracks so an axis is cut on both sides or neither. */
  const update = (group: Grp, entries: [Side, number][]) => {
    const base = group === 'content' ? frame : viewBox;
    const b: Box = { ...value[group] };
    for (const [side, raw] of entries) {
      const axis = side === 'left' || side === 'right' ? base[2] : base[3];
      // When both sides of an axis move together, each gets half the room.
      const max = entries.some(([o]) => o === OPPOSITE[side])
        ? Math.floor((axis - 1) / 2)
        : axis - 1 - b[OPPOSITE[side]];
      const v = clamp(Math.round(raw), 0, max);
      b[side] = v;
      if (group === 'slices') {
        if (v === 0) b[OPPOSITE[side]] = 0;
        else if (b[OPPOSITE[side]] === 0) b[OPPOSITE[side]] = v;
      }
    }
    onChange(normalize({ ...value, [group]: b }, viewBox));
  };
  const group = (g: Grp) => (sides: Side[], v: number) =>
    update(
      g,
      sides.map((s) => [s, v]),
    );
  return (
    <Stack gap={12}>
      <Canvas
        art={art}
        viewBox={viewBox}
        value={value}
        update={update}
        height={height}
      />
      <Group gap={12} fz={11}>
        {(
          [
            ['Slices', BLUE],
            ['Content', TEAL],
            ['Overdraw', ORANGE],
          ] as const
        ).map(([label, color]) => (
          <Group key={label} gap={5}>
            <span
              style={{
                width: 12,
                height: 3,
                background: color,
                borderRadius: 2,
              }}
            />
            {label}
          </Group>
        ))}
      </Group>
      <InsetGroup
        label="Slices"
        color={BLUE}
        value={value.slices}
        onChange={group('slices')}
      >
        <Group gap={6}>
          <Text fz={11} c="dimmed">
            Center fill
          </Text>
          <NativeSelect
            size="xs"
            w={90}
            data={REPEATS}
            value={value.repeat}
            onChange={(e) =>
              onChange({ ...value, repeat: e.currentTarget.value as Repeat })
            }
          />
        </Group>
      </InsetGroup>
      <InsetGroup
        label="Content area"
        color={TEAL}
        value={value.content}
        onChange={group('content')}
      />
      <InsetGroup
        label="Overdraw margin"
        color={ORANGE}
        value={value.overdraw}
        onChange={group('overdraw')}
      />
    </Stack>
  );
}

function Canvas({
  art,
  viewBox,
  value,
  update,
  height,
}: {
  art: string;
  viewBox: Rect;
  value: Slicing;
  update(group: Grp, entries: [Side, number][]): void;
  height: number;
}) {
  const { ref, width, height: ch } = useElementSize();
  const [zoom, setZoom] = useState(1);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<(p: DOMPoint) => void>(undefined);
  const [x, y, w, h] = viewBox;
  const pad = Math.max(w, h) * 0.08 + 1;
  const scale = zoom * Math.min(width / (w + pad * 2), ch / (h + pad * 2)) || 1;
  /** Screen pixels → viewBox units, so chrome keeps its size at any zoom. */
  const px = (n: number) => n / scale;
  const { frame, content } = rects(viewBox, value);
  const s = value.slices;
  const cols = s.left > 0 && s.right > 0;
  const rows = s.top > 0 && s.bottom > 0;

  const toUnits = (e: PointerEvent) =>
    new DOMPoint(e.clientX, e.clientY).matrixTransform(
      svgRef.current!.getScreenCTM()!.inverse(),
    );
  const start = (move: (p: DOMPoint) => void) => (e: PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    drag.current = move;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };
  /** Distance from `base`'s edge on `side` to the pointer. */
  const inset = (base: Rect, side: Side, p: DOMPoint) =>
    side === 'left'
      ? p.x - base[0]
      : side === 'right'
        ? base[0] + base[2] - p.x
        : side === 'top'
          ? p.y - base[1]
          : base[1] + base[3] - p.y;
  const mover = (group: Grp, sides: Side[]) => (p: DOMPoint) =>
    update(
      group,
      sides.map((side) => [
        side,
        inset(group === 'content' ? frame : viewBox, side, p),
      ]),
    );

  /** A draggable edge: the visible line is drawn by the caller; this is the hit area. */
  const hit = (
    key: string,
    [x1, y1, x2, y2]: Rect,
    cursor: string,
    move: (p: DOMPoint) => void,
  ) => (
    <line
      key={key}
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
      stroke="transparent"
      strokeWidth={px(10)}
      style={{ cursor }}
      onPointerDown={start(move)}
    />
  );
  const edges = (group: Grp, [rx, ry, rw, rh]: Rect) =>
    SIDES.map((side) =>
      hit(
        `${group}-${side}`,
        side === 'top'
          ? [rx, ry, rx + rw, ry]
          : side === 'bottom'
            ? [rx, ry + rh, rx + rw, ry + rh]
            : side === 'left'
              ? [rx, ry, rx, ry + rh]
              : [rx + rw, ry, rx + rw, ry + rh],
        side === 'top' || side === 'bottom' ? 'ns-resize' : 'ew-resize',
        mover(group, [side]),
      ),
    );
  const label = (text: string, lx: number, ly: number, color: string) => (
    <text
      x={lx}
      y={ly}
      fontSize={px(10)}
      fontWeight={600}
      fill={color}
      stroke="var(--mantine-color-body)"
      strokeWidth={px(3)}
      paintOrder="stroke"
      style={{ pointerEvents: 'none' }}
    >
      {text}
    </text>
  );
  const dash = `${px(4)} ${px(4)}`;
  const cut = (vertical: boolean, at: number) => (
    <line
      key={`${vertical ? 'v' : 'h'}${at}`}
      x1={vertical ? at : x - pad}
      y1={vertical ? y - pad : at}
      x2={vertical ? at : x + w + pad}
      y2={vertical ? y + h + pad : at}
      stroke={BLUE}
      strokeWidth={px(1)}
      strokeDasharray={dash}
      style={{ pointerEvents: 'none' }}
    />
  );
  const xl = x + s.left;
  const xr = x + w - s.right;
  const yt = y + s.top;
  const yb = y + h - s.bottom;
  const o = value.overdraw;
  const hasOverdraw = o.top || o.right || o.bottom || o.left;

  return (
    <div style={{ position: 'relative', height }}>
      <div
        ref={ref}
        style={{
          height: '100%',
          overflow: 'auto',
          background: CHECKER,
          border: '1px solid var(--mantine-color-default-border)',
          borderRadius: 'var(--mantine-radius-sm)',
        }}
      >
        <svg
          ref={svgRef}
          viewBox={`${x - pad} ${y - pad} ${w + pad * 2} ${h + pad * 2}`}
          style={{
            display: 'block',
            width: `${zoom * 100}%`,
            height: `${zoom * 100}%`,
            touchAction: 'none',
          }}
          onPointerMove={(e) => drag.current?.(toUnits(e))}
          onPointerUp={() => (drag.current = undefined)}
          onPointerCancel={() => (drag.current = undefined)}
        >
          <image
            href={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(art)}`}
            x={x}
            y={y}
            width={w}
            height={h}
          />
          {/* Overdraw: the frame inside the artwork. */}
          <rect
            x={frame[0]}
            y={frame[1]}
            width={frame[2]}
            height={frame[3]}
            fill="none"
            stroke={ORANGE}
            strokeWidth={px(1)}
            strokeDasharray={dash}
            style={{ pointerEvents: 'none' }}
          />
          {hasOverdraw
            ? label(
                `overdraw ${o.top === o.right && o.top === o.bottom && o.top === o.left ? o.top : `${o.top} · ${o.right} · ${o.bottom} · ${o.left}`}`,
                frame[0],
                frame[1] - px(5),
                'var(--mantine-color-orange-7)',
              )
            : null}
          {/* Slices */}
          {cols && [cut(true, xl), cut(true, xr)]}
          {rows && [cut(false, yt), cut(false, yb)]}
          {/* Content */}
          <rect
            x={content[0]}
            y={content[1]}
            width={content[2]}
            height={content[3]}
            fill="rgba(18,184,134,.08)"
            stroke={TEAL}
            strokeWidth={px(2)}
            style={{ pointerEvents: 'none' }}
          />
          {label(
            `content ${value.content.top} · ${value.content.left}`,
            content[0],
            content[1] + content[3] + px(12),
            'var(--mantine-color-teal-8)',
          )}
          {/* Hit areas, innermost last so it wins overlaps. */}
          {cols && [
            hit(
              'cut-l',
              [xl, y - pad, xl, y + h + pad],
              'ew-resize',
              mover('slices', ['left']),
            ),
            hit(
              'cut-r',
              [xr, y - pad, xr, y + h + pad],
              'ew-resize',
              mover('slices', ['right']),
            ),
          ]}
          {rows && [
            hit(
              'cut-t',
              [x - pad, yt, x + w + pad, yt],
              'ns-resize',
              mover('slices', ['top']),
            ),
            hit(
              'cut-b',
              [x - pad, yb, x + w + pad, yb],
              'ns-resize',
              mover('slices', ['bottom']),
            ),
          ]}
          {edges('overdraw', frame)}
          {edges('content', content)}
          {cols &&
            rows &&
            (
              [
                [xl, yt, ['left', 'top']],
                [xr, yb, ['right', 'bottom']],
              ] as const
            ).map(([cx, cy, sides]) => (
              <circle
                key={sides.join()}
                cx={cx}
                cy={cy}
                r={px(5)}
                fill="var(--mantine-color-body)"
                stroke={BLUE}
                strokeWidth={px(2)}
                style={{ cursor: 'move' }}
                onPointerDown={start(mover('slices', [...sides]))}
              />
            ))}
        </svg>
      </div>
      <SegmentedControl
        size="xs"
        value={String(zoom)}
        onChange={(v) => setZoom(Number(v))}
        data={[
          { value: '0.5', label: '50%' },
          { value: '1', label: '100%' },
          { value: '2', label: '200%' },
        ]}
        style={{ position: 'absolute', top: 6, right: 6 }}
        styles={{ label: { fontSize: 10, padding: '2px 6px' } }}
      />
    </div>
  );
}

const SideIcon = ({ sides }: { sides: Side[] }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" style={{ flex: 'none' }}>
    <rect
      x="1.5"
      y="1.5"
      width="9"
      height="9"
      fill="none"
      stroke="var(--mantine-color-gray-5)"
      strokeWidth="1"
      strokeDasharray="1.5 1.5"
    />
    <g
      stroke="var(--mantine-color-gray-7)"
      strokeWidth="2"
      strokeLinecap="round"
    >
      {sides.includes('top') && <line x1="1" y1="1.5" x2="11" y2="1.5" />}
      {sides.includes('right') && <line x1="10.5" y1="1" x2="10.5" y2="11" />}
      {sides.includes('bottom') && <line x1="1" y1="10.5" x2="11" y2="10.5" />}
      {sides.includes('left') && <line x1="1.5" y1="1" x2="1.5" y2="11" />}
    </g>
  </svg>
);

const FIELDS: Record<1 | 2 | 4, Side[][]> = {
  1: [SIDES],
  2: [
    ['top', 'bottom'],
    ['left', 'right'],
  ],
  4: SIDES.map((s) => [s]),
};
const TOGGLE = {
  4: { icon: IconLayoutGrid, title: 'Four values · click for one', next: 1 },
  1: { icon: IconSquare, title: 'One value · click for two', next: 2 },
  2: { icon: IconLayoutColumns, title: 'Two values · click for four', next: 4 },
} as const;

/** One inset box as 1, 2, or 4 joined fields, CSS-shorthand style. */
function InsetGroup({
  label,
  color,
  value,
  onChange,
  children,
}: {
  label: string;
  color: string;
  value: Box;
  onChange(sides: Side[], v: number): void;
  children?: ReactNode;
}) {
  // The chosen field count, widened whenever the values no longer fit it (e.g. after a corner drag).
  const [chosen, setCount] = useState<1 | 2 | 4>(1);
  const needed = SIDES.every((s) => value[s] === value.top)
    ? 1
    : value.top === value.bottom && value.left === value.right
      ? 2
      : 4;
  const count = Math.max(chosen, needed) as 1 | 2 | 4;
  const toggle = TOGGLE[count];
  const scrub = useRef<{ x: number; start: number }>(undefined);
  const commit = (sides: Side[], input: HTMLInputElement) => {
    const v = Number(input.value);
    if (Number.isFinite(v) && v !== value[sides[0]]) onChange(sides, v);
  };
  return (
    <Stack gap={6}>
      <Group gap={6} fz={12} fw={600}>
        <span
          style={{ width: 8, height: 8, borderRadius: 2, background: color }}
        />
        {label}
      </Group>
      <Group gap={6} wrap="nowrap">
        <div
          style={{
            display: 'flex',
            flex: 1,
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 4,
            overflow: 'hidden',
            background: 'var(--mantine-color-body)',
          }}
        >
          {FIELDS[count].map((sides, i) => (
            <label
              key={sides.join()}
              style={{
                flex: 1,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 6px',
                borderRight:
                  i < count - 1
                    ? '1px solid var(--mantine-color-default-border)'
                    : undefined,
                minWidth: 0,
              }}
            >
              {/* Figma-style scrub: drag the icon sideways to nudge the value. */}
              <span
                style={{
                  display: 'inline-flex',
                  cursor: 'ew-resize',
                  touchAction: 'none',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  scrub.current = { x: e.clientX, start: value[sides[0]] };
                  e.currentTarget.setPointerCapture(e.pointerId);
                }}
                onPointerMove={(e) => {
                  if (!scrub.current) return;
                  const v =
                    scrub.current.start +
                    Math.round(e.clientX - scrub.current.x);
                  if (v !== value[sides[0]]) onChange(sides, v);
                }}
                onPointerUp={() => (scrub.current = undefined)}
              >
                <SideIcon sides={sides} />
              </span>
              {/* Uncontrolled and re-keyed on the value: typing commits on blur/Enter, drags refresh it. */}
              <input
                key={value[sides[0]]}
                type="text"
                inputMode="numeric"
                aria-label={`${label} ${sides.join(' ')}`}
                defaultValue={value[sides[0]]}
                onBlur={(e) => commit(sides, e.currentTarget)}
                onKeyDown={(e) =>
                  e.key === 'Enter' && commit(sides, e.currentTarget)
                }
                style={{
                  width: '100%',
                  minWidth: 0,
                  border: 0,
                  outline: 0,
                  padding: 0,
                  background: 'transparent',
                  color: 'inherit',
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 11,
                }}
              />
            </label>
          ))}
        </div>
        <ActionIcon
          variant="default"
          size={28}
          title={toggle.title}
          aria-label={toggle.title}
          onClick={() => {
            if (count === 4) onChange(SIDES, value.top);
            setCount(toggle.next);
          }}
        >
          <toggle.icon size={13} />
        </ActionIcon>
      </Group>
      {children}
    </Stack>
  );
}
