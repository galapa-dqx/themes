/**
 * The button specimen: main's PartSpecimen:92-98 — one `<Button>Play</Button>`
 * in the island row. main's Button.module.css adds nothing to `<Themed>` but
 * inline-flex layout, `line-height: 1` and the cursor, and V2 carries the line
 * height in the text part's typography, so `Frame` + `TextPart` already *are*
 * the button; this only supplies main's element, its label and a caption.
 *
 * Every tile is `disabled`: the grid forces one state per tile with inline
 * styles, so a live button's own hover/focus would contradict its caption.
 */
import { Frame } from '@/editor/preview/Frame';
import type {
  ControlView,
  FocusRingView,
  Four,
  StateName,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';

const thickness = (t: Four) =>
  (t.every((v) => v === t[0]) ? [t[0]] : t).join(' ');

/** The paint of one forced state — hover and pressed are mixes with nowhere else to read them. */
const paint = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  if (f.shape === 'asset') return f.asset ?? 'no asset';
  return [
    f.fill,
    f.border.color !== 'none' && f.border.thickness.some(Boolean)
      ? `${thickness(f.border.thickness)}px ${f.border.color}`
      : undefined,
    f.opacity !== 1 ? `α ${f.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

export function ButtonSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  if (view.kind !== 'frame') return null;
  const label =
    view.parts.text?.kind === 'text' ? view.parts.text.text : undefined;
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
        view={view.frame}
        ring={view.showRing ? ring : undefined}
        style={{
          justifyContent: 'center',
          cursor: state === 'disabled' ? 'default' : 'pointer',
        }}
      >
        {label && <TextPart view={label}>Play</TextPart>}
      </Frame>
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'var(--mantine-color-dimmed)',
          wordBreak: 'break-all',
        }}
      >
        {paint(view)}
      </span>
    </div>
  );
}
