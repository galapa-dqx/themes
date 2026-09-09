/**
 * The scrollbar specimen: main's PartSpecimen:172-184 — a 140px box holding a
 * `<ScrollPanel>` whose 400px child leaves the thumb 35% tall at the top.
 *
 * Geometry is `ScrollPanel.module.css` verbatim: a two-column grid,
 * `minmax(0,1fr)` of content then a track column of `--g-scrollbar-track-w`,
 * 8px apart; the track is the host and the thumb an absolutely placed box at
 * `left:0; right:0` with percentage `top`/`height`, so it is always exactly
 * the track's width — the thumb's own width var is emitted and never read.
 *
 * ponytail: the thumb is static (main's demo position: top 0, height 35%);
 * drag/scroll belongs to the live Preview page, not a forced-state cell.
 */
import { Text } from '@mantine/core';
import { Frame } from '@/editor/preview/Frame';
import type {
  AssetView,
  ControlView,
  Four,
  PathView,
  TextView,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useView } from '@/editor/preview/useView';

/** The catalog default for both parts; a project may omit `size`. */
const TRACK_W = 8;

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

export function ScrollbarSpecimen({ view }: { view: ControlView }) {
  const help = useView('setting-help', 'default');
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  if (track?.kind !== 'frame' || thumb?.kind !== 'frame') return null;
  const body =
    help.parts.body?.kind === 'text' ? help.parts.body.text : undefined;
  // Main's specimen text is the window's ambient ink; V2 has none, so the
  // scrolled copy brings the theme's own body ink instead.
  const copy: TextView = { opacity: 1, ...body, color: body?.color ?? '#888' };
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
      }}
    >
      <div
        style={{
          height: 140,
          display: 'grid',
          gridTemplateColumns: `minmax(0, 1fr) ${track.frame.size?.width ?? TRACK_W}px`,
          columnGap: 8,
        }}
      >
        <div style={{ minHeight: 0, overflow: 'hidden' }}>
          {/* Filler, not a themed part: main's div inherited the app's
              `normal` line height, not a control's own. */}
          <TextPart
            view={copy}
            style={{ display: 'block', padding: 8, lineHeight: 'normal' }}
          >
            The scrollbar lives on the right; drag or scroll to see the thumb
            move.
          </TextPart>
        </div>
        <Frame view={track.frame} style={{ width: 'auto' }}>
          <Frame
            view={thumb.frame}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              width: 'auto',
              top: 0,
              height: '35%',
            }}
          />
        </Frame>
      </div>
      <span style={mono}>track {summary(track.frame)}</span>
      <span style={mono}>thumb {summary(thumb.frame)}</span>
    </div>
  );
}

/**
 * The one thing the thumb's own Size row can't tell you: the app stretches
 * the thumb across the track column, so only the track's width is a width.
 */
export function ScrollbarFields() {
  const view = useView('scrollbar', 'default');
  const track = view.parts.track;
  const thumb = view.parts.thumb;
  if (track?.kind !== 'frame' || thumb?.kind !== 'frame') return null;
  const tw = track.frame.size?.width ?? TRACK_W;
  const kw = thumb.frame.size?.width ?? TRACK_W;
  return (
    <Text fz={12} c={kw === tw ? 'dimmed' : 'orange.7'}>
      The thumb is drawn across the {tw} px track column.
      {kw !== tw && ` Its own ${kw} px width has no effect.`}
    </Text>
  );
}
