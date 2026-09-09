import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Button,
  Card,
  ColorSwatch,
  Group,
  Menu,
  NavLink,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowsExchange,
  IconChevronDown,
  IconChevronRight,
  IconColorPicker,
  IconComponents,
  IconCopy,
  IconDots,
  IconFocus2,
  IconInfoCircle,
  IconLink,
  IconPencil,
  IconPlus,
  IconTrash,
} from '@tabler/icons-react';
import type { RootControlId } from '@/theme/catalog';
import { ColorField } from './ColorField';
import { OverflowChips } from './OverflowChips';
import { useProjectStore } from './projectStore';
import {
  describeColor,
  fontLabel,
  freeName,
  renameToken,
  replaceReferences,
  TOKEN_NAME,
  tokenView,
  type TokenCategory,
  type TokenView,
} from './tokenView';
import { TypographyPanel, type TypographyValue } from './TypographyPanel';

const CATEGORIES = [
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'assets', label: 'Assets' },
] as const;
type Category = (typeof CATEGORIES)[number]['id'];

const mono = { ff: 'monospace', fz: 12 } as const;
// Selectors must return a stable reference; a fresh `{}` per call re-renders forever.
const EMPTY: Record<string, never> = Object.freeze({});
const controlLabel = (id: string) =>
  id.charAt(0).toUpperCase() + id.slice(1).replaceAll('-', ' ');

export function TokensPage() {
  const [category, setCategory] = useState<Category>('colors');
  const doc = useProjectStore((s) => s.doc);
  const view = useMemo(() => tokenView(doc), [doc]);
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '180px minmax(0, 1fr)',
        minHeight: 'calc(100vh - 52px)',
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
      <Stack gap={16} p="20px 24px" style={{ overflow: 'auto', minWidth: 0 }}>
        {category === 'colors' && <Colors rows={view.colors} />}
        {category === 'typography' && <Typography rows={view.typography} />}
        {category === 'fonts' && (
          <Sources
            title="Fonts"
            description="Font files and Google Fonts references."
            rows={view.fonts}
          />
        )}
        {category === 'assets' && (
          <Sources
            title="Assets"
            description="SVG files referenced by controls."
            rows={view.assets}
          />
        )}
      </Stack>
    </div>
  );
}

function Heading({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <Group gap={12} wrap="nowrap">
      <div style={{ flex: 1 }}>
        <Title order={2} fz={20}>
          {title}
        </Title>
        <Text c="dimmed" fz={13}>
          {description}
        </Text>
      </div>
      {action}
    </Group>
  );
}

const Chip = ({
  icon,
  children,
  token,
}: {
  icon: ReactNode;
  children: ReactNode;
  token?: boolean;
}) => (
  <Badge
    variant="light"
    color={token ? 'blue' : 'gray'}
    size="sm"
    tt="none"
    fw={400}
    ff={token ? 'monospace' : undefined}
    leftSection={icon}
  >
    {children}
  </Badge>
);

/** 4f "Used by": control and token chips, collapsing to `+N` only when the column runs out of room. */
function UsedBy({
  controls,
  tokens,
}: {
  controls: RootControlId[];
  tokens: string[];
}) {
  if (controls.length === 0 && tokens.length === 0)
    return (
      <Text fz={11} c="dimmed">
        Not used yet
      </Text>
    );
  const controlChips = controls.map((id) => (
    <Chip key={`c:${id}`} icon={<IconComponents size={11} />}>
      {controlLabel(id)}
    </Chip>
  ));
  const tokenChips = tokens.map((t) => (
    <Chip key={`t:${t}`} icon={<IconLink size={11} />} token>
      {t.replace(/^[a-z]+\./, '')}
    </Chip>
  ));
  // Alternate kinds so neither monopolises the visible chips before the `+N`.
  const chips: ReactNode[] = [];
  const kinds: ('control' | 'token')[] = [];
  for (let k = 0; k < Math.max(controlChips.length, tokenChips.length); k++) {
    if (controlChips[k]) {
      chips.push(controlChips[k]);
      kinds.push('control');
    }
    if (tokenChips[k]) {
      chips.push(tokenChips[k]);
      kinds.push('token');
    }
  }
  return (
    <OverflowChips
      chips={chips}
      overflow={(visible) => {
        const hidden = kinds.slice(visible);
        const c = hidden.filter((k) => k === 'control').length;
        const t = hidden.length - c;
        return (
          <span style={{ display: 'inline-flex', gap: 4 }}>
            {c > 0 && <Chip icon={<IconComponents size={11} />}>+{c}</Chip>}
            {t > 0 && (
              <Chip icon={<IconLink size={11} />} token>
                +{t}
              </Chip>
            )}
          </span>
        );
      }}
    />
  );
}

/** A token name being typed: valid, unique, kebab-case. */
function NameInput({
  value,
  onChange,
  taken,
  onSubmit,
  onBlur,
  onCancel,
}: {
  value: string;
  onChange(v: string): void;
  taken: (name: string) => boolean;
  onSubmit(): void;
  onBlur?(): void;
  onCancel(): void;
}) {
  const error = !value
    ? undefined
    : !TOKEN_NAME.test(value)
      ? 'lowercase letters, digits, dashes'
      : taken(value)
        ? 'already exists'
        : undefined;
  return (
    <TextInput
      size="xs"
      styles={{
        input: {
          fontFamily: 'var(--mantine-font-family-monospace)',
          fontSize: 12,
        },
      }}
      value={value}
      error={error}
      autoFocus
      onChange={(e) => onChange(e.target.value)}
      onBlur={() => value && !error && onBlur?.()}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && value && !error) onSubmit();
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
}

/** The 4f row menu. `flatten` and `replace` are omitted where they don't apply. */
function RowMenu({
  used,
  usedByControls,
  onRename,
  onDuplicate,
  flatten,
  replace,
  onDelete,
}: {
  used: number;
  usedByControls: number;
  onRename(): void;
  onDuplicate(): void;
  /** Resolved hex to flatten a reference or mix into; omit for literals. */
  flatten?: { hex: string; onFlatten(): void };
  /** Other tokens this one's uses can be repointed to. */
  replace?: { options: string[]; onReplace(name: string): void };
  onDelete(): void;
}) {
  const hint = (text: ReactNode) => (
    <Text span fz={11} c="dimmed">
      {text}
    </Text>
  );
  return (
    <Menu position="bottom-end" shadow="md" width={240}>
      <Menu.Target>
        <ActionIcon variant="subtle" color="gray" size="sm" aria-label="More">
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item leftSection={<IconPencil size={16} />} onClick={onRename}>
          Rename…
        </Menu.Item>
        <Menu.Item leftSection={<IconCopy size={16} />} onClick={onDuplicate}>
          Duplicate
        </Menu.Item>
        {/* ponytail: enabled once the Controls page can show a token's uses. */}
        <Menu.Item
          leftSection={<IconFocus2 size={16} />}
          rightSection={hint(usedByControls)}
          disabled
        >
          Find uses
        </Menu.Item>
        {(flatten || replace) && <Menu.Divider />}
        {flatten && (
          <Menu.Item
            leftSection={<IconColorPicker size={16} />}
            rightSection={hint(flatten.hex.toUpperCase())}
            onClick={flatten.onFlatten}
          >
            Flatten to picked color
          </Menu.Item>
        )}
        {replace && replace.options.length > 0 && (
          <Menu.Sub>
            <Menu.Sub.Target>
              <Menu.Sub.Item leftSection={<IconArrowsExchange size={16} />}>
                Replace with…
              </Menu.Sub.Item>
            </Menu.Sub.Target>
            <Menu.Sub.Dropdown>
              {replace.options.map((n) => (
                <Menu.Item
                  key={n}
                  ff="monospace"
                  fz={12}
                  onClick={() => replace.onReplace(n)}
                >
                  {n}
                </Menu.Item>
              ))}
            </Menu.Sub.Dropdown>
          </Menu.Sub>
        )}
        <Menu.Divider />
        <Menu.Item
          leftSection={<IconTrash size={16} />}
          color="red"
          disabled={used > 0}
          rightSection={used > 0 ? hint('in use') : undefined}
          onClick={onDelete}
        >
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}

const useRename = (category: TokenCategory) => {
  const edit = useProjectStore((s) => s.edit);
  const [renaming, setRenaming] = useState<{ from: string; to: string }>();
  const commit = () => {
    if (renaming && renaming.to && renaming.to !== renaming.from)
      edit(`Rename ${renaming.from}`, (d) =>
        renameToken(d, category, renaming.from, renaming.to),
      );
    setRenaming(undefined);
  };
  return { renaming, setRenaming, commit };
};

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

function Typography({ rows }: { rows: TokenView['typography'] }) {
  const edit = useProjectStore((s) => s.edit);
  const fonts = useProjectStore((s) => s.doc.tokens.fonts ?? EMPTY);
  const typography = useProjectStore((s) => s.doc.tokens.typography ?? EMPTY);
  const [open, setOpen] = useState<string>();
  const { renaming, setRenaming, commit } = useRename('typography');
  const add = () => {
    const name = freeName(typography, 'style');
    edit(
      'Add style',
      (d) => void ((d.tokens.typography ??= {})[name] = { fontSize: 14 }),
    );
    setOpen(name);
  };
  const parentOf = (v: TypographyValue) => {
    const name = v.$extends?.slice(12, -1);
    return name ? rows.find((r) => r.name === name)?.resolved.value : undefined;
  };
  return (
    <>
      <Heading
        title="Typography"
        description="Each token is a collapsed row; expanding it shows the editor. Tokens can extend another token."
        action={
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={add}>
            Add style
          </Button>
        }
      />
      <Stack gap={10}>
        {rows.map((r) => {
          const expanded = open === r.name;
          const value = r.value as TypographyValue;
          const parentName = value.$extends?.slice(12, -1);
          const overrides = Object.keys(value).filter(
            (k) => k !== '$extends',
          ).length;
          const t = r.resolved.value;
          return (
            <div
              key={r.name}
              style={{
                border: `1px solid ${expanded ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-default-border)'}`,
                borderRadius: 4,
                overflow: 'hidden',
                boxShadow: expanded
                  ? '0 0 0 2px rgba(34,139,230,.2)'
                  : undefined,
              }}
            >
              <Group
                gap={8}
                px={12}
                py={8}
                wrap="nowrap"
                bg="light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-6))"
                style={{
                  fontFamily: 'var(--mantine-font-family-monospace)',
                  fontSize: 12,
                }}
              >
                <UnstyledButton
                  onClick={() => setOpen(expanded ? undefined : r.name)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flex: 1,
                    minWidth: 0,
                    font: 'inherit',
                  }}
                >
                  {expanded ? (
                    <IconChevronDown
                      size={16}
                      color="var(--mantine-color-dimmed)"
                    />
                  ) : (
                    <IconChevronRight
                      size={16}
                      color="var(--mantine-color-dimmed)"
                    />
                  )}
                  {renaming?.from === r.name ? (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{ width: 160 }}
                    >
                      <NameInput
                        value={renaming.to}
                        onChange={(to) => setRenaming({ ...renaming, to })}
                        taken={(n) => n !== r.name && n in typography}
                        onSubmit={commit}
                        onCancel={() => setRenaming(undefined)}
                      />
                    </div>
                  ) : (
                    r.name
                  )}
                  {parentName && (
                    <Text span c="dimmed" fz={12}>
                      extends {parentName}
                    </Text>
                  )}
                  {parentName && overrides > 0 && (
                    <Text span c="orange.6" fz={12}>
                      +{overrides}
                    </Text>
                  )}
                  <span style={{ flex: 1 }} />
                  {t ? (
                    <span
                      style={{
                        fontFamily: t.font
                          ? `'${fontLabel(t.font)}', sans-serif`
                          : undefined,
                        fontWeight: t.fontWeight,
                        fontStyle: t.fontStyle,
                        fontSize: Math.min(t.fontSize ?? 14, 24),
                        letterSpacing: t.letterSpacing,
                        textTransform:
                          t.textCase === 'none' ? undefined : t.textCase,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      The quick brown fox
                    </span>
                  ) : (
                    <Text span c="red" fz={11}>
                      {r.resolved.error}
                    </Text>
                  )}
                  <Text span c="dimmed" fz={11} ml={8}>
                    ×{r.used}
                  </Text>
                </UnstyledButton>
                <RowMenu
                  used={r.used}
                  usedByControls={r.usedBy.length}
                  onRename={() => setRenaming({ from: r.name, to: r.name })}
                  onDuplicate={() =>
                    edit(
                      `Duplicate ${r.name}`,
                      (d) =>
                        void (d.tokens.typography![
                          freeName(d.tokens.typography!, r.name)
                        ] = r.value),
                    )
                  }
                  replace={{
                    options: rows
                      .map((x) => x.name)
                      .filter((n) => n !== r.name),
                    onReplace: (to) =>
                      edit(`Replace ${r.name}`, (d) =>
                        replaceReferences(d, 'typography', r.name, to),
                      ),
                  }}
                  onDelete={() =>
                    edit(
                      `Delete ${r.name}`,
                      (d) => void delete d.tokens.typography![r.name],
                    )
                  }
                />
              </Group>
              {expanded && (
                <TypographyPanel
                  value={value}
                  parent={parentOf(value)}
                  fonts={fonts}
                  extendsOptions={rows
                    .map((x) => x.name)
                    .filter((n) => n !== r.name)}
                  onChange={(next) =>
                    edit(
                      `Edit ${r.name}`,
                      (d) => void (d.tokens.typography![r.name] = next),
                    )
                  }
                />
              )}
            </div>
          );
        })}
        {rows.length === 0 && (
          <Text c="dimmed" fz={13}>
            No text styles yet.
          </Text>
        )}
      </Stack>
    </>
  );
}

// ---------------------------------------------------------------- fonts & assets

function Sources({
  title,
  description,
  rows,
}: {
  title: string;
  description: string;
  rows: TokenView['fonts'];
}) {
  return (
    <>
      <Heading title={title} description={description} />
      <Card shadow="xs" padding={0}>
        <Table verticalSpacing={12} horizontalSpacing={16} fz={12}>
          <Table.Thead>
            <Table.Tr>
              <Table.Th w={150}>Token</Table.Th>
              <Table.Th>Source</Table.Th>
              <Table.Th w={150}>Used by</Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {rows.map((r) => (
              <Table.Tr key={r.name}>
                <Table.Td {...mono}>{r.name}</Table.Td>
                <Table.Td {...mono} c={r.resolved.error ? 'red' : undefined}>
                  {r.resolved.error ?? r.value}
                  {r.resolved.value && r.resolved.value !== r.value && (
                    <Text span c="dimmed" {...mono}>
                      {' '}
                      → {r.resolved.value}
                    </Text>
                  )}
                </Table.Td>
                <Table.Td>
                  <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
        {rows.length === 0 && (
          <Text p={16} c="dimmed" fz={13}>
            Nothing here yet.
          </Text>
        )}
      </Card>
    </>
  );
}
