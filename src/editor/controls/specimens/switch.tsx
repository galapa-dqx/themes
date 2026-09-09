/**
 * The switch specimen: main's PartSpecimen:99-106 — one `<Switch>` in the
 * island row, here one per forced state.
 *
 * Geometry is `Switch.module.css` verbatim: the track is the host at its own
 * fixed size, the thumb an absolutely placed box at `top: pad-t / left: pad-l`
 * sliding to `calc(100% - thumb-w - pad-l)` when checked. The stroke is
 * painted by the out-of-flow surface and the host carries no CSS border, so
 * those offsets measure from the track's own box — 13 in 34 × 17 at padding 2
 * sits the thumb at (2, 2) and (19, 2), with 2px of track showing all round.
 *
 * Every part is resolved at the cell's state, so a forced hover moves the
 * thumb's paint too; on main only `disabled` (track) and `checked` (thumb)
 * are prop states, but no first-party theme overrides the other part, so the
 * rendered result is the same.
 */
import { Text } from '@mantine/core';
import { Frame } from '@/editor/preview/Frame';
import { useView } from '@/editor/preview/useView';
import type {
  AssetView,
  ControlView,
  FocusRingView,
  Four,
  PathView,
  StateName,
} from '@/editor/preview/resolve';

const thickness = (t: Four) =>
  (t.every((v) => v === t[0]) ? [t[0]] : t).join(' ');

/** What a state actually moves: the two fills, the stroke and the dimming. */
const paint = (f: PathView | AssetView) =>
  f.shape === 'asset'
    ? (f.asset ?? 'no asset')
    : [
        f.fill,
        f.border.color !== 'none' && f.border.thickness.some(Boolean)
          ? `${thickness(f.border.thickness)}px ${f.border.color}`
          : undefined,
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

export function SwitchSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  if (track?.kind !== 'frame' || thumb?.kind !== 'frame') return null;
  const t = track.frame;
  const k = thumb.frame;
  const on = state === 'checked';
  // ponytail: an asset track seats the thumb at its own edge — main reads
  // `--g-switch-track-pad-*`, which an asset control never emits.
  const [padT, , , padL] = t.shape === 'path' ? t.padding : [0, 0, 0, 0];
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 6,
        minWidth: 0,
      }}
    >
      <Frame
        as="button"
        type="button"
        disabled
        role="switch"
        aria-checked={on}
        view={t}
        ring={track.showRing ? ring : undefined}
        style={{
          flex: 'none',
          cursor: state === 'disabled' ? 'default' : 'pointer',
        }}
      >
        <Frame
          view={k}
          style={{
            position: 'absolute',
            top: padT,
            left: on
              ? `calc(100% - ${k.size?.width ?? 0}px - ${padL}px)`
              : padL,
          }}
        />
      </Frame>
      <span style={mono}>track {paint(t)}</span>
      <span style={mono}>thumb {paint(k)}</span>
    </div>
  );
}

/**
 * The one thing two independent Size rows can't tell you: where the thumb
 * ends up. Sizes and padding are separate fields on separate cards, and the
 * travel between them is what a theme actually gets wrong.
 */
export function SwitchFields() {
  const view = useView('switch', 'default');
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  if (track?.kind !== 'frame' || thumb?.kind !== 'frame') return null;
  const t = track.frame;
  const k = thumb.frame;
  if (t.shape !== 'path') return null;
  const [padT, , , padL] = t.padding;
  const w = t.size?.width ?? 0;
  const h = t.size?.height ?? 0;
  const kw = k.size?.width ?? 0;
  const kh = k.size?.height ?? 0;
  // The stroke is painted out of flow and the host has no CSS border, so the
  // thumb's containing block is the track's box: the offsets are the padding.
  const off = padL;
  const on = w - kw - padL;
  const spill = padT + kh - h;
  return (
    <Text fz={12} c={spill > 0 || on < off ? 'orange.7' : 'dimmed'}>
      The {kw} × {kh} thumb slides {on - off} px inside the {w} × {h} track (x{' '}
      {off} → {on}).
      {spill > 0 && ` It hangs ${spill} px below the track.`}
      {on < off && ' It is too wide for the track to move it.'}
    </Text>
  );
}
