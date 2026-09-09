/**
 * The progress specimen: main's PartSpecimen:185-193 — a determinate bar and
 * an indeterminate one, stacked 12px apart across the island's full width
 * ("a progress bar is only itself once it can stretch", Studio.module.css).
 *
 * Geometry is `ProgressBar.module.css` verbatim: the track is a full-width
 * flex row at its own height with `align-items: stretch`, and the indicator a
 * flow child (`flex: none`) whose width is the only thing the app owns — so
 * the track's padding insets it on every side and the stroke, being a layer
 * behind the host, costs it nothing.
 *
 * The determinate value is the scrubber's, not main's fixed 62%: it is the
 * one interactive thing this control has, and small widths are where an
 * indicator's radius and corner shape actually show.
 */
import { useState } from 'react';
import { Slider, Text } from '@mantine/core';
import { Frame } from '@/editor/preview/Frame';
import type {
  AssetView,
  ControlView,
  Four,
  PathView,
} from '@/editor/preview/resolve';
import type { RootControlId } from '@/theme/catalog';
import { useView } from '@/editor/preview/useView';
import styles from './progress.module.css';

const shorthand = ([t, r, b, l]: Four) =>
  (t === b && r === l ? (t === r ? [t] : [t, r]) : [t, r, b, l]).join(' ');

const summary = (f: PathView | AssetView) =>
  f.shape === 'asset'
    ? (f.asset ?? 'no asset')
    : [
        f.fill,
        f.border.color !== 'none' && f.border.thickness.some(Boolean)
          ? `${shorthand(f.border.thickness)}px ${f.border.color}`
          : undefined,
        `radius ${f.radius} ${f.corner}`,
        f.padding.some(Boolean) ? `pad ${shorthand(f.padding)}` : undefined,
        f.opacity !== 1 ? `α ${f.opacity}` : undefined,
      ]
        .filter(Boolean)
        .join(' · ');

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

function Bar({
  track,
  indicator,
  percent,
}: {
  track: PathView | AssetView;
  indicator: PathView | AssetView;
  /** Omit for the indeterminate sweep. */
  percent?: number;
}) {
  return (
    <Frame
      view={track}
      role="progressbar"
      aria-valuenow={percent}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuetext={percent === undefined ? undefined : `${percent}%`}
      style={{ display: 'flex', alignItems: 'stretch', width: '100%' }}
    >
      <Frame
        view={indicator}
        className={percent === undefined ? styles.Sweep : styles.Bar}
        style={{
          flex: 'none',
          width: percent === undefined ? undefined : `${percent}%`,
        }}
      />
    </Frame>
  );
}

export function ProgressSpecimen({ view }: { view: ControlView }) {
  const [percent, setPercent] = useState(62);
  const track = view.parts.track;
  const indicator = view.parts.indicator;
  if (track?.kind !== 'frame' || indicator?.kind !== 'frame') return null;
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <Bar track={track.frame} indicator={indicator.frame} percent={percent} />
      <Bar track={track.frame} indicator={indicator.frame} />
      <Slider
        size="xs"
        value={percent}
        onChange={setPercent}
        label={(v) => `${v}%`}
      />
      <span style={mono}>track {summary(track.frame)}</span>
      <span style={mono}>indicator {summary(indicator.frame)}</span>
    </div>
  );
}

/**
 * The √2 lore from main's `types.ts` L277-288, which authors could only find
 * by reading source: a chamfer eats the corner diagonally, so an even-looking
 * gap needs the sides padded by the diagonal, not the height.
 */
export function ProgressFields({ id }: { id: RootControlId }) {
  const view = useView(id, 'default');
  const track = view.parts.track;
  if (track?.kind !== 'frame' || track.frame.shape !== 'path') return null;
  const { corner, padding } = track.frame;
  if (corner !== 'bevel') return null;
  const [top, right] = padding;
  return (
    <Text fz={12} c="dimmed">
      Bevel corners: side padding ×1.41 ({top} → {Math.round(top * 141.4) / 100}
      ) keeps the gap even across the chamfer
      {Math.abs(right - top * Math.SQRT2) < 0.05
        ? ' — this track already does'
        : ''}
      .
    </Text>
  );
}
