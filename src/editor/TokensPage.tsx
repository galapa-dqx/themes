import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  ColorSwatch,
  Group,
  NavLink,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconChevronDown,
  IconInfoCircle,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import { AssetsPage } from './AssetsPage';
import { ColorField } from './ColorField';
import { FontsPage } from './FontsPage';
import { TypographyPage } from './TypographyPage';
import { useProjectStore } from './projectStore';
import { Heading, NameInput, RowMenu, UsedBy } from './tokensShared';
import { EMPTY, mono, useRename } from './tokensUtil';
import {
  describeColor,
  freeName,
  replaceReferences,
  TOKEN_NAME,
  tokenView,
  type TokenView,
} from './tokenView';

const CATEGORIES = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'assets', label: 'Assets' },
] as const;
type Category = (typeof CATEGORIES)[number]['id'];

export function TokensPage() {
  const [category, setCategory] = useState<Category>('colors');
  const doc = useProjectStore((s) => s.doc);
  const view = useMemo(() => tokenView(doc), [doc]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        height: 'calc(100vh - 52px)',
      }}
    >
      <Stack
        gap={2}
        p="12px 8px"
        style={{ borderRight: '1px solid var(--mantine-color-default-border)' }}
      >
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
          Tokens
        </Text>
        {CATEGORIES.map((c) => (
          <NavLink
            key={c.id}
            label={c.label}
            active={c.id === category}
            onClick={() => setCategory(c.id)}
            variant="light"
            fw={c.id === category ? 600 : undefined}
            style={{ borderRadius: 'var(--mantine-radius-sm)' }}
            py={7}
          />
        ))}
      </Stack>
      {category === 'fonts' && <FontsPage view={view} />}
      {category === 'typography' && <TypographyPage view={view} />}
      {category === 'assets' && <AssetsPage view={view} />}
      {category === 'colors' && (
        <Stack gap={16} p="20px 24px" style={{ overflow: 'auto', minWidth: 0 }}>
          <Colors rows={view.colors} />
        </Stack>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- colors (4f)

// Columns shrink before the card scrolls; the value column never exceeds 360px.
const COLOR_COLUMNS =
  '32px minmax(90px, 130px) minmax(140px, 360px) minmax(90px, 1fr) 24px';
const row = (extra?: React.CSSProperties): React.CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: COLOR_COLUMNS,
  alignItems: 'center',
  gap: 10,
  padding: '8px 14px',
  borderBottom: '1px solid var(--mantine-color-default-border)',
  fontSize: 13,
  ...extra,
});

function Colors({ rows }: { rows: TokenView['colors'] }) {
  const edit = useProjectStore((s) => s.edit);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const [draft, setDraft] = useState<{
    name: string;
    value?: TokenView['colors'][number]['value'];
  }>();
  const { renaming, setRenaming, commit } = useRename('colors');
  const taken = (n: string) => n in colors;
  // Saves once named: a valid, unused name commits on Enter or blur; Esc or the trash discards.
  const add = () => {
    if (!draft?.name || !TOKEN_NAME.test(draft.name) || taken(draft.name))
      return;
    const value = draft.value ?? '#888888';
    edit(
      'Add color',
      (d) => void ((d.tokens.colors ??= {})[draft.name] = value),
    );
    setDraft(undefined);
  };
  // The row swatch keeps the last resolvable color while a token is in error.
  const [lastGood] = useState(() => new Map<string, string>());
  for (const r of rows)
    if (r.resolved.value) lastGood.set(r.name, r.resolved.value);

  return (
    <>
      <Heading
        title="Colors"
        description="Same field as in Controls. A token may be a picked color or a mix of other tokens."
        action={
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setDraft({ name: '' })}
          >
            Add color
          </Button>
        }
      />
      <Card shadow="xs" padding={0} style={{ overflowX: 'auto' }}>
        <div
          style={row({
            padding: '10px 14px',
            fontSize: 11,
            fontWeight: 600,
            color: 'var(--mantine-color-dimmed)',
            textTransform: 'uppercase',
            letterSpacing: 0.4,
          })}
        >
          <span />
          <span>Token</span>
          <span>Value</span>
          <span>Used by</span>
          <span />
        </div>
        {draft && (
          <div style={row({ background: 'var(--mantine-color-blue-light)' })}>
            <ColorSwatch
              color={
                (draft.value &&
                  describeColor(draft.value).startsWith('#') &&
                  describeColor(draft.value)) ||
                'transparent'
              }
              size={28}
              radius={6}
              withShadow={false}
              style={{ border: '1px dashed var(--mantine-color-gray-5)' }}
            />
            <div style={{ minWidth: 0 }}>
              <NameInput
                value={draft.name}
                onChange={(name) => setDraft({ ...draft, name })}
                taken={taken}
                onSubmit={add}
                onBlur={add}
                onCancel={() => setDraft(undefined)}
              />
            </div>
            <div style={{ minWidth: 0 }}>
              <ColorField
                value={draft.value ?? '#888888'}
                colors={colors}
                onChange={(value) => setDraft({ ...draft, value })}
              >
                <UnstyledButton
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '5px 10px',
                    border: '1px solid var(--mantine-color-default-border)',
                    borderRadius: 4,
                    background: 'var(--mantine-color-body)',
                    fontFamily: 'var(--mantine-font-family-monospace)',
                    fontSize: 12,
                    width: '100%',
                    color: draft.value
                      ? undefined
                      : 'var(--mantine-color-dimmed)',
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {draft.value
                      ? describeColor(draft.value)
                      : 'Pick a color or token…'}
                  </span>
                  <IconChevronDown size={15} />
                </UnstyledButton>
              </ColorField>
            </div>
            <Text fz={11} c="dimmed">
              Saves once named · Esc to discard
            </Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              onClick={() => setDraft(undefined)}
              aria-label="Discard"
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        )}
        {rows.map((r) => (
          <div key={r.name} style={row()}>
            <ColorSwatch
              color={r.resolved.value ?? lastGood.get(r.name) ?? 'transparent'}
              size={28}
              radius={6}
              withShadow={false}
              style={{
                border: '1px solid var(--mantine-color-default-border)',
              }}
            />
            {renaming?.from === r.name ? (
              <div style={{ minWidth: 0 }}>
                <NameInput
                  value={renaming.to}
                  onChange={(to) => setRenaming({ ...renaming, to })}
                  taken={(n) => n !== r.name && taken(n)}
                  onSubmit={commit}
                  onCancel={() => setRenaming(undefined)}
                />
              </div>
            ) : (
              <Text {...mono} truncate>
                {r.name}
              </Text>
            )}
            <Stack gap={4} style={{ minWidth: 0 }}>
              <ColorField
                value={r.value}
                colors={colors}
                exclude={r.name}
                withSwatch={false}
                error={r.resolved.error}
                onChange={(v) =>
                  edit(
                    `Edit ${r.name}`,
                    (d) => void (d.tokens.colors![r.name] = v),
                  )
                }
              />
              {r.resolved.error && (
                <Text c="red.7" fz={11} truncate>
                  {r.resolved.error}
                  {r.resolved.error.startsWith('Cycle') && lastGood.has(r.name)
                    ? '. Last valid value kept.'
                    : ''}
                </Text>
              )}
            </Stack>
            <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
            <RowMenu
              used={r.used}
              usedByControls={r.usedBy.length}
              onRename={() => setRenaming({ from: r.name, to: r.name })}
              onDuplicate={() =>
                edit(
                  `Duplicate ${r.name}`,
                  (d) =>
                    void (d.tokens.colors![freeName(d.tokens.colors!, r.name)] =
                      r.value),
                )
              }
              flatten={
                r.resolved.value &&
                (typeof r.value !== 'string' || r.value.startsWith('{'))
                  ? {
                      hex: r.resolved.value,
                      onFlatten: () =>
                        edit(
                          `Flatten ${r.name}`,
                          (d) =>
                            void (d.tokens.colors![r.name] = r.resolved.value!),
                        ),
                    }
                  : undefined
              }
              replace={{
                options: rows.map((x) => x.name).filter((n) => n !== r.name),
                onReplace: (to) =>
                  edit(`Replace ${r.name}`, (d) =>
                    replaceReferences(d, 'colors', r.name, to),
                  ),
              }}
              onDelete={() =>
                edit(
                  `Delete ${r.name}`,
                  (d) => void delete d.tokens.colors![r.name],
                )
              }
            />
          </div>
        ))}
        {rows.length === 0 && !draft && (
          <Text p={16} c="dimmed" fz={13}>
            No colors yet.
          </Text>
        )}
      </Card>
      <Group gap={6} fz={12} c="dimmed" wrap="nowrap">
        <IconInfoCircle size={14} style={{ flex: 'none' }} />
        Row swatch shows the resolved color; the field shows its source. Mix
        references that form a cycle are flagged inline and the last valid value
        stays in effect until fixed.
      </Group>
    </>
  );
}

// ---------------------------------------------------------------- typography (4g)
