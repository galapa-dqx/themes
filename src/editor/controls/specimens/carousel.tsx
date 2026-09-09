/**
 * The carousel specimen: main's `Carousel.tsx` — a fluid frame holding the
 * 728/185 banner, two nav buttons straddling the left/right edges at -15px
 * (`Carousel.module.css` 23-45), and a centred pip row 10px below it (1-5,
 * 47-65). Geometry is app-owned on main and stays app-owned here; the theme
 * only supplies the frame's paint and the nav/pip artwork.
 *
 * In V2 the nav and the pip are ImageControls: one SVG is the whole visual,
 * circle and stroke included, so there is no frame behind them and no
 * app-drawn chevron — a missing asset draws an empty dashed box.
 *
 * A state moves one nav and one pip on a real carousel, never all of them,
 * so each cell forces the state on the right arrow and the middle pip and
 * leaves the rest as they are: the left arrow at Default and the first pip
 * Selected, which is exactly main's initial render in the Default cell.
 */
import { Frame } from '@/editor/preview/Frame';
import { ImagePart } from '@/editor/preview/ImagePart';
import type {
  ControlView,
  FocusRingView,
  ImageView,
  StateName,
} from '@/editor/preview/resolve';
import { useView } from '@/editor/preview/useView';

/** App-owned geometry (Carousel.module.css). */
const OVERHANG = 15;
const BANNER = '/banners/version-update.svg';
const ALT = 'Version 7.4 — The Sable Depths. New zones, new bosses.';

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

const image = (v: ControlView | undefined): ImageView | undefined =>
  v?.kind === 'image' ? v.image : undefined;

/** What a state actually moves on an image control: the art and its tint. */
const summary = (v: ImageView | undefined) =>
  [
    v?.asset?.replace(/^.*\//, '') ?? 'no asset',
    v?.currentColor,
    v && v.opacity !== 1 ? `α ${v.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

function Nav({
  view,
  side,
  ring,
}: {
  view: ImageView | undefined;
  side: 'left' | 'right';
  /** Pass only when the state shows the ring. */
  ring?: FocusRingView;
}) {
  if (!view) return null;
  return (
    <button
      type="button"
      disabled
      aria-label={side === 'left' ? 'Previous banner' : 'Next banner'}
      style={{
        position: 'absolute',
        top: '50%',
        [side]: -OVERHANG,
        transform: 'translateY(-50%)',
        display: 'grid',
        placeItems: 'center',
        width: view.size?.width,
        height: view.size?.height,
        padding: 0,
        background: 'none',
        border: 0,
        cursor: 'pointer',
        outline: ring
          ? `${ring.width}px solid ${ring.color}`
          : view.asset
            ? undefined
            : '1px dashed #ff00ff',
        outlineOffset: ring ? ring.offset : undefined,
      }}
    >
      <ImagePart
        view={view}
        style={side === 'left' ? { transform: 'scaleX(-1)' } : undefined}
      />
    </button>
  );
}

function Pip({
  view,
  index,
  current,
  ring,
}: {
  view: ImageView | undefined;
  index: number;
  current: boolean;
  ring?: FocusRingView;
}) {
  if (!view) return null;
  return (
    <button
      type="button"
      disabled
      aria-label={`Go to banner ${index + 1} of 3`}
      aria-current={current}
      style={{
        display: 'grid',
        placeItems: 'center',
        width: view.size?.width,
        height: view.size?.height,
        padding: 0,
        background: 'none',
        border: 0,
        cursor: 'pointer',
        outline: ring
          ? `${ring.width}px solid ${ring.color}`
          : view.asset
            ? undefined
            : '1px dashed #ff00ff',
        outlineOffset: ring ? ring.offset : undefined,
      }}
    >
      <ImagePart view={view} />
    </button>
  );
}

export function CarouselSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  const def = useView('carousel', 'default');
  const sel = useView('carousel', 'selected');
  if (view.kind !== 'frame') return null;
  const nav = image(view.parts.nav);
  const pip = image(view.parts.pip);
  const radius =
    view.frame.shape === 'path'
      ? view.frame.radius === 'pill'
        ? 999
        : view.frame.radius
      : 0;
  const navRing = view.parts.nav?.showRing ? ring : undefined;
  const pipRing = view.parts.pip?.showRing ? ring : undefined;
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        width: '100%',
        minWidth: 0,
        padding: `0 ${OVERHANG}px`,
      }}
    >
      <Frame
        as="figure"
        view={view.frame}
        style={{ display: 'block', margin: 0, width: '100%' }}
      >
        <img
          src={BANNER}
          alt={ALT}
          style={{
            display: 'block',
            width: '100%',
            // A content constraint (the banner art's ratio), as on main.
            aspectRatio: '728 / 185',
            objectFit: 'cover',
            borderRadius: radius,
          }}
        />
        <Nav view={image(def.parts.nav)} side="left" />
        <Nav view={nav} side="right" ring={navRing} />
      </Frame>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '2px 0',
        }}
      >
        <Pip view={image(sel.parts.pip)} index={0} current />
        <Pip view={pip} index={1} current={false} ring={pipRing} />
        <Pip view={image(def.parts.pip)} index={2} current={false} />
      </div>
      <span style={mono}>nav {summary(nav)}</span>
      <span style={mono}>pip {summary(pip)}</span>
      {state !== 'default' && (
        <span style={mono}>forced on the right arrow and the middle pip</span>
      )}
    </div>
  );
}
