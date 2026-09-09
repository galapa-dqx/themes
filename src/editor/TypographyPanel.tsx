/**
 * The 3c/4g typography editor: one row per field, seeded from the parent
 * (an extended token) with overridden rows marked orange and resettable.
 */
import {
  ActionIcon,
  Button,
  Group,
  NumberInput,
  Select,
  Text,
  Tooltip,
} from '@mantine/core';
import { IconArrowBackUp, IconLink } from '@tabler/icons-react';
import type { Static } from 'typebox';
import type { Typography } from '@/compiler/tokens';
import type { ProjectTokens, ProjectTypographyDisplay } from '@/theme/schema';
import { fontLabel } from './tokenView';

export type TypographyValue = Static<typeof ProjectTypographyDisplay>;
type Fonts = NonNullable<ProjectTokens['fonts']>;

const FIELDS = [
  { key: 'font', label: 'Family' },
  { key: 'fontSize', label: 'Size', step: 1, min: 1 },
  { key: 'fontWeight', label: 'Weight', step: 100, min: 1, max: 1000 },
  { key: 'lineHeight', label: 'Line height', step: 0.1, min: 0.1 },
  { key: 'letterSpacing', label: 'Letter spacing', step: 0.1 },
  { key: 'textCase', label: 'Transform' },
] as const;
type FieldKey = (typeof FIELDS)[number]['key'];

const orange = {
  input: {
    borderColor: 'var(--mantine-color-orange-5)',
    background: 'var(--mantine-color-orange-0)',
  },
};
const mono = {
  input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 },
};

export interface TypographyPanelProps {
  value: TypographyValue;
  onChange(next: TypographyValue): void;
  /** Resolved values of the extended token, when there is one. */
  parent: Typography | undefined;
  fonts: Fonts;
  /** Choices for the Extends row; omit the row entirely when undefined. */
  extendsOptions?: string[];
}

export function TypographyPanel({
  value,
  onChange,
  parent,
  fonts,
  extendsOptions,
}: TypographyPanelProps) {
  const set = (key: FieldKey, v: unknown) => {
    const next = { ...value } as Record<string, unknown>;
    if (v === undefined || v === '' || v === null) delete next[key];
    else next[key] = v;
    onChange(next as TypographyValue);
  };
  const overridden = (key: FieldKey) =>
    parent !== undefined && value[key] !== undefined;
  const ownCount = FIELDS.filter((f) => value[f.key] !== undefined).length;
  const fontData = Object.keys(fonts)
    .sort()
    .map((n) => ({
      value: `{fonts.${n}}`,
      label: `${n} · ${fontLabel(fonts[n])}`,
    }));
  const fontValue = value.font ?? parent?.font;
  if (fontValue && !fontData.some((d) => d.value === fontValue))
    fontData.push({ value: fontValue, label: fontLabel(fontValue) });

  return (
    <div>
      {extendsOptions && (
        <Group
          gap={8}
          px={12}
          py={8}
          fz={12}
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <Text c="dimmed" fz={12}>
            Extends
          </Text>
          <Select
            size="xs"
            w={200}
            clearable
            placeholder="none"
            leftSection={<IconLink size={13} />}
            styles={mono}
            data={extendsOptions}
            value={value.$extends ? value.$extends.slice(12, -1) : null}
            onChange={(v) =>
              set('$extends' as FieldKey, v ? `{typography.${v}}` : undefined)
            }
          />
          <Text c="dimmed" fz={11}>
            or none for a root token
          </Text>
          <div style={{ flex: 1 }} />
          {parent && ownCount > 0 && (
            <Button
              variant="subtle"
              color="orange"
              size="xs"
              onClick={() => onChange({ $extends: value.$extends })}
            >
              Reset all
            </Button>
          )}
        </Group>
      )}
      <div
        style={{
          padding: '10px 12px 12px',
          display: 'grid',
          gridTemplateColumns: '100px 1fr 24px',
          gap: '6px 10px',
          alignItems: 'center',
          fontSize: 12,
          borderTop: '1px solid var(--mantine-color-default-border)',
        }}
      >
        {FIELDS.map((f) => {
          const own = value[f.key];
          const inherited = parent?.[f.key];
          const over = overridden(f.key);
          const styles = {
            input: { ...mono.input, ...(over ? orange.input : {}) },
          };
          const struck =
            over && inherited !== undefined ? (
              <Text
                span
                c="dimmed"
                fz={11}
                td="line-through"
                pr={8}
                style={{ pointerEvents: 'none' }}
              >
                {f.key === 'font'
                  ? fontLabel(String(inherited))
                  : String(inherited)}
              </Text>
            ) : undefined;
          return (
            <FieldRow
              key={f.key}
              label={f.label}
              reset={over ? () => set(f.key, undefined) : undefined}
            >
              {f.key === 'font' ? (
                <Select
                  size="xs"
                  clearable
                  placeholder="inherit"
                  styles={styles}
                  data={fontData}
                  value={fontValue ?? null}
                  onChange={(v) => set('font', v ?? undefined)}
                  rightSection={struck}
                  rightSectionWidth={struck ? 'auto' : undefined}
                />
              ) : f.key === 'textCase' ? (
                <Select
                  size="xs"
                  clearable
                  placeholder="none"
                  styles={styles}
                  data={['none', 'uppercase', 'lowercase']}
                  value={(own ?? inherited ?? null) as string | null}
                  onChange={(v) => set('textCase', v ?? undefined)}
                  rightSection={struck}
                  rightSectionWidth={struck ? 'auto' : undefined}
                />
              ) : (
                <NumberInput
                  size="xs"
                  hideControls
                  styles={styles}
                  step={f.step}
                  min={'min' in f ? f.min : undefined}
                  max={'max' in f ? f.max : undefined}
                  value={(own ?? inherited ?? '') as number | ''}
                  onChange={(v) =>
                    set(f.key, typeof v === 'number' ? v : undefined)
                  }
                  rightSection={struck}
                  rightSectionWidth={struck ? 'auto' : undefined}
                />
              )}
            </FieldRow>
          );
        })}
      </div>
    </div>
  );
}

function FieldRow({
  label,
  reset,
  children,
}: {
  label: string;
  reset?: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <Text c="dimmed" fz={12}>
        {label}
      </Text>
      {children}
      {reset ? (
        <Tooltip label="Reset to parent" position="left">
          <ActionIcon
            size={22}
            radius="xl"
            variant="light"
            color="orange"
            onClick={reset}
            aria-label="Reset to parent"
          >
            <IconArrowBackUp size={13} />
          </ActionIcon>
        </Tooltip>
      ) : (
        <span />
      )}
    </>
  );
}
