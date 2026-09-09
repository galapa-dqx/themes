/**
 * The panel specimen: main's bare surface (PartSpecimen's default branch —
 * an empty `<Themed part="panel" style={{height:120}}>` inside the island),
 * captioned in the theme's own setting-help ink (main's SettingHelp *is* a
 * panel) so the padding is visible, plus a small box that catches the two
 * bugs a fluid surface hides: `pill` clamping and nine-slice cap shrink.
 */
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

/** CSS shorthand: 1, 2 or 4 values, never lossy. */
const shorthand = ([t, r, b, l]: Four) =>
  (t === b && r === l ? (t === r ? [t] : [t, r]) : [t, r, b, l]).join(' ');

const summary = (f: PathView | AssetView) =>
  f.shape === 'asset'
    ? (f.asset ?? 'no asset')
    : `${f.fill} · ${shorthand(f.border.thickness)}px ${f.border.color} · radius ${f.radius} · ${f.corner}`;

export function PanelSpecimen({ view }: { view: ControlView }) {
  const help = useView('setting-help', 'default');
  if (view.kind !== 'frame') return null;
  const body =
    help.parts.body?.kind === 'text' ? help.parts.body.text : undefined;
  // V2 has no ambient content colour; the caption brings its own.
  const caption: TextView = {
    opacity: 1,
    ...body,
    color: body?.color ?? '#888',
  };
  const frame = view.frame;
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      {/* Block, like main's .Themed: content sits at the top padding edge. */}
      <Frame view={frame} style={{ height: 140, display: 'block' }}>
        <TextPart view={caption}>Panel surface</TextPart>
      </Frame>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Undersized: `pill` is half the shorter side and asset caps shrink. */}
        <Frame view={frame} style={{ width: 96, height: 40, flex: 'none' }} />
        <span
          style={{
            fontFamily: 'monospace',
            fontSize: 11,
            color: 'var(--mantine-color-dimmed)',
            wordBreak: 'break-all',
          }}
        >
          {summary(frame)}
        </span>
      </div>
    </div>
  );
}
