/**
 * The news-item specimen: main's `NewsList.tsx` + `NewsList.module.css` — a
 * flex row (gap 8) at the theme's own height, the title flexing and
 * ellipsised, the date fixed, and the category gem where the theme puts it:
 * straddling — main's only mode, absolutely centred on the frame's left
 * border with half of it outside (hence main's 8px bleed, kept here so
 * nothing clips) — or inside, a cell of the row that pushes the title along.
 *
 * Two differences from main, both V2 truth rather than choices: the title
 * carries its own colour (V1 inherited the frame's ambient content colour,
 * which V2 removed), and the gem is a VariantImageControl — the built-in
 * 14x14 art with its fixed category fills, stroked in the part's
 * `currentColor`, instead of the app's `--cat-*` glyphs stroked with the
 * frame's live border.
 *
 * The Default cell shows all four categories (main's Gallery block); the
 * state cells show PartSpecimen's single 'events' row.
 */
import { Frame } from '@/editor/preview/Frame';
import { ImagePart } from '@/editor/preview/ImagePart';
import type {
  ControlView,
  FocusRingView,
  StateName,
  TextView,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';

/** main's PartSpecimen:121-136 (one row) and Gallery:72-82 (all categories). */
const ONE = [
  { category: 'events', title: 'News item with category gem', date: 'Aug 11' },
];
const ALL = [
  { category: 'events', title: 'Events category gem', date: 'Aug 9' },
  { category: 'updates', title: 'Updates category gem', date: 'Aug 8' },
  { category: 'maintenance', title: 'Maintenance category gem', date: 'Aug 7' },
  { category: 'news', title: 'News category gem', date: 'Aug 6' },
];

/** main's `.Badge`: centred on the left border, half of it outside the box. */
const BLEED = 8;
/** Straddling, the gem hangs outside the frame; inside, it is the row's first cell. */
const STRADDLE = {
  position: 'absolute',
  top: '50%',
  left: 0,
  transform: 'translate(-50%, -50%)',
} as const;
const INSIDE = { flex: 'none' } as const;

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

const NO_TEXT: TextView = { opacity: 1 };

/** What a state moves here: the stroke, the two inks and the gem's tint. */
const summary = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  const text = (n: string) => {
    const p = view.parts[n];
    return p?.kind === 'text' ? p.text.color : undefined;
  };
  const gem =
    view.parts.gem?.kind === 'variant-image' ? view.parts.gem : undefined;
  return [
    f.shape === 'asset'
      ? (f.asset ?? 'no asset')
      : f.border.color !== 'none' && f.border.thickness.some(Boolean)
        ? `${f.border.thickness[0]}px ${f.border.color}`
        : 'no stroke',
    `title ${text('title')}`,
    `date ${text('date')}`,
    `gem ${gem?.variant.currentColor ?? 'unset'} · ${gem?.variant.placement}`,
  ].join(' · ');
};

export function NewsItemSpecimen({
  view,
  state,
  ring,
}: {
  view: ControlView;
  state: StateName;
  ring: FocusRingView;
}) {
  if (view.kind !== 'frame') return null;
  const text = (name: string): TextView => {
    const p = view.parts[name];
    return p?.kind === 'text' ? p.text : NO_TEXT;
  };
  const gem =
    view.parts.gem?.kind === 'variant-image' ? view.parts.gem : undefined;
  const inside = gem?.variant.placement === 'inside';
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        paddingLeft: inside ? 0 : BLEED,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {/* main's `.NewsList`. */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(state === 'default' ? ALL : ONE).map((item) => (
          <Frame
            key={item.category}
            view={view.frame}
            ring={view.showRing ? ring : undefined}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              minWidth: 0,
            }}
          >
            {gem && (
              <ImagePart
                view={gem.variant}
                variant={item.category}
                style={inside ? INSIDE : STRADDLE}
              />
            )}
            <TextPart
              view={text('title')}
              style={{
                flex: 1,
                minWidth: 0,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {item.title}
            </TextPart>
            <TextPart view={text('date')} as="time" style={{ flex: 'none' }}>
              {item.date}
            </TextPart>
          </Frame>
        ))}
      </div>
      <span style={mono}>{summary(view)}</span>
    </div>
  );
}
