import type { ReactNode } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  Menu,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import {
  IconAlertTriangle,
  IconArrowsExchange,
  IconColorPicker,
  IconComponents,
  IconCopy,
  IconDots,
  IconFocus2,
  IconLink,
  IconPencil,
  IconTrash,
} from '@tabler/icons-react';
import type { RootControlId } from '@/theme/catalog';
import { OverflowChips } from './OverflowChips';
import { TOKEN_NAME } from './tokenView';
import { controlLabel } from './tokensUtil';

export function Heading({
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

export const Chip = ({
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
export function UsedBy({
  controls,
  tokens,
}: {
  controls: RootControlId[];
  tokens: string[];
}) {
  if (controls.length === 0 && tokens.length === 0)
    return (
      <Badge
        variant="light"
        color="orange"
        size="sm"
        tt="none"
        fw={400}
        leftSection={<IconAlertTriangle size={11} />}
      >
        Unused
      </Badge>
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
export function NameInput({
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
export function RowMenu({
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
