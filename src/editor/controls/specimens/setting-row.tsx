/**
 * The setting-row specimen: main's `SettingRow.tsx` + `SettingRow.module.css`
 * — a fixed-height flex row, the label ellipsised on the left and the value
 * pinned right with a 19px minimum gap, fluid width (it fills the settings
 * column). Height is the control's own `size.height` rather than main's
 * hardcoded 43px, which is the same number in every first-party theme.
 *
 * One difference from main, V2 truth rather than a choice: the two spans
 * carry their own colour and typography. V1 had a single ambient
 * `contentColor` on the frame plus one `text` spec, and `.Value` then forced
 * `font-weight: 500` and the ambient font family — a quirk with no V2 field.
 * All 13 themes spell label and value alike, so the rendered result matches.
 *
 * The Default cell shows main's SpecimenIsland pair (a second "Vsync / Idle
 * row") so the settings column's 10px gap is visible; the state cells show
 * PartSpecimen's single row.
 */
import { Button, Group, Text } from '@mantine/core';
import { Frame } from '@/editor/preview/Frame';
import type {
  ControlView,
  FocusRingView,
  StateName,
  TextView,
} from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useProjectStore } from '@/editor/projectStore';
import { EMPTY } from '@/editor/tokensUtil';
import type { Raw } from '@/editor/controls/useControlEdit';

/** main's PartSpecimen:110-120 and SpecimenIsland:33-46. */
const ONE = [{ label: 'Screen Mode', value: 'Borderless Windowed' }];
const BOTH = [...ONE, { label: 'Vsync', value: 'Idle row' }];

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

const NO_TEXT: TextView = { opacity: 1 };

/** What a state moves here: the stroke and the two inks. */
const summary = (view: ControlView) => {
  if (view.kind !== 'frame') return '';
  const f = view.frame;
  const ink = (n: string) => {
    const p = view.parts[n];
    return p?.kind === 'text' ? p.text.color : undefined;
  };
  return [
    f.shape === 'asset'
      ? (f.asset ?? 'no asset')
      : f.border.color !== 'none' && f.border.thickness.some(Boolean)
        ? `${f.border.thickness[0]}px ${f.border.color}`
        : 'no stroke',
    `label ${ink('label')}`,
    `value ${ink('value')}`,
  ].join(' · ');
};

export function SettingRowSpecimen({
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
      {/* main's SettingsShared.module.css `.Column`: gap 10. */}
      {(state === 'default' ? BOTH : ONE).map((row) => (
        <Frame
          key={row.label}
          view={view.frame}
          ring={view.showRing ? ring : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 19,
            width: '100%',
            minWidth: 0,
          }}
        >
          <TextPart
            view={text('label')}
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {row.label}
          </TextPart>
          <TextPart
            view={text('value')}
            style={{ display: 'inline-flex', flex: 'none' }}
          >
            {row.value}
          </TextPart>
        </Frame>
      ))}
      <span style={mono}>{summary(view)}</span>
    </div>
  );
}

/**
 * All 13 first-party themes spell label and value identically, and V2 needs
 * both written out; one button beats typing the second one twice.
 */
export function SettingRowFields() {
  const edit = useProjectStore((s) => s.edit);
  const parts = useProjectStore(
    (s) => (s.doc.controls['setting-row'] as Raw | undefined)?.parts ?? EMPTY,
  ) as Record<string, Raw | undefined>;
  const label = parts.label;
  const same = JSON.stringify(label) === JSON.stringify(parts.value);
  return (
    <Group gap={8}>
      <Button
        size="xs"
        variant="default"
        disabled={label === undefined || same}
        onClick={() =>
          edit('Match setting-row value to label', (d) => {
            const p = (d.controls as Record<string, Raw>)['setting-row']
              ?.parts as Raw | undefined;
            if (!p?.label) return;
            p.value = JSON.parse(JSON.stringify(p.label)) as Raw;
          })
        }
      >
        Match the label
      </Button>
      <Text fz={12} c="dimmed">
        Copies the label&rsquo;s font, colour and state colours into the value.
      </Text>
    </Group>
  );
}
