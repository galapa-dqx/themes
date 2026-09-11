/**
 * The titlebar specimen: main's `TitleBar.tsx` + `TitleBar.module.css` — a
 * `1fr auto 1fr` grid with the wordmark left, the tab bar centre and the two
 * caption buttons plus the close button right, drawn once per forced state.
 * main's specimen was the live bar (hover it to see anything) and the
 * caption/close/wordmark parts each got an empty 120px box.
 *
 * Geometry from `.CaptionBtn`: `display: grid; place-items: center`, the
 * width from the button's `size`, the height shortened by the bar's bottom
 * stroke so the plate sits inside the frame. main read the *caption* size for
 * the close button as well (close's own `-w/-h` were emitted and never used);
 * V2 gives each part its own size, which is 34 × 34 for both everywhere.
 *
 * The glyphs are the app's, not the theme's: `main:src/components/icons.tsx`
 * L58-89 (fluent 20 filled), tinted through `currentColor` by the matching
 * `*-icon` paint part, which is resolved at the cell's state independently of
 * its button — anlucia's close turns its glyph to `surface` on hover only.
 */
import { Text } from '@mantine/core';
import { Frame } from '@/editor/preview/Frame';
import type {
  ControlView,
  FocusRingView,
  Four,
  PaintView,
  StateName,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useView } from '@/editor/preview/useView';

/** main:src/components/icons.tsx L58-89. */
const MINIMIZE =
  'M3 16.25C3 16.0511 3.07902 15.8603 3.21967 15.7197C3.36032 15.579 3.55109 15.5 3.75 15.5H16.25C16.4489 15.5 16.6397 15.579 16.7803 15.7197C16.921 15.8603 17 16.0511 17 16.25C17 16.4489 16.921 16.6397 16.7803 16.7803C16.6397 16.921 16.4489 17 16.25 17H3.75C3.55109 17 3.36032 16.921 3.21967 16.7803C3.07902 16.6397 3 16.4489 3 16.25Z';
const MAXIMIZE =
  'M3 5.25C3 4.65326 3.23705 4.08097 3.65901 3.65901C4.08097 3.23705 4.65326 3 5.25 3H14.75C15.3467 3 15.919 3.23705 16.341 3.65901C16.7629 4.08097 17 4.65326 17 5.25V14.75C17 15.3467 16.7629 15.919 16.341 16.341C15.919 16.7629 15.3467 17 14.75 17H5.25C4.65326 17 4.08097 16.7629 3.65901 16.341C3.23705 15.919 3 15.3467 3 14.75V5.25ZM5.25 4.5C5.05109 4.5 4.86032 4.57902 4.71967 4.71967C4.57902 4.86032 4.5 5.05109 4.5 5.25V14.75C4.5 15.164 4.836 15.5 5.25 15.5H14.75C14.9489 15.5 15.1397 15.421 15.2803 15.2803C15.421 15.1397 15.5 14.9489 15.5 14.75V5.25C15.5 5.05109 15.421 4.86032 15.2803 4.71967C15.1397 4.57902 14.9489 4.5 14.75 4.5H5.25Z';
const CLOSE =
  'M3.897 4.054L3.97 3.97C4.09699 3.84298 4.26534 3.76575 4.44445 3.75236C4.62356 3.73896 4.80153 3.79029 4.946 3.897L5.03 3.97L10 8.939L14.97 3.969C15.0971 3.84213 15.2655 3.76509 15.4446 3.75188C15.6237 3.73866 15.8016 3.79016 15.946 3.897L16.03 3.97C16.157 4.09699 16.2342 4.26534 16.2476 4.44445C16.261 4.62356 16.2097 4.80153 16.103 4.946L16.03 5.03L11.061 10L16.031 14.97C16.1579 15.0971 16.2349 15.2655 16.2481 15.4446C16.2613 15.6237 16.2098 15.8016 16.103 15.946L16.03 16.03C15.903 16.157 15.7347 16.2342 15.5555 16.2476C15.3764 16.261 15.1985 16.2097 15.054 16.103L14.97 16.03L10 11.061L5.03 16.031C4.90289 16.1579 4.73447 16.2349 4.55536 16.2481C4.37626 16.2613 4.19835 16.2098 4.054 16.103L3.97 16.03C3.84298 15.903 3.76575 15.7347 3.75236 15.5555C3.73896 15.3764 3.79029 15.1985 3.897 15.054L3.97 14.97L8.939 10L3.969 5.03C3.84213 4.90289 3.76509 4.73447 3.75188 4.55536C3.73866 4.37626 3.79016 4.19835 3.897 4.054Z';

/** The app's caption glyphs, by button. */
const GLYPHS = { minimize: MINIMIZE, maximize: MAXIMIZE, close: CLOSE };
export type Glyph = keyof typeof GLYPHS;

const NO_PAINT: PaintView = { opacity: 1 };

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

const thickness = (t: Four) =>
  (t.every((v) => v === t[0]) ? [t[0]] : t).join(' ');

const frameOf = (view: ControlView, name: string) => {
  const p = view.parts[name];
  return p?.kind === 'frame' ? p : undefined;
};
const paintOf = (view: ControlView, name: string) => {
  const p = view.parts[name];
  return p?.kind === 'paint' ? p.paint : NO_PAINT;
};

/** What a state moves: the button plate and the glyph tint. */
const button = (view: ControlView, name: string) => {
  const f = frameOf(view, name)?.frame;
  const icon = paintOf(view, `${name}-icon`).color ?? 'no tint';
  if (!f) return `${name} —`;
  if (f.shape === 'asset') return `${name} ${f.asset ?? 'no asset'} · ${icon}`;
  return [
    name,
    f.fill === 'none' ? 'no fill' : f.fill,
    f.border.color !== 'none' && f.border.thickness.some(Boolean)
      ? `${thickness(f.border.thickness)}px ${f.border.color}`
      : undefined,
    icon,
    f.opacity !== 1 ? `α ${f.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

/** main's `.CaptionBtn`: the plate at its own width, shortened by the bar's bottom stroke. */
export function CaptionButton({
  part,
  paint,
  glyph,
  height,
  ring,
  ...rest
}: {
  part: ControlView | undefined;
  paint: PaintView;
  glyph: Glyph;
  height: number;
  ring: FocusRingView;
  /** Stage hit-testing (`data-control`, `data-key`). */
  [data: `data-${string}`]: string | undefined;
}) {
  if (part?.kind !== 'frame') return null;
  return (
    <Frame
      as="button"
      type="button"
      tabIndex={-1}
      {...rest}
      view={part.frame}
      ring={part.showRing ? ring : undefined}
      style={{
        display: 'grid',
        placeItems: 'center',
        height,
        flex: 'none',
        cursor: 'default',
      }}
    >
      <svg
        width="20"
        height="20"
        viewBox="0 0 20 20"
        fill="none"
        aria-hidden="true"
        style={{ color: paint.color, opacity: paint.opacity }}
      >
        <path fill="currentColor" d={GLYPHS[glyph]} />
      </svg>
    </Frame>
  );
}

export function TitlebarSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  if (view.kind !== 'frame') return null;
  const bar = view.frame;
  // `.CaptionBtn` height: the bar's bottom stroke shows under the plates.
  const under =
    bar.shape === 'path' && bar.border.color !== 'none'
      ? bar.border.thickness[2]
      : 0;
  const wordmark =
    view.parts.wordmark?.kind === 'text' ? view.parts.wordmark.text : undefined;
  const height = (name: string) =>
    (frameOf(view, name)?.frame.size?.height ?? 34) - under;
  const caption = frameOf(view, 'caption');
  const close = frameOf(view, 'close');
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
      <Frame
        as="header"
        view={bar}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          alignItems: 'center',
          width: '100%',
          minWidth: 0,
          userSelect: 'none',
        }}
      >
        {wordmark && (
          <TextPart view={wordmark} style={{ whiteSpace: 'nowrap' }}>
            Galapa
          </TextPart>
        )}
        {/* main's `.Center` holds the tab bar — the `tab` control's business. */}
        <div />
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifySelf: 'end',
            height: '100%',
          }}
        >
          <CaptionButton
            part={caption}
            paint={paintOf(view, 'caption-icon')}
            glyph="minimize"
            height={height('caption')}
            ring={ring}
          />
          <CaptionButton
            part={caption}
            paint={paintOf(view, 'caption-icon')}
            glyph="maximize"
            height={height('caption')}
            ring={ring}
          />
          <CaptionButton
            part={close}
            paint={paintOf(view, 'close-icon')}
            glyph="close"
            height={height('close')}
            ring={ring}
          />
        </div>
      </Frame>
      {state === 'default' && (
        <span style={mono}>
          bar{' '}
          {bar.shape === 'asset'
            ? (bar.asset ?? 'no asset')
            : [
                bar.fill,
                bar.border.color !== 'none' &&
                bar.border.thickness.some(Boolean)
                  ? `${thickness(bar.border.thickness)}px ${bar.border.color}`
                  : 'no stroke',
                wordmark?.color ?? 'no wordmark',
              ].join(' · ')}
        </span>
      )}
      <span style={mono}>{button(view, 'caption')}</span>
      <span style={mono}>{button(view, 'close')}</span>
    </div>
  );
}

/**
 * The buttons' height comes from three fields on three cards: their own size,
 * the bar's height and the bar's bottom stroke. main hardcoded the bar at
 * 34px and shortened the plates in CSS, so nothing said so on screen.
 */
export function TitlebarFields() {
  const view = useView('titlebar', 'default');
  if (view.kind !== 'frame') return null;
  const bar = view.frame;
  const h = bar.size?.height ?? 34;
  const under =
    bar.shape === 'path' && bar.border.color !== 'none'
      ? bar.border.thickness[2]
      : 0;
  const size = (name: string) => frameOf(view, name)?.frame.size;
  const cap = size('caption');
  const close = size('close');
  const tallest = Math.max(cap?.height ?? 0, close?.height ?? 0);
  const spill = tallest - h;
  const same =
    cap?.width === close?.width && cap?.height === close?.height
      ? cap
      : undefined;
  return (
    <Text fz={12} c={spill > 0 ? 'orange.7' : 'dimmed'}>
      {same
        ? `The ${same.width} × ${same.height} buttons`
        : `The ${cap?.width} × ${cap?.height} caption and ${close?.width} × ${close?.height} close buttons`}{' '}
      sit at the right of the {h} px bar
      {under > 0
        ? `, drawn ${under} px shorter so its bottom stroke stays visible under them.`
        : '.'}
      {spill > 0 && ` They are ${spill} px taller than the bar.`}
    </Text>
  );
}
