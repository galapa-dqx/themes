/**
 * The kind-driven editor for one root control: state tabs (a dot marks
 * states with overrides), one card per node in catalog order, and the 4b
 * footer (Reset to Default state / Copy state…).
 */
import type { ComponentType, ReactNode } from 'react';
import { Alert, Button, Group, Menu, Stack, Tabs, Text } from '@mantine/core';
import { IconChevronDown, IconPlus } from '@tabler/icons-react';
import type {
  CatalogEntry,
  ControlKind,
  ControlState,
  RootControlId,
} from '@/theme/catalog';
import { statesOf, type StateName } from '@/editor/preview/resolve';
import { controlLabel, EMPTY } from '@/editor/tokensUtil';
import {
  FocusRingCard,
  FrameCard,
  ImageCard,
  PaintCard,
  TextCard,
  VariantImageCard,
  WindowCard,
  type CardProps,
} from './cards';
import { CONTROLS } from './registry';
import { useControlEdit, type PartPath, type Raw } from './useControlEdit';

const CARDS: Partial<Record<ControlKind, ComponentType<CardProps>>> = {
  frame: FrameCard,
  text: TextCard,
  paint: PaintCard,
  image: ImageCard,
  'variant-image': VariantImageCard,
  window: WindowCard,
  'focus-ring': FocusRingCard,
};
const TITLES: Partial<Record<ControlKind, string>> = {
  frame: 'Box',
  window: 'Window',
  'focus-ring': 'Ring',
};

/** Whether any node of the control overrides `state`. */
const overrides = (raw: Raw, state: ControlState): boolean =>
  (raw.states as Raw | undefined)?.[state] !== undefined ||
  Object.values((raw.parts as Record<string, Raw> | undefined) ?? {}).some(
    (p) => overrides(p, state),
  );

export function ControlEditor({
  id,
  state,
  onState,
}: {
  id: RootControlId;
  /** The active state tab, owned by the page so the preview can mark it. */
  state: StateName;
  onState(state: StateName): void;
}) {
  const edit = useControlEdit(id);
  const { entry } = edit;
  const states: StateName[] = ['default', ...statesOf(entry)];
  const missing = edit.raw === EMPTY;
  const Extra = CONTROLS[id]?.Fields;

  const cards = (
    e: CatalogEntry,
    path: PartPath,
    title: string,
  ): ReactNode[] => {
    const Card = CARDS[e.kind];
    const own = e.kind === 'composite' ? undefined : (e.states ?? []);
    const applies = state === 'default' || own?.includes(state);
    return [
      Card && applies ? (
        <Card
          key={path.join('.') || 'root'}
          path={path}
          entry={e}
          state={state}
          edit={edit}
          title={title}
        />
      ) : Card && !applies ? (
        <Text key={path.join('.') || 'root'} fz={12} c="dimmed">
          {title} · inherits Default
        </Text>
      ) : null,
      ...Object.entries(e.parts ?? {}).flatMap(([name, part]) =>
        cards(part, [...path, name], controlLabel(name)),
      ),
    ];
  };

  return (
    <>
      {states.length > 1 && (
        <Tabs
          value={state}
          onChange={(v) => onState((v as StateName) ?? 'default')}
          p="16px 24px 0"
        >
          <Tabs.List>
            {states.map((s) => (
              <Tabs.Tab
                key={s}
                value={s}
                rightSection={
                  s !== 'default' && overrides(edit.raw, s) ? (
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
              >
                {controlLabel(s)}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <Stack gap={16} p="20px 24px">
        {missing && (
          <Alert color="orange" variant="light" p="xs">
            <Group gap={12} wrap="nowrap">
              <Text fz={13} style={{ flex: 1 }}>
                {entry.required
                  ? 'This required control is not in the project yet.'
                  : 'Not in the project yet.'}{' '}
                Editing any field creates it.
              </Text>
              <Button
                size="xs"
                variant="light"
                color="orange"
                leftSection={<IconPlus size={13} />}
                onClick={edit.create}
              >
                Create from defaults
              </Button>
            </Group>
          </Alert>
        )}
        {cards(entry, [], TITLES[entry.kind] ?? controlLabel(id))}
        {Extra && <Extra id={id} state={state} />}
        {state !== 'default' && (
          <Group gap={8}>
            <Button
              size="xs"
              variant="default"
              disabled={!overrides(edit.raw, state)}
              onClick={() => edit.resetState(state)}
            >
              Reset to Default state
            </Button>
            <Menu position="bottom-start" shadow="md">
              <Menu.Target>
                <Button
                  size="xs"
                  variant="default"
                  rightSection={<IconChevronDown size={13} />}
                >
                  Copy state…
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Label>Copy {controlLabel(state)} overrides to</Menu.Label>
                {states
                  .filter(
                    (s): s is ControlState => s !== 'default' && s !== state,
                  )
                  .map((s) => (
                    <Menu.Item key={s} onClick={() => edit.copyState(state, s)}>
                      {controlLabel(s)}
                    </Menu.Item>
                  ))}
              </Menu.Dropdown>
            </Menu>
            <Text fz={12} c="dimmed">
              Overrides in orange
            </Text>
          </Group>
        )}
      </Stack>
    </>
  );
}
