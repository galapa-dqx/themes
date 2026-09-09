/**
 * The tab-row specimen shared by `tab` and `subtab` — on main they are the
 * same component (`TabBar`, `size="sm"` for subtabs), so they get the same
 * specimen: one tab forced into the cell's state, laid out like main's
 * `.TabBar` (`padding: 0 10px`, gap 5, stretched to the strip), inside the
 * strip the tabs actually sit in rather than the bare island — the whole
 * control is a transparent box whose only paint is a bottom border, and on
 * the window fill the selected underline reads against the wrong ground.
 */
import type { ReactNode } from 'react';
import type { RootControlId } from '@/theme/catalog';
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

/**
 * main's `.TabBar` row inside the strip control it sits in: gap 5, its own
 * 10px gutters, the hints centred and the tabs stretched (`.Tabs`).
 */
export function Strip({
  host,
  stroke,
  children,
}: {
  /** The strip control painted behind the tabs. */
  host: RootControlId;
  /**
   * How the strip's bottom stroke is drawn on main: `inset` when a frame
   * behind the content paints it (TitleBar), so it costs no height and the
   * tab's underline covers it; `border` when the strip's own CSS does
   * (`.SubTabs`), which eats a row of the border-box.
   */
  stroke: 'inset' | 'border';
  children: ReactNode;
}) {
  const h = useView(host, 'default');
  // ponytail: an asset strip stays transparent (the island's window fill); no
  // first-party theme has one, and it is only the backdrop.
  const strip =
    h.kind === 'frame' && h.frame.shape === 'path' ? h.frame : undefined;
  const line =
    strip && strip.border.color !== 'none'
      ? `${strip.border.thickness[2]}px solid ${strip.border.color}`
      : undefined;
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 5,
        height: strip?.size?.height ?? 34,
        padding: '0 10px',
        minWidth: 0,
        background: strip && strip.fill !== 'none' ? strip.fill : 'transparent',
        borderBottom: stroke === 'border' ? line : undefined,
        boxShadow:
          stroke === 'inset' && strip && strip.border.color !== 'none'
            ? `inset 0 -${strip.border.thickness[2]}px 0 ${strip.border.color}`
            : undefined,
      }}
    >
      {children}
    </div>
  );
}

/** main's `.Tabs`: the pills, stretched to the strip. */
export function Tabs({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'stretch',
        gap: 5,
        height: '100%',
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

export function TabStrip({
  view,
  ring,
  host,
  stroke,
  label,
  minWidth,
}: {
  view: ControlView;
  ring: FocusRingView;
  host: RootControlId;
  stroke: 'inset' | 'border';
  minWidth: number;
  label: string;
}) {
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
      <Strip host={host} stroke={stroke}>
        <Tabs>
          <Frame
            view={view.frame}
            ring={view.showRing ? ring : undefined}
            style={{ minWidth, justifyContent: 'center' }}
          >
            {text && <TextPart view={text}>{label}</TextPart>}
          </Frame>
        </Tabs>
      </Strip>
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
