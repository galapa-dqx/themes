import { useState, type ReactNode } from 'react';
import { Tooltip } from '@mantine/core';
import { SIDES, type Edges, type Side } from '@/theme';
import styles from './EdgeInput.module.css';

/** How many boxes the control is showing: one, block+inline, or all four. */
type Mode = 1 | 2 | 4;

const MODES: Mode[] = [1, 2, 4];

const asEdges = (v: number | Edges | undefined): Edges =>
  v === undefined ? [0, 0, 0, 0] : typeof v === 'number' ? [v, v, v, v] : v;

/** The narrowest shape that still round-trips these four values. */
function modeOf(value: number | Edges | undefined): Mode {
  if (value === undefined || typeof value === 'number') return 1;
  const [t, r, b, l] = value;
  if (t === b && r === l) return t === r ? 1 : 2;
  return 4;
}

/**
 * A CSS-shorthand-shaped edge editor: one control that toggles between a
 * single value, block+inline, and all four sides, without changing width.
 *
 * Collapsing is lossy by nature, so it keeps the first value of each group —
 * four to two keeps top and right, two to one keeps block — which is exactly
 * the value CSS would have expanded back out anyway when the sides already
 * matched.
 *
 * `sides` pins the control to a specific subset (the slicer's bands only have
 * meaningful left/right on a 3×1 grid); the mode toggle is hidden then, since
 * there's nothing to collapse to.
 */
export default function EdgeInput({
  label,
  value,
  onChange,
  sides,
  min = 0,
  disabled = false,
  width,
  hint,
}: {
  label: string;
  value: number | Edges | undefined;
  onChange: (next: number | Edges | undefined) => void;
  /** Restrict to these sides; omit for the 1 / 2 / 4 toggle. */
  sides?: readonly Side[];
  min?: number;
  /** Fixed width; omit to fill the container. */
  disabled?: boolean;
  width?: number;
  hint?: ReactNode;
}) {
  const [mode, setMode] = useState<Mode>(() => modeOf(value));
  const edges = asEdges(value);
  const blank = value === undefined;

  // Which boxes are on screen, and which sides each one writes to.
  const groups: { key: string; label: string; sides: Side[] }[] = sides
    ? sides.map((side) => ({ key: side, label: side, sides: [side] }))
    : mode === 1
      ? [{ key: 'all', label: 'all sides', sides: [...SIDES] }]
      : mode === 2
        ? [
            { key: 'block', label: 'top and bottom', sides: ['top', 'bottom'] },
            { key: 'inline', label: 'left and right', sides: ['right', 'left'] },
          ]
        : SIDES.map((side) => ({ key: side, label: side, sides: [side] }));

  const write = (target: Side[], raw: string) => {
    if (raw.trim() === '') {
      // Clearing every box is how you say "no opinion"; the part then falls
      // back to whatever padding the component's own layout wants.
      if (groups.length === 1) return onChange(undefined);
    }
    const n = Number(raw);
    if (raw.trim() === '' || Number.isNaN(n)) return;
    const next = [...edges] as Edges;
    for (const side of target) next[SIDES.indexOf(side)] = Math.max(min, n);
    const [t, r, b, l] = next;
    onChange(!sides && modeOf(next) === 1 && mode === 1 ? t : [t, r, b, l]);
  };

  const cycle = () => {
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    setMode(next);
    if (blank) return;
    const [t, r, b, l] = edges;
    if (next === 1) onChange(t);
    else if (next === 2) onChange([t, r, t, r]);
    else onChange([t, r, b, l]);
  };

  return (
    <div className={styles.Field} style={{ width }}>
      <span className={styles.Label}>{label}</span>
      <div className={styles.Controls}>
        <div className={styles.Boxes} data-disabled={disabled || undefined}>
          {groups.map((group) => (
            <Tooltip key={group.key} label={group.label} openDelay={400} withArrow>
              <input
                className={styles.Box}
                type="text"
                inputMode="numeric"
                aria-label={`${label}, ${group.label}`}
                value={blank ? '' : String(edges[SIDES.indexOf(group.sides[0])])}
                placeholder="–"
                disabled={disabled}
                onChange={(e) => write(group.sides, e.target.value)}
              />
            </Tooltip>
          ))}
        </div>
        {!sides && (
          <Tooltip label="One value / block+inline / four sides" withArrow>
            <button
              type="button"
              className={styles.Cycle}
              aria-label={`Cycle ${label} between one, two and four values`}
              disabled={disabled}
              onClick={cycle}
            >
              {mode === 1 ? '□' : mode === 2 ? '▤' : '⊞'}
            </button>
          </Tooltip>
        )}
      </div>
      {hint && <span className={styles.Hint}>{hint}</span>}
    </div>
  );
}
