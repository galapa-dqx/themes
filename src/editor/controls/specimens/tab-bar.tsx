/**
 * The tab-bar specimen: the two rows main drew the hints in — the bumper pair
 * around the window tabs in the titlebar's centre column, and the trigger
 * pair around the settings subtabs (`TabBar.tsx` 38-55: `.TabBar` centres the
 * 16px glyphs at gap 5 inside its 10px gutters) — plus the four variants at
 * 3x, which is the only way to judge 16px art.
 *
 * main had no specimen at all for this control (`PartSpecimen`'s `default:`
 * branch gave a colour-only text control an empty 120px box, and its tab rows
 * passed no `hints`), so the tint was invisible until you opened the preview
 * window. The glyphs themselves were app icons on main; in V2 they are the
 * compiler's built-in art, replaceable per variant, so the variants row shows
 * what each key actually draws.
 */
import { Anchor, Text } from '@mantine/core';
import { Link, useParams } from 'react-router';
import { Frame } from '@/editor/preview/Frame';
import { ImagePart } from '@/editor/preview/ImagePart';
import type { ControlView, VariantView } from '@/editor/preview/resolve';
import { TextPart } from '@/editor/preview/TextPart';
import { useView } from '@/editor/preview/useView';
import type { RootControlId } from '@/theme/catalog';
import { Strip, Tabs } from './tabStrip';

/** main:src/components/TitleBar.tsx 12-15 and SettingsLayout.tsx 6-14. */
const WINDOW_TABS = ['Launcher', 'Settings'];
const SECTIONS = ['Game', 'Players', 'Graphics'];

const ZOOM = 3;

const mono = {
  fontFamily: 'monospace',
  fontSize: 10,
  color: 'var(--mantine-color-dimmed)',
  wordBreak: 'break-all',
} as const;

const caption = {
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: 0.4,
  color: '#888',
} as const;

/** The hints are meaningless alone: say what they flank. */
export function TabBarFields() {
  const { id = '' } = useParams();
  return (
    <Text fz={12} c="dimmed">
      Drawn beside the{' '}
      <Anchor component={Link} to={`/editor/${id}/controls/tab`} fz={12}>
        Tab
      </Anchor>{' '}
      and{' '}
      <Anchor component={Link} to={`/editor/${id}/controls/subtab`} fz={12}>
        Subtab
      </Anchor>{' '}
      controls, never on their own.
    </Text>
  );
}

/** One tab pill, drawn from the `tab` / `subtab` control like main's TabBar. */
function Tab({
  control,
  label,
  selected,
  minWidth,
}: {
  control: RootControlId;
  label: string;
  selected: boolean;
  minWidth: number;
}) {
  const view = useView(control, selected ? 'selected' : 'default');
  if (view.kind !== 'frame') return null;
  const text =
    view.parts.text?.kind === 'text' ? view.parts.text.text : undefined;
  return (
    <Frame view={view.frame} style={{ minWidth, justifyContent: 'center' }}>
      {text && <TextPart view={text}>{label}</TextPart>}
    </Frame>
  );
}

function Row({
  hint,
  host,
  stroke,
  control,
  items,
  minWidth,
  left,
  right,
  label,
}: {
  hint: VariantView;
  host: RootControlId;
  stroke: 'inset' | 'border';
  control: RootControlId;
  items: string[];
  minWidth: number;
  left: string;
  right: string;
  label: string;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ overflowX: 'auto' }}>
        <Strip host={host} stroke={stroke}>
          <ImagePart view={hint} variant={left} />
          <Tabs>
            {items.map((item, i) => (
              <Tab
                key={item}
                control={control}
                label={item}
                selected={i === 0}
                minWidth={minWidth}
              />
            ))}
          </Tabs>
          <ImagePart view={hint} variant={right} />
        </Strip>
      </div>
      <span style={caption}>{label}</span>
    </div>
  );
}

export function TabBarSpecimen({ view }: { view: ControlView }) {
  const part =
    view.parts.hint?.kind === 'variant-image' ? view.parts.hint : null;
  if (!part) return null;
  const hint = part.variant;
  const w = hint.size?.width ?? 16;
  const h = hint.size?.height ?? 16;
  return (
    <div
      style={{
        width: '100%',
        minWidth: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
      }}
    >
      <Row
        hint={hint}
        host="titlebar"
        stroke="inset"
        control="tab"
        items={WINDOW_TABS}
        minWidth={87}
        left="left-bumper"
        right="right-bumper"
        label="Bumpers · window tabs"
      />
      <Row
        hint={hint}
        host="subtabs"
        stroke="border"
        control="subtab"
        items={SECTIONS}
        minWidth={0}
        left="left-trigger"
        right="right-trigger"
        label="Triggers · settings subtabs"
      />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {(part.entry.variants ?? []).map((variant) => (
            <div
              key={variant}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <ImagePart
                view={hint}
                variant={variant}
                style={{ width: w * ZOOM, height: h * ZOOM }}
              />
              <span style={mono}>{variant}</span>
            </div>
          ))}
        </div>
        <span style={caption}>Variants · {ZOOM}x</span>
      </div>
      <span style={mono}>
        {[
          hint.currentColor ?? 'no tint',
          `${w} x ${h}`,
          hint.opacity !== 1 ? `α ${hint.opacity}` : undefined,
        ]
          .filter(Boolean)
          .join(' · ')}
      </span>
    </div>
  );
}
