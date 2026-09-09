/**
 * The tab specimen: main's PartSpecimen:137-149 — `<TabBar items=[Launcher,
 * Settings]>` in a 34px row — one tab per forced state, laid out like main's
 * `.TabBar` (`padding: 0 10px`, `min-width: 87px`, stretched to the row).
 *
 * The row is painted like the strip the tabs actually sit in (TitleBar's
 * centre column) instead of main's bare island, because the whole control is
 * a transparent box whose only paint is a bottom border: on the window fill
 * the selected underline reads against the wrong ground.
 */
import { Frame } from '@/editor/preview/Frame';
import type {
  ControlView,
  FocusRingView,
  Four,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useView } from '@/editor/preview/useView';

const thickness = (t: Four) =>
  (t.every((v) => v === t[0]) ? [t[0]] : t).join(' ');

/** Label ink and the underline: the two things a tab's states move. */
const summary = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  if (f.shape === 'asset') return f.asset ?? 'no asset';
  const text =
    view.parts.text?.kind === 'text' ? view.parts.text.text : undefined;
  return [
    text?.color ?? 'no ink',
    f.border.color !== 'none' && f.border.thickness.some(Boolean)
      ? `${thickness(f.border.thickness)}px ${f.border.color}`
      : 'no stroke',
    f.fill !== 'none' ? f.fill : undefined,
    f.opacity !== 1 ? `α ${f.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

export function TabSpecimen({
  view,
  ring,
}: {
  view: ControlView;
  ring: FocusRingView;
}) {
  const bar = useView('titlebar', 'default');
  // ponytail: an asset titlebar leaves the strip transparent (the island's
  // window fill); no first-party theme has one, and it is only the backdrop.
  const host =
    bar.kind === 'frame' && bar.frame.shape === 'path' ? bar.frame : undefined;
  if (view.kind !== 'frame') return null;
  const text =
    view.parts.text?.kind === 'text' ? view.parts.text.text : undefined;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        width: '100%',
        minWidth: 0,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'stretch',
          gap: 5,
          height: 34,
          padding: '0 10px',
          minWidth: 0,
          background: host && host.fill !== 'none' ? host.fill : 'transparent',
          // main draws the titlebar's stroke on a frame behind its content, so
          // it costs no height and the tab's underline paints over it.
          boxShadow:
            host && host.border.color !== 'none'
              ? `inset 0 -${host.border.thickness[2]}px 0 ${host.border.color}`
              : undefined,
        }}
      >
        <Frame
          view={view.frame}
          ring={view.showRing ? ring : undefined}
          style={{ minWidth: 87, justifyContent: 'center' }}
        >
          {text && <TextPart view={text}>Launcher</TextPart>}
        </Frame>
      </div>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'var(--mantine-color-dimmed)',
          wordBreak: 'break-all',
        }}
      >
        {summary(view)}
      </span>
    </div>
  );
}
