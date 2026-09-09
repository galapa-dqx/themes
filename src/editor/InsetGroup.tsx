/**
 * One inset box as 1, 2, or 4 joined fields, CSS-shorthand style, with
 * side icons and a Figma-style scrub. Shared by the nine-slice editor and the
 * control editor's thickness / padding rows.
 */
import { useRef, useState, type ReactNode } from 'react';
import { ActionIcon, Group, Stack } from '@mantine/core';
import {
  IconLayoutColumns,
  IconLayoutGrid,
  IconSquare,
} from '@tabler/icons-react';
import { SIDES, type Box, type Side } from './nineSlice';

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
export function InsetGroup({
  label,
  color,
  value,
  onChange,
  children,
}: {
  /** Header row above the fields; omitted when the row's label lives elsewhere. */
  label?: string;
  color?: string;
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
      {label && (
        <Group gap={6} fz={12} fw={600}>
          <span
            style={{ width: 8, height: 8, borderRadius: 2, background: color }}
          />
          {label}
        </Group>
      )}
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
                aria-label={`${label ?? 'Inset'} ${sides.join(' ')}`}
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
