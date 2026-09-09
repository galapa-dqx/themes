/**
 * The shared rows of the control cards (4a/4b): a label column, the field,
 * and a reset arrow when the row is a state override (shown in orange).
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  Button,
  Group,
  NumberInput,
  Popover,
  SegmentedControl,
  Select,
  Text,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconArrowBackUp,
  IconBan,
  IconLink,
  IconTypography,
  IconUpload,
} from '@tabler/icons-react';
import { Link, useParams } from 'react-router';
import type { Static } from 'typebox';
import type { ProjectPaint } from '@/theme/schema';
import { ColorField, type ColorValue } from '@/editor/ColorField';
import { InsetGroup } from '@/editor/InsetGroup';
import type { Box, Side } from '@/editor/nineSlice';
import { writeProjectFile } from '@/editor/persistence';
import type { Corner, Four, Size } from '@/editor/preview/resolve';
import { resolveTypography } from '@/editor/preview/resolve';
import { useProjectStore } from '@/editor/projectStore';
import { runtime } from '@/editor/runtime';
import { EMPTY, safeFileName } from '@/editor/tokensUtil';
import { fontLabel } from '@/editor/tokenView';
import {
  TypographyPanel,
  type TypographyValue,
} from '@/editor/TypographyPanel';

export type Paint = Static<typeof ProjectPaint>;
const CORNERS: Corner[] = ['round', 'bevel', 'scoop', 'notch', 'squircle'];
const mono = {
  input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 },
};
const orange = {
  borderColor: 'var(--mantine-color-orange-5)',
  background: 'var(--mantine-color-orange-0)',
};

/** The card body grid every row lives in. */
export function Rows({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '90px minmax(0, 1fr) 24px',
        gap: '10px 12px',
        alignItems: 'center',
        fontSize: 13,
      }}
    >
      {children}
    </div>
  );
}

export function FieldRow({
  label,
  overridden,
  hint,
  onReset,
  children,
}: {
  label: string;
  /** This state overrides the field: orange label and a reset arrow. */
  overridden?: boolean;
  /** Small text under the field, e.g. the inherited value. */
  hint?: ReactNode;
  onReset?: () => void;
  children: ReactNode;
}) {
  return (
    <>
      <Text
        fz={13}
        c={overridden ? 'orange.7' : 'dimmed'}
        fw={overridden ? 600 : undefined}
        style={{ minWidth: 0, alignSelf: hint ? 'start' : undefined }}
      >
        {label}
      </Text>
      <div style={{ minWidth: 0 }}>
        {children}
        {hint && (
          <Text fz={11} c="dimmed" mt={4}>
            {hint}
          </Text>
        )}
      </div>
      {onReset ? (
        <Tooltip label="Reset to Default state" position="left">
          <ActionIcon
            size={22}
            radius="xl"
            variant="light"
            color="orange"
            onClick={onReset}
            aria-label="Reset to Default state"
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

/** ColorField for optional paints: unset, `'none'` (when allowed), or a colour. */
export function PaintField({
  value,
  onChange,
  allowNone,
  error,
}: {
  value: Paint | undefined;
  onChange(v: Paint | undefined): void;
  allowNone?: boolean;
  error?: string;
}) {
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const first = Object.keys(colors)[0];
  const none = value === 'none';
  // Turning None back off restores the colour it replaced, not a random token.
  const last = useRef<ColorValue | undefined>(undefined);
  const seed = (): ColorValue =>
    last.current ?? (first ? `{colors.${first}}` : '#888888');
  return (
    <Group gap={6} wrap="nowrap">
      {value === undefined || none ? (
        <UnstyledButton
          onClick={() => onChange(seed())}
          style={{
            flex: 1,
            padding: '6px 10px',
            border: `1px solid var(--mantine-color-${error ? 'red-6' : 'default-border'})`,
            borderRadius: 4,
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: 12,
            color: 'var(--mantine-color-dimmed)',
            background: error ? 'var(--mantine-color-red-light)' : undefined,
          }}
        >
          {error ?? (none ? 'none' : 'unset')}
        </UnstyledButton>
      ) : (
        <div style={{ flex: 1, minWidth: 0 }}>
          <ColorField value={value} onChange={onChange} colors={colors} />
        </div>
      )}
      {allowNone && (
        <Tooltip label={none ? 'Pick a color' : 'None'} position="top">
          <ActionIcon
            variant={none ? 'filled' : 'default'}
            color={none ? 'gray' : undefined}
            size={30}
            aria-label="None"
            onClick={() => {
              if (!none && value !== undefined) last.current = value;
              onChange(none ? seed() : 'none');
            }}
          >
            <IconBan size={15} />
          </ActionIcon>
        </Tooltip>
      )}
    </Group>
  );
}

const toBox = (v: number | Four | undefined): Box => {
  const [top, right, bottom, left] =
    typeof v === 'number' ? [v, v, v, v] : (v ?? [0, 0, 0, 0]);
  return { top, right, bottom, left };
};
/** A number when all sides agree, else the four-tuple the schema takes. */
const fromBox = (b: Box): number | Four =>
  b.top === b.right && b.top === b.bottom && b.top === b.left
    ? b.top
    : [b.top, b.right, b.bottom, b.left];

/** 1/2/4-value insets (thickness, padding) over the nine-slice InsetGroup. */
export function InsetField({
  value,
  onChange,
}: {
  value: number | Four | undefined;
  onChange(v: number | Four): void;
}) {
  const box = toBox(value);
  return (
    <InsetGroup
      value={box}
      onChange={(sides: Side[], v: number) => {
        const next = { ...box };
        for (const s of sides) next[s] = Math.max(0, v);
        onChange(fromBox(next));
      }}
    />
  );
}

export function NumberField({
  value,
  onChange,
  placeholder,
  min,
  max,
  step,
  suffix,
  w,
}: {
  value: number | undefined;
  onChange(v: number | undefined): void;
  /** The default shown while the field is empty. */
  placeholder?: number;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  w?: number;
}) {
  return (
    <NumberInput
      size="xs"
      hideControls
      w={w}
      styles={mono}
      value={value ?? ''}
      placeholder={placeholder === undefined ? undefined : String(placeholder)}
      min={min}
      max={max}
      step={step}
      suffix={suffix}
      onChange={(v) => onChange(typeof v === 'number' ? v : undefined)}
    />
  );
}

export function RadiusField({
  value,
  onChange,
}: {
  value: number | 'pill' | undefined;
  onChange(v: number | 'pill' | undefined): void;
}) {
  const pill = value === 'pill';
  return (
    <Group gap={6} wrap="nowrap">
      {!pill && (
        <NumberField
          value={value}
          onChange={onChange}
          placeholder={0}
          min={0}
          suffix=" px"
          w={90}
        />
      )}
      <Button
        size="xs"
        variant={pill ? 'filled' : 'default'}
        onClick={() => onChange(pill ? 0 : 'pill')}
      >
        Pill
      </Button>
    </Group>
  );
}

export function CornerField({
  value,
  onChange,
}: {
  value: Corner | undefined;
  onChange(v: Corner): void;
}) {
  return (
    <SegmentedControl
      size="xs"
      fullWidth
      data={CORNERS}
      value={value ?? 'round'}
      onChange={(v) => onChange(v as Corner)}
    />
  );
}

/** Width / height inputs for the axes the catalog allows, defaults as placeholders. */
export function SizeFields({
  axes,
  value,
  onChange,
}: {
  axes: Size;
  value: Size | undefined;
  onChange(v: Size | undefined): void;
}) {
  const set = (axis: keyof Size, v: number | undefined) => {
    const next = { ...value, [axis]: v };
    if (v === undefined) delete next[axis];
    onChange(Object.keys(next).length ? next : undefined);
  };
  return (
    <Group gap={6} wrap="nowrap">
      {(['width', 'height'] as const)
        .filter((a) => axes[a] !== undefined)
        .map((a) => (
          <NumberField
            key={a}
            value={value?.[a]}
            onChange={(v) => set(a, v)}
            placeholder={axes[a]}
            min={1}
            suffix={a === 'width' ? ' W' : ' H'}
            w={90}
          />
        ))}
    </Group>
  );
}

/**
 * Asset tokens plus upload; a direct `./assets/x.svg` path shows as itself.
 * ponytail: no picker for existing project files — a control-only file only
 * arrives by upload. List `assets/` from OPFS here if reuse comes up.
 */
export function AssetField({
  value,
  onChange,
  optional,
  placeholder,
}: {
  value: string | undefined;
  onChange(v: string | undefined): void;
  optional?: boolean;
  /** What "unset" means here; defaults to nothing being drawn. */
  placeholder?: string;
}) {
  const { id: themeId = '' } = useParams();
  const assets = useProjectStore((s) => s.doc.tokens.assets ?? EMPTY);
  const dir = useProjectStore((s) => s.dir);
  const file = useRef<HTMLInputElement>(null);
  const data = Object.keys(assets)
    .sort()
    .map((n) => ({ value: `{assets.${n}}`, label: n }));
  if (value && !value.startsWith('{'))
    data.push({ value, label: value.replace(/^\.\/assets\//, '') });
  const token = value?.startsWith('{') ? value.slice(8, -1) : undefined;
  const missing = token !== undefined && !(token in assets);
  if (missing) data.push({ value: value!, label: `${token} · missing` });
  const upload = async (f: File) => {
    const path = `./assets/${safeFileName(f.name)}`;
    await runtime.runPromise(
      writeProjectFile(dir, path, new Uint8Array(await f.arrayBuffer())),
    );
    onChange(path);
  };
  return (
    <Group gap={6} wrap="nowrap">
      <Select
        size="xs"
        flex={1}
        placeholder={placeholder ?? (optional ? 'none' : 'Choose an asset')}
        clearable={optional}
        leftSection={token ? <IconLink size={13} /> : undefined}
        error={missing}
        styles={mono}
        data={data}
        value={value ?? null}
        onChange={(v) => onChange(v ?? undefined)}
      />
      <Tooltip label="Upload an SVG for this control only" position="top">
        <ActionIcon
          variant="default"
          size={30}
          aria-label="Upload"
          onClick={() => file.current?.click()}
        >
          <IconUpload size={15} />
        </ActionIcon>
      </Tooltip>
      <input
        ref={file}
        type="file"
        accept=".svg,image/svg+xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
          e.target.value = '';
        }}
      />
      {token && (
        <Anchor
          component={Link}
          to={`/editor/${themeId}/tokens/assets`}
          fz={11}
          style={{ whiteSpace: 'nowrap' }}
        >
          Edit in Assets
        </Anchor>
      )}
    </Group>
  );
}

/** 3c: an input-styled summary that opens the TypographyPanel; a bare ref becomes `{ $extends }`. */
export function TypographyField({
  value,
  onChange,
  editable,
  error,
}: {
  value: string | TypographyValue | undefined;
  onChange(v: string | TypographyValue | undefined): void;
  /** Hides the text transform row. */
  editable?: boolean;
  error?: string;
}) {
  const [opened, setOpened] = useState(false);
  const tokens = useProjectStore((s) => s.doc.tokens);
  const fonts = tokens.fonts ?? EMPTY;
  const object: TypographyValue =
    typeof value === 'string' ? { $extends: value } : (value ?? {});
  const parent = resolveTypography(tokens, object.$extends);
  const resolved = resolveTypography(tokens, object);
  const own = Object.keys(object).filter((k) => k !== '$extends').length;
  const name = object.$extends?.slice(12, -1);
  const summary = resolved
    ? [
        resolved.font ? fontLabel(resolved.font) : undefined,
        resolved.fontSize !== undefined ? `${resolved.fontSize}px` : undefined,
        resolved.fontWeight,
      ]
        .filter((x) => x !== undefined)
        .join(' · ')
    : undefined;
  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={360}
      position="bottom-start"
      shadow="md"
    >
      <Popover.Target>
        <UnstyledButton
          onClick={() => setOpened((o) => !o)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '6px 10px',
            border: `1px solid var(--mantine-color-${opened ? 'blue-6' : error ? 'red-6' : 'default-border'})`,
            boxShadow: opened ? '0 0 0 2px rgba(34, 139, 230, 0.2)' : undefined,
            background: error
              ? 'var(--mantine-color-red-light)'
              : own
                ? orange.background
                : undefined,
            borderRadius: 4,
            fontFamily: 'var(--mantine-font-family-monospace)',
            fontSize: 12,
            minWidth: 0,
          }}
        >
          <IconTypography size={15} color="var(--mantine-color-dimmed)" />
          <span
            style={{
              flex: 1,
              minWidth: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {error ??
              (name ? `${name}${own ? ` +${own}` : ''}` : (summary ?? 'unset'))}
          </span>
          {name && summary && (
            <Text span fz={11} c="dimmed" truncate>
              {summary}
            </Text>
          )}
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown p={0}>
        <TypographyPanel
          value={object}
          onChange={(next) => {
            const keys = Object.keys(next);
            // Collapse back to the bare reference when nothing is overridden.
            onChange(
              keys.length === 1 && next.$extends
                ? next.$extends
                : keys.length
                  ? next
                  : undefined,
            );
          }}
          parent={parent}
          fonts={fonts}
          extendsOptions={Object.keys(tokens.typography ?? {}).sort()}
          hideCase={editable}
        />
      </Popover.Dropdown>
    </Popover>
  );
}
