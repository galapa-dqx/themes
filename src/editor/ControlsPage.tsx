/**
 * 4a/4b: the control list beside the selected control's editor and its
 * preview. Every root in the catalog is listed; the editor body is built
 * control by control (see ControlEditor).
 */
import { useState, type ComponentType } from 'react';
import {
  Badge,
  Card,
  Group,
  NavLink,
  Stack,
  Switch,
  Tabs,
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
import { Link, Navigate, useParams } from 'react-router';
import {
  CONTROL_CATALOG,
  type CatalogEntry,
  type RootControlId,
} from '@/theme/catalog';
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
    ids: ['window', 'titlebar', 'tab-bar', 'subtabs', 'focus-ring', 'panel'],
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

export function ControlsPage() {
  const { id: themeId = '', item } = useParams();
  const [query, setQuery] = useState('');
  const controls = useProjectStore((s) => s.doc.controls);
  if (!item || !(item in CONTROL_CATALOG))
    return <Navigate to={`/editor/${themeId}/controls/window`} replace />;
  const current = item as RootControlId;
  const q = query.toLowerCase();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '220px minmax(0, 1fr)',
        minHeight: 'calc(100vh - 52px)',
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
        <Stack gap={1} p="0 8px 12px" style={{ overflow: 'auto' }}>
          {GROUPS.map((g) => {
            const ids = g.ids.filter((id) =>
              controlLabel(id).toLowerCase().includes(q),
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
                  // The dot marks a required control the project hasn't defined yet.
                  const missing = CONTROL_CATALOG[id].required && !controls[id];
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
      <SplitPane side={<PreviewPanel />}>
        <Stack key={current} gap={0} style={{ overflow: 'auto', minWidth: 0 }}>
          <Group gap={12} p="20px 24px 0" wrap="nowrap">
            <div style={{ flex: 1 }}>
              <Title order={2} fz={20}>
                {controlLabel(current)}
              </Title>
              <Text c="dimmed" fz={13}>
                {META[current].description}
              </Text>
            </div>
          </Group>
          <ControlEditor id={current} />
        </Stack>
      </SplitPane>
    </div>
  );
}

/** The editor for one control; each control's port fills in its body. */
function ControlEditor({ id }: { id: RootControlId }) {
  const entry: CatalogEntry = CONTROL_CATALOG[id];
  const states = ['default', ...(entry.states ?? [])];
  const [state, setState] = useState(states[0]);
  return (
    <>
      {states.length > 1 && (
        <Tabs
          value={state}
          onChange={(v) => setState(v ?? 'default')}
          p="16px 24px 0"
        >
          <Tabs.List>
            {states.map((s) => (
              <Tabs.Tab key={s} value={s}>
                {controlLabel(s)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <Stack gap={16} p="20px 24px">
        {/* ponytail: placeholder until this control is ported from main. */}
        <Card shadow="xs">
          <Group gap={8} mb={8}>
            <Text fw={600}>Not built yet</Text>
            <Badge variant="light" color="gray" size="sm" tt="none" fw={400}>
              {entry.kind}
            </Badge>
            {entry.required && (
              <Badge
                variant="light"
                color="orange"
                size="sm"
                tt="none"
                fw={400}
              >
                required
              </Badge>
            )}
          </Group>
          <Text fz={13} c="dimmed">
            {entry.parts
              ? `Parts: ${Object.entries(entry.parts)
                  .map(([name, p]) => `${name} (${p.kind})`)
                  .join(', ')}.`
              : 'No parts.'}
          </Text>
        </Card>
      </Stack>
    </>
  );
}

function PreviewPanel() {
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
        <Switch label="Show boxes" size="xs" defaultChecked disabled />
      </Group>
      <Text fz={12} c="dimmed" p={16}>
        Isolated and in-context previews arrive with each control.
      </Text>
    </div>
  );
}
