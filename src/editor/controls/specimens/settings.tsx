/**
 * The settings specimen: main's Settings section column
 * (`GraphicsSettings.tsx` 183-213 + `SettingsShared.module.css` 11-27) — the
 * `<h2 class=SectionHeading>` at `margin: 0`, first child of the `.Column`
 * (flex, gap 10) above the setting rows. main's own specimen for this control
 * was PartSpecimen's `default:` branch: an empty 120px box with no text in it
 * at all, so the one thing the control paints was invisible.
 *
 * The heading is the whole control — no frame, no glyph, no ring. V1 let
 * `contentColor` fall through to the window's ambient colour; V2 has no such
 * thing and `color` is required, so an unset colour renders as nothing rather
 * than as an inherited grey. The one knowing deviation from main: `line-height`
 * is V2's default 1 instead of the UA's `normal`, which makes the line box a
 * few px shorter.
 */
import type { ControlView, FocusRingView } from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { textSummary } from '@/editor/preview/textStyle';
import { useView } from '@/editor/preview/useView';
import { SettingRows } from './setting-row';

/** main's SpecimenIsland pair, under the Graphics section's own heading. */
const ROWS = [
  { label: 'Screen Mode', value: 'Borderless Windowed' },
  { label: 'Vsync', value: 'Idle row' },
];

export function SettingsSpecimen({
  view,
  ring,
}: {
  view: ControlView;
  ring: FocusRingView;
}) {
  const rows = useView('setting-row', 'default');
  const heading =
    view.parts.heading?.kind === 'text' ? view.parts.heading.text : undefined;
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
      }}
    >
      {heading && (
        <TextPart as="h2" view={heading} style={{ margin: 0 }}>
          Application
        </TextPart>
      )}
      <SettingRows view={rows} ring={ring} rows={ROWS} />
      <span
        style={{
          fontFamily: 'monospace',
          fontSize: 10,
          color: 'var(--mantine-color-dimmed)',
          wordBreak: 'break-all',
        }}
      >
        {textSummary(heading)}
      </span>
    </div>
  );
}
