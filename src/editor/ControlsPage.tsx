/**
 * 4a/4b: the control list beside the selected control's editor and its
 * preview. Every root in the catalog is listed; the editor body is built
 * control by control (see ControlEditor).
 */
import { useState, type ComponentType } from 'react';
import {
  Divider,
  Group,
  NavLink,
  Stack,
  Switch,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAdjustmentsHorizontal,
  IconAppWindow,
  IconArrowsVertical,
  IconCarouselHorizontal,
  IconDeviceGamepad2,
  IconFocus2,
  IconForms,
  IconHandClick,
  IconHelpSquare,
  IconLayoutBottombar,
  IconLayoutList,
  IconLayoutNavbar,
  IconNews,
  IconPlayerPlay,
  IconProgress,
  IconSection,
  IconSettings,
  IconSquare,
  IconToggleRight,
  type IconProps,
} from '@tabler/icons-react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router';
import {
  CONTROL_CATALOG,
  type ControlState,
  type RootControlId,
} from '@/theme/catalog';
import { ControlEditor } from './controls/ControlEditor';
import { CONTROLS } from './controls/registry';
import { GenericSpecimen } from './preview/GenericSpecimen';
import { Island, StateGrid } from './preview/Island';
import { statesOf, type StateName } from './preview/resolve';
import { BoxesContext } from './preview/useView';
import { useProjectStore } from './projectStore';
import { SplitPane } from './SplitPane';
import { controlLabel } from './tokensUtil';

type Meta = { icon: ComponentType<IconProps>; description: string };
const META: Record<RootControlId, Meta> = {
  window: {
    icon: IconAppWindow,
    description: 'The application window and its chrome style',
  },
  titlebar: {
    icon: IconLayoutNavbar,
    description: 'Wordmark, caption and close buttons',
  },
  'tab-bar': {
    icon: IconDeviceGamepad2,
    description: 'Bumper and trigger hints beside the tabs',
  },
  subtabs: {
    icon: IconSection,
    description: 'The strip that holds a page’s subtabs',
  },
  'focus-ring': {
    icon: IconFocus2,
    description: 'Keyboard focus indicator drawn by its owner',
  },
  panel: {
    icon: IconSquare,
    description: 'Framed surface behind grouped content',
  },
  button: {
    icon: IconHandClick,
    description: 'Play, dialog actions, carousel arrows',
  },
  input: {
    icon: IconForms,
    description: 'Text fields: label, value, placeholder and caret',
  },
  tab: { icon: IconLayoutBottombar, description: 'Top-level navigation tabs' },
  subtab: {
    icon: IconLayoutList,
    description: 'Second-level tabs inside a page',
  },
  switch: {
    icon: IconToggleRight,
    description: 'Toggle with a track and a thumb',
  },
  carousel: {
    icon: IconCarouselHorizontal,
    description: 'Featured items with nav arrows and pips',
  },
  scrollbar: {
    icon: IconArrowsVertical,
    description: 'Track and thumb of scrollable panels',
  },
  progress: {
    icon: IconProgress,
    description: 'Download and install progress',
  },
  'news-item': {
    icon: IconNews,
    description: 'A news row: title, date and category gem',
  },
  'setting-row': {
    icon: IconAdjustmentsHorizontal,
    description: 'A settings row: label and value',
  },
  settings: { icon: IconSettings, description: 'Settings page heading' },
  'setting-help': {
    icon: IconHelpSquare,
    description: 'Explanatory panel beside a setting',
  },
  'play-row': {
    icon: IconPlayerPlay,
    description: 'Ornament beside the play button',
  },
};
const GROUPS: { label: string; ids: RootControlId[] }[] = [
  {
    label: 'Chrome',
    ids: ['window', 'titlebar', 'focus-ring', 'panel'],
  },
  {
    label: 'Controls',
    ids: [
      'button',
      'input',
      'tab',
      'subtab',
      'switch',
      'carousel',
      'scrollbar',
      'progress',
    ],
  },
  {
    label: 'Content',
    ids: ['news-item', 'setting-row', 'settings', 'setting-help', 'play-row'],
  },
];

/**
 * Chrome with no page of its own: each only ever appears with one control, so
 * it is edited and previewed inside that control instead of beside it. The
 * project format is unchanged — these are still root controls in their own file.
 */
const MERGED_INTO: Partial<Record<RootControlId, RootControlId>> = {
  'tab-bar': 'tab',
  subtabs: 'subtab',
};
const mergedInto = (id: RootControlId) =>
  (Object.keys(MERGED_INTO) as RootControlId[]).find(
    (part) => MERGED_INTO[part] === id,
  );

export function ControlsPage() {
  const { id: themeId = '', item } = useParams();
  const [query, setQuery] = useState('');
  const controls = useProjectStore((s) => s.doc.controls);
  if (!item || !(item in CONTROL_CATALOG))
    return <Navigate to={`/editor/${themeId}/controls/window`} replace />;
  const host = MERGED_INTO[item as RootControlId];
  if (host)
    return <Navigate to={`/editor/${themeId}/controls/${host}`} replace />;
  const current = item as RootControlId;
  const q = query.toLowerCase();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px minmax(0, 1fr)',
        height: 'calc(100vh - 52px)',
      }}
    >
      <Stack
        gap={0}
        style={{
          borderRight: '1px solid var(--mantine-color-default-border)',
          minHeight: 0,
        }}
      >
        <TextInput
          m="12px 12px 8px"
          placeholder="Filter controls"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Stack
          gap={1}
          p="0 8px 12px"
          style={{ overflow: 'auto', minHeight: 0 }}
        >
          {GROUPS.map((g) => {
            // Merged chrome answers to its own name too, and shows its host.
            const ids = g.ids.filter((id) =>
              [id, mergedInto(id)].some(
                (c) => c && controlLabel(c).toLowerCase().includes(q),
              ),
            );
            if (ids.length === 0) return null;
            return (
              <div key={g.label}>
                <Text
                  fz={11}
                  fw={600}
                  c="dimmed"
                  tt="uppercase"
                  px={12}
                  pt={10}
                  pb={4}
                  lts={0.4}
                >
                  {g.label}
                </Text>
                {ids.map((id) => {
                  const Icon = META[id].icon;
                  // The dot marks a required control the project hasn't
                  // defined yet — including the chrome merged into it.
                  const part = mergedInto(id);
                  const missing = [id, part].some(
                    (c) => c && CONTROL_CATALOG[c].required && !controls[c],
                  );
                  return (
                    <NavLink
                      key={id}
                      component={Link}
                      to={`/editor/${themeId}/controls/${id}`}
                      label={controlLabel(id)}
                      leftSection={
                        <Icon
                          size={16}
                          color={
                            id === current
                              ? undefined
                              : 'var(--mantine-color-gray-6)'
                          }
                        />
                      }
                      rightSection={
                        missing ? (
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: 'var(--mantine-color-orange-5)',
                            }}
                          />
                        ) : undefined
                      }
                      active={id === current}
                      variant="light"
                      fw={id === current ? 600 : undefined}
                      fz={13}
                      py={7}
                      style={{ borderRadius: 'var(--mantine-radius-sm)' }}
                    />
                  );
                })}
              </div>
            );
          })}
        </Stack>
      </Stack>
      <Workspace key={current} id={current} />
    </div>
  );
}

/** Editor and preview of one control; the state tab lives in `?state=`. */
function Workspace({ id }: { id: RootControlId }) {
  const part = mergedInto(id);
  const [params, setParams] = useSearchParams();
  const wanted = params.get('state');
  const state: StateName =
    wanted && statesOf(CONTROL_CATALOG[id]).includes(wanted as ControlState)
      ? (wanted as StateName)
      : 'default';
  const setState = (s: StateName) =>
    setParams(s === 'default' ? {} : { state: s }, { replace: true });
  return (
    <SplitPane side={<PreviewPanel id={id} state={state} part={part} />}>
      <Stack gap={0} style={{ overflow: 'auto', minWidth: 0 }}>
        <Group gap={12} p="20px 24px 0" wrap="nowrap">
          <div style={{ flex: 1 }}>
            <Title order={2} fz={20}>
              {controlLabel(id)}
            </Title>
            <Text c="dimmed" fz={13}>
              {META[id].description}
            </Text>
          </div>
        </Group>
        <ControlEditor id={id} state={state} onState={setState} />
        {part && (
          <>
            <Divider mx={24} />
            <div style={{ padding: '20px 24px 0' }}>
              <Title order={3} fz={16}>
                {controlLabel(part)}
              </Title>
              <Text c="dimmed" fz={13}>
                {META[part].description}
              </Text>
            </div>
            {/* Stateless chrome: always its own Default, whatever tab the host is on. */}
            <ControlEditor id={part} state="default" onState={() => {}} />
          </>
        )}
      </Stack>
    </SplitPane>
  );
}

function PreviewPanel({
  id,
  state,
  part,
}: {
  id: RootControlId;
  state: StateName;
  /** Chrome merged into this control, previewed under it. */
  part?: RootControlId;
}) {
  const [boxes, setBoxes] = useState(false);
  // ponytail: the 4a "In context · Launcher" shot is the future Preview page.
  const Specimen = CONTROLS[id]?.Specimen ?? GenericSpecimen;
  const PartSpecimen = part && (CONTROLS[part]?.Specimen ?? GenericSpecimen);
  return (
    <div
      style={{
        borderLeft: '1px solid var(--mantine-color-default-border)',
        background:
          'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
        minHeight: 0,
        overflow: 'auto',
      }}
    >
      <Group
        gap={8}
        p="12px 16px"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text fw={600}>Preview</Text>
        <div style={{ flex: 1 }} />
        <Switch
          label="Show boxes"
          size="xs"
          checked={boxes}
          onChange={(e) => setBoxes(e.currentTarget.checked)}
        />
      </Group>
      <Stack gap={8} p={16}>
        <Text fz={11} fw={600} c="dimmed" tt="uppercase" lts={0.4}>
          Isolated · {controlLabel(id)} · {controlLabel(state)}
        </Text>
        <BoxesContext.Provider value={boxes}>
          <Island>
            <StateGrid
              id={id}
              Specimen={Specimen}
              current={state}
              cellWidth={CONTROLS[id]?.cellWidth}
            />
          </Island>
          {part && PartSpecimen && (
            <>
              <Text fz={11} fw={600} c="dimmed" tt="uppercase" lts={0.4} mt={8}>
                Isolated · {controlLabel(part)}
              </Text>
              <Island>
                <StateGrid
                  id={part}
                  Specimen={PartSpecimen}
                  current="default"
                  cellWidth={CONTROLS[part]?.cellWidth}
                />
              </Island>
            </>
          )}
        </BoxesContext.Provider>
      </Stack>
    </div>
  );
}
