/**
 * The subtabs specimen: the Settings header strip (main's
 * `SettingsLayout.tsx` 16-30 — `.SubTabs` holding a `TabBar` of the seven
 * sections at `size="sm"` with the trigger hints), at the control's own
 * height instead of main's specimen, which was an empty 120px box
 * (PartSpecimen's `default:` branch — subtabs had no case of its own).
 *
 * main's `.SubTabs` reads four vars by hand (`-h`, `-fill`, `-bw-b`, `-bc`),
 * so radius, corner, padding, opacity, the other three strokes and the asset
 * shape painted nothing for this control. Here the strip goes through the
 * shared `Frame`, so every field of the control under edit shows; the 13
 * first-party themes set only those four and look identical either way. main's
 * `.SubTabs` is a border-box `header` with a real `border-bottom`, so its rule
 * costs a row of the 34px: the tabs are 33px and the selected underline stops
 * above the rule. `Frame` paints the stroke behind the content, so the strip
 * adds the stroke to its padding to give the row the same 33px content box.
 * The theme's padding lands inside the bar, outside `.TabBar`'s `0 10px`.
 */
import { Frame } from '@/editor/preview/Frame';
import { ImagePart } from '@/editor/preview/ImagePart';
import type { ControlView, Four } from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useView } from '@/editor/preview/useView';

/** main:src/pages/Settings/SettingsLayout.tsx 6-14. */
const SECTIONS = [
  'Game',
  'Players',
  'Graphics',
  'Controls',
  'Sound',
  'Clarity',
  'About',
];
const ACTIVE = 'Graphics';

const shorthand = ([t, r, b, l]: Four) =>
  (t === b && r === l ? (t === r ? [t] : [t, r]) : [t, r, b, l]).join(' ');

const summary = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  const h = `h ${f.size?.height ?? 'auto'}`;
  if (f.shape === 'asset') return `${f.asset ?? 'no asset'} · ${h}`;
  return [
    f.fill === 'none' ? 'no fill' : f.fill,
    f.border.color !== 'none' && f.border.thickness.some(Boolean)
      ? `${shorthand(f.border.thickness)}px ${f.border.color}`
      : 'no stroke',
    h,
    f.opacity !== 1 ? `α ${f.opacity}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');
};

/** One `.Tab`: the subtab control at the row's full height (`align-items: stretch`). */
function Item({ label }: { label: string }) {
  const view = useView('subtab', label === ACTIVE ? 'selected' : 'default');
  if (view.kind !== 'frame') return null;
  const text =
    view.parts.text?.kind === 'text' ? view.parts.text.text : undefined;
  return (
    <Frame view={view.frame} style={{ minWidth: 0, justifyContent: 'center' }}>
      {text && <TextPart view={text}>{label}</TextPart>}
    </Frame>
  );
}

export function SubtabsSpecimen({ view }: { view: ControlView }) {
  const bar = useView('tab-bar', 'default');
  const hint =
    bar.parts.hint?.kind === 'variant-image' ? bar.parts.hint.variant : null;
  if (view.kind !== 'frame') return null;
  const f = view.frame;
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {/* Full window width in the app; here it scrolls rather than spilling. */}
      <div style={{ width: '100%', overflowX: 'auto' }}>
        <Frame
          view={view.frame}
          style={{
            // Border-box: the stroke eats a row of the height, as on main.
            padding:
              f.shape === 'path'
                ? f.padding
                    .map((p, i) => `${p + f.border.thickness[i]}px`)
                    .join(' ')
                : undefined,
            minWidth: '100%',
            justifyContent: 'center',
          }}
        >
          {/* main's .TabBar: gap 5, its own 10px gutters, full height. */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              height: '100%',
              padding: '0 10px',
            }}
          >
            {hint && (
              <ImagePart
                view={hint}
                variant="left-trigger"
                style={{ flex: 'none' }}
              />
            )}
            <div
              style={{
                display: 'flex',
                alignItems: 'stretch',
                gap: 5,
                height: '100%',
              }}
            >
              {SECTIONS.map((s) => (
                <Item key={s} label={s} />
              ))}
            </div>
            {hint && (
              <ImagePart
                view={hint}
                variant="right-trigger"
                style={{ flex: 'none' }}
              />
            )}
          </div>
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
