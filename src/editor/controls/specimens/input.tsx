/**
 * The input specimen: main's PartSpecimen:41-51 — `<TextInput label="Username"
 * value="anlucialuvr69">` in the island — plus the launcher's second field
 * (Home.tsx 99-105) left empty, which is the only place the placeholder part
 * is ever visible. The `<input>` is a span: main's reset strips everything a
 * real one brings (background, border, outline) except the hard-coded line
 * height, and `::placeholder` cannot be styled inline anyway.
 */
import type { CSSProperties } from 'react';
import { Frame } from '@/editor/preview/Frame';
import type {
  ControlView,
  FocusRingView,
  Four,
  StateName,
  TextView,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';

/** ponytail: main's `.Input` hard-codes this (app CSS, not the theme); drop when the app honours the value part's own lineHeight. */
const LINE_HEIGHT = 1.5;
const NO_TEXT: TextView = { opacity: 1 };

const thickness = (t: Four) =>
  (t.every((v) => v === t[0]) ? [t[0]] : t).join(' ');

/** The stroke is what changes between states, and only its hex is unreadable. */
const summary = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  if (f.shape === 'asset') return f.asset ?? 'no asset';
  return [
    f.border.color !== 'none' && f.border.thickness.some(Boolean)
      ? `${thickness(f.border.thickness)}px ${f.border.color}`
      : 'no stroke',
    f.fill !== 'none' ? f.fill : undefined,
    f.opacity !== 1 ? `α ${f.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

export function InputSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  if (view.kind !== 'frame') return null;
  const text = (name: string): TextView | undefined => {
    const p = view.parts[name];
    return p?.kind === 'text' ? p.text : undefined;
  };
  const label = text('label');
  const caret =
    view.parts.caret?.kind === 'paint' ? view.parts.caret.paint : undefined;

  const field = (name: string, content: string, empty: boolean) => {
    const line = (empty ? text('placeholder') : text('value')) ?? NO_TEXT;
    return (
      <Frame
        view={view.frame}
        ring={view.showRing ? ring : undefined}
        label={
          label && (
            <TextPart view={label} style={LABEL}>
              {name}
            </TextPart>
          )
        }
        leftInset={label?.leftInset}
        style={{ width: '100%' }}
      >
        <TextPart view={line} style={LINE}>
          {content}
        </TextPart>
        {/* The real caret only shows on real focus; this stands in for it. */}
        {state === 'focused' && caret && (
          <span
            style={{
              flex: 'none',
              width: 1,
              height: (line.typography?.fontSize ?? 16) * LINE_HEIGHT,
              background: caret.color,
              opacity: caret.opacity,
            }}
          />
        )}
      </Frame>
    );
  };

  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
      }}
    >
      {field('Username', 'anlucialuvr69', false)}
      {field('Password', 'Enter password', true)}
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

/**
 * main's `.Label`: the gap it opens in the stroke either side of the glyphs.
 * Block, so the seat is exactly the glyph line box and `Frame`'s
 * `translate: -50%` centres the glyphs on the stroke whatever the page's font.
 */
const LABEL: CSSProperties = { paddingInline: 5, display: 'block' };

/** main's `.Input`: full width, clipped like a real field. */
const LINE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  lineHeight: LINE_HEIGHT,
};
