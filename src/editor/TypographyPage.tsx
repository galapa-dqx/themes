/**
 * 4g: the Typography tokens table, samples rendered in the real font, with
 * the 3c editor in the right-hand panel for the selected row.
 */
import { useState, type CSSProperties, type ReactNode } from 'react';
import { Button, Card, Group, Stack, Text } from '@mantine/core';
import { IconInfoCircle, IconLink, IconPlus } from '@tabler/icons-react';
import type { Typography } from '@/compiler/tokens';
import { useProjectStore } from './projectStore';
import { SplitPane } from './SplitPane';
import { Chip, Heading, NameInput, RowMenu, UsedBy } from './tokensShared';
import { EMPTY, mono, useRename } from './tokensUtil';
import {
  fontLabel,
  freeName,
  replaceReferences,
  type TokenView,
} from './tokenView';
import { TypographyPanel, type TypographyValue } from './TypographyPanel';
import { useFontFamily } from './useProjectFile';

type Row = TokenView['typography'][number];
const COLUMNS = '100px minmax(0, 1fr) 150px 110px 20px';
const row = (extra?: CSSProperties): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: COLUMNS,
  alignItems: 'center',
  gap: 10,
  padding: '10px 14px',
  borderBottom: '1px solid var(--mantine-color-default-border)',
  fontSize: 13,
  ...extra,
});
const SAMPLE = 'Astoltia Birthday';
const parentName = (v: TypographyValue) => v.$extends?.slice(12, -1);
const ownKeys = (v: TypographyValue) =>
  Object.keys(v).filter((k) => k !== '$extends');

/** `700 · 22 · ls 0.5 · uppercase`: the resolved values that differ from plain text. */
const summary = (t: Typography) =>
  [
    t.fontWeight ?? 400,
    t.fontSize,
    t.lineHeight !== undefined && t.lineHeight !== 1 && `lh ${t.lineHeight}`,
    t.letterSpacing && `ls ${t.letterSpacing}`,
    t.fontStyle && t.fontStyle !== 'normal' && t.fontStyle,
    t.textCase && t.textCase !== 'none' && t.textCase,
    t.textDecoration?.length && t.textDecoration.join(' '),
  ]
    .filter(Boolean)
    .join(' · ');

/** Text rendered in a resolved style; the font loads through `useFontFamily`. */
function Sample({
  t,
  size,
  style,
}: {
  t: Typography | undefined;
  /** Caps the rendered size so tall styles stay on one row. */
  size?: number;
  style?: CSSProperties;
}) {
  const family = useFontFamily(t?.font);
  if (!t) return null;
  return (
    <span
      style={{
        fontFamily: family ? `'${family}', sans-serif` : 'sans-serif',
        fontWeight: t.fontWeight,
        fontStyle: t.fontStyle,
        fontSize:
          size === undefined ? t.fontSize : Math.min(t.fontSize ?? size, size),
        lineHeight: t.lineHeight ?? 1.1,
        letterSpacing: t.letterSpacing,
        textTransform: t.textCase === 'none' ? undefined : t.textCase,
        textDecoration: t.textDecoration?.join(' '),
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        ...style,
      }}
    >
      {SAMPLE}
    </span>
  );
}

export function TypographyPage({ view }: { view: TokenView }) {
  const [selected, setSelected] = useState<string>();
  const rename = useRename('typography');
  const rows = view.typography;
  const current = rows.find((r) => r.name === selected) ?? rows[0];
  return (
    <SplitPane
      side={
        current ? (
          <Detail
            key={current.name}
            row={current}
            rows={rows}
            onRename={() =>
              rename.setRenaming({ from: current.name, to: current.name })
            }
          />
        ) : (
          <div
            style={{
              borderLeft: '1px solid var(--mantine-color-default-border)',
            }}
          />
        )
      }
    >
      <Stack gap={16} p="20px 24px" style={{ overflow: 'auto', minWidth: 0 }}>
        <Table
          rows={rows}
          selected={current?.name}
          onSelect={setSelected}
          rename={rename}
        />
      </Stack>
    </SplitPane>
  );
}

function Table({
  rows,
  selected,
  onSelect,
  rename: { renaming, setRenaming, commit },
}: {
  rows: Row[];
  selected?: string;
  onSelect(name: string): void;
  rename: ReturnType<typeof useRename>;
}) {
  const edit = useProjectStore((s) => s.edit);
  const typography = useProjectStore((s) => s.doc.tokens.typography ?? EMPTY);
  const add = () => {
    const name = freeName(typography, 'style');
    edit(
      'Add style',
      (d) => void ((d.tokens.typography ??= {})[name] = { fontSize: 14 }),
    );
    onSelect(name);
  };
  return (
    <>
      <Heading
        title="Typography"
        description="Composite text styles: a font token plus weight, style, size, spacing, case and decoration. A token may extend another and override fields."
        action={
          <Button size="xs" leftSection={<IconPlus size={14} />} onClick={add}>
            Add style
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
          <span>Token</span>
          <span>Sample</span>
          <span>Font · extends</span>
          <span>Used by</span>
          <span />
        </div>
        {rows.map((r) => (
          <TableRow
            key={r.name}
            row={r}
            selected={r.name === selected}
            onSelect={() => onSelect(r.name)}
            name={
              renaming?.from === r.name ? (
                <NameInput
                  value={renaming.to}
                  onChange={(to) => setRenaming({ ...renaming, to })}
                  taken={(n) => n !== r.name && n in typography}
                  onSubmit={commit}
                  onCancel={() => setRenaming(undefined)}
                />
              ) : (
                <Text
                  {...mono}
                  fw={r.name === selected ? 600 : undefined}
                  truncate
                >
                  {r.name}
                </Text>
              )
            }
            menu={
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
                  options: rows.map((x) => x.name).filter((n) => n !== r.name),
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
            }
          />
        ))}
        {rows.length === 0 && (
          <Text p={16} c="dimmed" fz={13}>
            No text styles yet.
          </Text>
        )}
      </Card>
      <Group gap={6} fz={12} c="dimmed" wrap="nowrap">
        <IconInfoCircle size={14} style={{ flex: 'none' }} />
        Weight, style and axes offered here are the ones the selected font token
        actually provides.
      </Group>
    </>
  );
}

function TableRow({
  row: r,
  selected,
  onSelect,
  name,
  menu,
}: {
  row: Row;
  selected: boolean;
  onSelect(): void;
  name: ReactNode;
  menu: ReactNode;
}) {
  const t = r.resolved.value;
  const value = r.value as TypographyValue;
  const font = (value.font ?? t?.font)?.slice(7, -1);
  const parent = parentName(value);
  return (
    <div
      style={row({
        background: selected ? 'var(--mantine-color-blue-light)' : undefined,
        cursor: 'pointer',
      })}
      onClick={onSelect}
    >
      <div onClick={(e) => e.stopPropagation()}>{name}</div>
      <Stack gap={4} style={{ minWidth: 0 }}>
        {t ? (
          <Sample t={t} size={22} />
        ) : (
          <Text fz={12} c="red">
            {r.resolved.error}
          </Text>
        )}
        <Text fz={11} c="dimmed" truncate>
          {t ? summary(t) : ''}
        </Text>
      </Stack>
      <Group gap={4} style={{ minWidth: 0 }}>
        {font && (
          <Chip icon={<IconLink size={11} />} token>
            {font}
          </Chip>
        )}
        {parent && (
          <Chip icon={<IconLink size={11} />} token>
            ↳ {parent}
          </Chip>
        )}
      </Group>
      <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
      <div onClick={(e) => e.stopPropagation()}>{menu}</div>
    </div>
  );
}

function Detail({
  row: r,
  rows,
  onRename,
}: {
  row: Row;
  rows: Row[];
  onRename(): void;
}) {
  const edit = useProjectStore((s) => s.edit);
  const fonts = useProjectStore((s) => s.doc.tokens.fonts ?? EMPTY);
  const value = r.value as TypographyValue;
  const parent = parentName(value);
  const parentResolved = parent
    ? rows.find((x) => x.name === parent)?.resolved.value
    : undefined;
  const overrides = parent ? ownKeys(value).length : 0;
  const t = r.resolved.value;
  const fontName = t?.font ? fontLabel(t.font) : undefined;
  const set = (next: TypographyValue) =>
    edit(`Edit ${r.name}`, (d) => void (d.tokens.typography![r.name] = next));
  return (
    <div
      style={{
        borderLeft: '1px solid var(--mantine-color-default-border)',
        background:
          'light-dark(var(--mantine-color-gray-0), var(--mantine-color-dark-7))',
        overflow: 'auto',
        minHeight: 0,
      }}
    >
      <Group
        gap={8}
        wrap="nowrap"
        p="12px 16px"
        style={{
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <Text fw={600} {...mono}>
            {r.name}
          </Text>
          <Text fz={12} c="dimmed">
            {parent ? (
              <>
                extends {parent} ·{' '}
                <Text span c={overrides ? 'orange.6' : 'dimmed'} fz={12}>
                  {overrides} override{overrides === 1 ? '' : 's'}
                </Text>
              </>
            ) : (
              (fontName ?? 'No font')
            )}
          </Text>
        </div>
      </Group>
      <Stack gap={14} p={16} fz={12}>
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--mantine-radius-sm)',
            border: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
            overflow: 'hidden',
          }}
        >
          {t ? (
            <Sample t={t} style={{ whiteSpace: 'normal' }} />
          ) : (
            <Text fz={12} c="red">
              {r.resolved.error}
            </Text>
          )}
        </div>
        <div
          style={{
            borderRadius: 'var(--mantine-radius-sm)',
            border: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
            overflow: 'hidden',
          }}
        >
          <TypographyPanel
            value={value}
            parent={parentResolved}
            fonts={fonts}
            extendsOptions={rows.map((x) => x.name).filter((n) => n !== r.name)}
            onChange={set}
          />
        </div>
        <Text fz={11} c="dimmed" lh={1.5}>
          {parent ? (
            <>
              Grey values come from{' '}
              <Text span {...mono}>
                {parent}
              </Text>
              ; orange are set here.{' '}
            </>
          ) : null}
          {fontName ? (
            <>
              Only weights and styles that{' '}
              <Text span {...mono}>
                {fontName}
              </Text>{' '}
              provides are offered.
            </>
          ) : null}
        </Text>
        <Group gap={8}>
          <Button size="xs" variant="default" onClick={onRename}>
            Rename…
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
