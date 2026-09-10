/**
 * The 3a/3d color field: one input showing the value and a source icon;
 * clicking opens a popover with Token / Pick / Mix tabs. Values are the
 * project color model: a hex literal, a `{colors.name}` reference, or a mix.
 */
import { useMemo, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Anchor,
  AlphaSlider,
  ColorPicker,
  ColorSwatch,
  Group,
  HueSlider,
  NumberInput,
  Popover,
  ScrollArea,
  Select,
  Slider,
  Stack,
  Tabs,
  Text,
  TextInput,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import {
  IconAlertCircle,
  IconArrowRight,
  IconBan,
  IconBlendMode,
  IconCheck,
  IconChevronDown,
  IconColorPicker,
  IconLink,
  IconSearch,
} from '@tabler/icons-react';
import {
  converter,
  formatCss,
  formatHex8,
  formatHsl,
  formatRgb,
  parse,
} from 'culori';
import type { Static } from 'typebox';
import type { ColorMix, ProjectColor, ProjectTokens } from '@/theme/schema';
import { useAppStore } from './appStore';
import { describeColor, resolveColor } from './tokenView';

export type ColorValue = Static<typeof ProjectColor>;
type Mix = Static<typeof ColorMix>;
type Colors = NonNullable<ProjectTokens['colors']>;

const SPACES: Mix['space'][] = [
  'srgb',
  'srgb-linear',
  'lab',
  'lch',
  'oklab',
  'oklch',
];
/** 3d: the popover is one fixed width whatever field it opens from. */
const POPOVER_WIDTH = 288;
/** Notation of the Pick text field only; the stored color is unchanged. */
const FORMATS = ['hex', 'rgb', 'hsl', 'oklch'] as const;
type Format = (typeof FORMATS)[number];
const toOklch = converter('oklch');
const monoInput = {
  input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 11 },
};
const toHsv = converter('hsv');
/** Any culori color → project hex. */
const tidyHex = (c: Parameters<typeof formatHex8>[0] & object) => {
  const hex = formatHex8(c).toLowerCase();
  return hex.endsWith('ff') ? hex.slice(0, 7) : hex;
};

const refName = (v: ColorValue) =>
  typeof v === 'string' && v.startsWith('{') ? v.slice(8, -1) : undefined;
const kind = (v: ColorValue) =>
  typeof v !== 'string' ? 'mix' : v.startsWith('{') ? 'token' : 'pick';
/** Any culori-parsable color → project hex (`#rrggbb`, or `#rrggbbaa` when translucent). */
const toHex = (css: string) => {
  const c = parse(css);
  if (!c) return undefined;
  const hex = formatHex8(c).toLowerCase();
  return hex.endsWith('ff') ? hex.slice(0, 7) : hex;
};
const formatAs = (hex: string, format: Format) => {
  const c = parse(hex);
  if (!c) return hex;
  if (format === 'hex') return hex.toUpperCase();
  if (format === 'rgb') return formatRgb(c);
  if (format === 'hsl') return formatHsl(c);
  const o = toOklch(c);
  return formatCss({
    ...o,
    l: +o.l.toFixed(3),
    c: +o.c.toFixed(3),
    h: +(o.h ?? 0).toFixed(1),
  });
};
const alphaOf = (hex: string) =>
  hex.length === 9 ? parseInt(hex.slice(7), 16) / 255 : 1;
const withAlpha = (hex: string, alpha: number) => {
  const a = Math.round(Math.max(0, Math.min(1, alpha)) * 255);
  const rgb = hex.slice(0, 7);
  return a === 255 ? rgb : rgb + a.toString(16).padStart(2, '0');
};
/** Groups `accent-primary` under `accent`; single-segment names have no group. */
const groupOf = (name: string) =>
  name.includes('-') ? name.slice(0, name.indexOf('-')) : '';

const SourceIcon = ({
  v,
  active,
  size = 15,
}: {
  v: ColorValue;
  /** Blue while the field's popover is open, matching the focus ring. */
  active?: boolean;
  size?: number;
}) => {
  const k = kind(v);
  const Icon =
    k === 'token' ? IconLink : k === 'mix' ? IconBlendMode : IconColorPicker;
  return (
    <Icon
      size={size}
      color={`var(--mantine-color-${active ? 'blue-6' : 'dimmed'})`}
    />
  );
};

export function Swatch({
  hex,
  size = 14,
}: {
  hex: string | undefined;
  size?: number;
}) {
  return (
    <ColorSwatch
      color={hex ?? 'transparent'}
      size={size}
      radius={3}
      withShadow={false}
      style={{
        flex: 'none',
        border: '1px solid var(--mantine-color-default-border)',
      }}
    />
  );
}

export interface ColorFieldProps {
  /** `'none'` only with `allowNone`. */
  value: ColorValue | 'none';
  onChange(value: ColorValue | 'none'): void;
  /** Adds a None tab; the other tabs edit `seed` while the value is none. */
  allowNone?: boolean;
  seed?: ColorValue;
  /** Available tokens; `exclude` hides one (a token editing itself). */
  colors: Colors;
  exclude?: string;
  /** Mix inputs may not themselves be mixes. */
  allowMix?: boolean;
  /** Shown in place of the source icon, with error styling. */
  error?: string;
  /** The default target shows a swatch unless the row already has one. */
  withSwatch?: boolean;
  /** Replaces the default input-styled target. */
  children?: ReactNode;
  /** Rendered under the tabs, e.g. a delete button. */
  footer?: ReactNode;
}

export function ColorField({
  value: raw,
  onChange,
  allowNone,
  seed = '#888888',
  colors,
  exclude,
  allowMix = true,
  error,
  withSwatch = true,
  children,
  footer,
}: ColorFieldProps) {
  const [tab, setTab] = useState<string | null>(null);
  const [opened, setOpened] = useState(false);
  // A nested field (mix input) must live inside the outer dropdown's DOM:
  // the outer's click-outside check walks the event path, so a portaled
  // inner dropdown would count as outside and close both.
  const nested = !allowMix;
  const none = raw === 'none';
  const value: ColorValue = none ? seed : raw;
  const hex = resolveColor(colors, value);
  const active = tab ?? (none ? 'none' : kind(value));

  return (
    <Popover
      opened={opened}
      onChange={setOpened}
      width={POPOVER_WIDTH}
      position="bottom-start"
      shadow="md"
      trapFocus={!nested}
      withinPortal={!nested}
    >
      <Popover.Target>
        {/* Controlled popovers don't toggle on their own; the wrapper does. */}
        <div onClick={() => setOpened((o) => !o)} style={{ minWidth: 0 }}>
          {children ?? (
            <UnstyledButton
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: nested ? '5px 8px' : '0 10px',
                minHeight: nested ? undefined : 30,
                border: `1px solid var(--mantine-color-${opened ? 'blue-6' : error ? 'red-6' : 'default-border'})`,
                boxShadow: opened
                  ? '0 0 0 2px rgba(34, 139, 230, 0.2)'
                  : undefined,
                background: error
                  ? 'var(--mantine-color-red-light)'
                  : undefined,
                borderRadius: 4,
                fontFamily: 'var(--mantine-font-family-monospace)',
                fontSize: nested ? 11 : 12,
                width: '100%',
                minWidth: 0,
              }}
            >
              {/* None shows the checkerboard swatch; the ban icon is the source icon. */}
              {withSwatch && (
                <Swatch hex={none ? undefined : hex} size={nested ? 12 : 14} />
              )}
              <span
                style={{
                  flex: 1,
                  minWidth: 0,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {none ? 'none' : describeColor(value)}
              </span>
              {error ? (
                <IconAlertCircle size={15} color="var(--mantine-color-red-6)" />
              ) : nested ? (
                <IconChevronDown
                  size={14}
                  color="var(--mantine-color-dimmed)"
                />
              ) : none ? (
                <IconBan
                  size={15}
                  color={`var(--mantine-color-${opened ? 'blue-6' : 'dimmed'})`}
                />
              ) : (
                <SourceIcon v={value} active={opened} />
              )}
            </UnstyledButton>
          )}
        </div>
      </Popover.Target>
      <Popover.Dropdown
        p={0}
        onKeyDown={(e) => nested && e.key === 'Escape' && e.stopPropagation()}
      >
        <Tabs
          value={active}
          onChange={(t) => {
            setTab(t);
            if (t === 'none') onChange('none');
          }}
        >
          <Tabs.List>
            <Tabs.Tab value="token">Token</Tabs.Tab>
            <Tabs.Tab value="pick">Pick</Tabs.Tab>
            {allowMix && <Tabs.Tab value="mix">Mix</Tabs.Tab>}
            {allowNone && (
              <Tabs.Tab
                value="none"
                ml="auto"
                aria-label="None"
                title="None"
                leftSection={<IconBan size={15} />}
              />
            )}
          </Tabs.List>
          {allowNone && (
            <Tabs.Panel value="none">
              <Text fz={12} c="dimmed" p="12px 14px">
                Nothing is painted. Pick a token, colour, or mix to paint it
                again.
              </Text>
            </Tabs.Panel>
          )}
          <Tabs.Panel value="token">
            <TokenTab
              value={value}
              onChange={onChange}
              colors={colors}
              exclude={exclude}
            />
          </Tabs.Panel>
          <Tabs.Panel value="pick">
            <PickTab
              value={value}
              hex={hex}
              onChange={onChange}
              colors={colors}
              exclude={exclude}
            />
          </Tabs.Panel>
          {allowMix && (
            <Tabs.Panel value="mix">
              <MixTab
                value={value}
                hex={hex}
                onChange={onChange}
                colors={colors}
                exclude={exclude}
              />
            </Tabs.Panel>
          )}
        </Tabs>
        {footer}
      </Popover.Dropdown>
    </Popover>
  );
}

type TabProps = Pick<
  ColorFieldProps,
  'value' | 'onChange' | 'colors' | 'exclude'
> & { hex?: string };

function TokenTab({ value, onChange, colors, exclude }: TabProps) {
  const [filter, setFilter] = useState('');
  const current = refName(value);
  const groups = useMemo(() => {
    const names = Object.keys(colors)
      .filter((n) => n !== exclude && n.includes(filter.toLowerCase()))
      .sort();
    const out = new Map<string, string[]>();
    for (const n of names)
      out.set(groupOf(n), [...(out.get(groupOf(n)) ?? []), n]);
    return [...out.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [colors, exclude, filter]);
  return (
    <Stack gap={6} p={8}>
      <TextInput
        size="xs"
        placeholder="Filter tokens…"
        leftSection={<IconSearch size={14} />}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
      />
      <ScrollArea.Autosize mah={240} type="auto">
        {groups.map(([group, names]) => (
          <div key={group}>
            {group && (
              <Text
                fz={10}
                fw={600}
                c="dimmed"
                tt="uppercase"
                lts={0.4}
                px={10}
                pt={6}
                pb={2}
              >
                {group}
              </Text>
            )}
            {names.map((name) => {
              const v = colors[name];
              const h = resolveColor(colors, v);
              const selected = current === name;
              return (
                <UnstyledButton
                  key={name}
                  onClick={() => onChange(`{colors.${name}}`)}
                  px={10}
                  py={6}
                  w="100%"
                  bg={selected ? 'var(--mantine-color-blue-light)' : undefined}
                  c={
                    selected
                      ? 'var(--mantine-color-blue-light-color)'
                      : undefined
                  }
                  fw={selected ? 600 : undefined}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    borderRadius: 4,
                  }}
                >
                  <Swatch hex={h} size={16} />
                  <span
                    style={{
                      flex: 1,
                      fontFamily: 'var(--mantine-font-family-monospace)',
                      fontSize: 12,
                    }}
                  >
                    {name}
                  </span>
                  <Text span fz={11} c="dimmed">
                    {typeof v === 'string' && !v.startsWith('{')
                      ? v.toUpperCase()
                      : kind(v) === 'mix'
                        ? 'mix'
                        : `→ ${refName(v)}`}
                  </Text>
                  {selected && <IconCheck size={14} />}
                </UnstyledButton>
              );
            })}
          </div>
        ))}
        {groups.length === 0 && (
          <Text c="dimmed" fz={12} p={8}>
            {filter ? 'No matching tokens.' : 'No color tokens yet.'}
          </Text>
        )}
      </ScrollArea.Autosize>
    </Stack>
  );
}

/** The `EyeDropper` API, absent from the DOM lib and from Firefox/Safari. */
type EyeDropperCtor = new () => { open(): Promise<{ sRGBHex: string }> };
const eyeDropper = (globalThis as { EyeDropper?: EyeDropperCtor }).EyeDropper;

function PickTab({ value, hex, onChange, colors, exclude }: TabProps) {
  const [format, setFormat] = useState<Format>('hex');
  const [text, setText] = useState<string>();
  const recent = useAppStore((s) => s.recentColors);
  const pushRecent = useAppStore((s) => s.pushRecentColor);
  const picked =
    typeof value === 'string' && !value.startsWith('{')
      ? value
      : (hex ?? '#000000');
  const hsv = toHsv(parse(picked)) ?? {
    mode: 'hsv' as const,
    h: 0,
    s: 0,
    v: 0,
  };
  const alpha = alphaOf(picked);
  const commit = (next: string) => {
    onChange(next);
    pushRecent(next);
  };
  // Only literal tokens qualify: binding to a reference could point back at this token.
  const match = useMemo(
    () =>
      Object.keys(colors).find((n) => {
        const v = colors[n];
        return (
          n !== exclude &&
          refName(value) !== n &&
          typeof v === 'string' &&
          v.startsWith('#') &&
          v.toLowerCase() === hex
        );
      }),
    [colors, exclude, hex, value],
  );
  return (
    <Stack gap={10} p={12}>
      <ColorPicker
        fullWidth
        format="hexa"
        value={picked}
        onChange={(v) => onChange(toHex(v) ?? picked)}
        onChangeEnd={(v) => pushRecent(toHex(v) ?? picked)}
        styles={{
          saturation: {
            height: 130,
            borderRadius: 4,
            border: '1px solid var(--mantine-color-default-border)',
          },
          body: { display: 'none' },
        }}
      />
      <Group gap={10} wrap="nowrap">
        {eyeDropper && (
          <Tooltip label="Eyedropper" position="bottom">
            <ActionIcon
              variant="default"
              size={30}
              aria-label="Eyedropper"
              onClick={() =>
                new eyeDropper().open().then(
                  (r) => commit(toHex(r.sRGBHex)!),
                  () => {},
                )
              }
            >
              <IconColorPicker size={15} />
            </ActionIcon>
          </Tooltip>
        )}
        <Stack gap={6} flex={1}>
          <HueSlider
            size="sm"
            value={hsv.h ?? 0}
            onChange={(h) => onChange(tidyHex({ ...hsv, h, alpha }))}
            onChangeEnd={() => pushRecent(picked)}
          />
          <AlphaSlider
            size="sm"
            color={picked.slice(0, 7)}
            value={alpha}
            onChange={(a) => onChange(withAlpha(picked, a))}
            onChangeEnd={() => pushRecent(picked)}
          />
        </Stack>
      </Group>
      <Group gap={6} wrap="nowrap">
        <Select
          size="xs"
          w={64}
          data={[...FORMATS]}
          allowDeselect={false}
          value={format}
          onChange={(v) => v && setFormat(v as Format)}
          title="Notation of the text field only; the stored color is the same"
          styles={monoInput}
          comboboxProps={{ withinPortal: false }}
        />
        <TextInput
          size="xs"
          flex={1}
          styles={{
            input: {
              fontFamily: 'var(--mantine-font-family-monospace)',
              fontSize: 11,
            },
          }}
          value={text ?? formatAs(picked, format)}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => {
            if (text !== undefined) {
              const h = toHex(text);
              if (h) commit(h);
            }
            setText(undefined);
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <NumberInput
          size="xs"
          w={48}
          min={0}
          max={100}
          hideControls
          suffix="%"
          styles={{
            input: { ...monoInput.input, textAlign: 'right', paddingInline: 6 },
          }}
          value={Math.round(alpha * 100)}
          onChange={(v) =>
            typeof v === 'number' && onChange(withAlpha(picked, v / 100))
          }
        />
      </Group>
      {recent.length > 0 && (
        <Group gap={6}>
          <Text fz={11} c="dimmed" flex={1}>
            Recent
          </Text>
          {recent.map((c) => (
            <UnstyledButton key={c} onClick={() => onChange(c)} aria-label={c}>
              <Swatch hex={c} size={16} />
            </UnstyledButton>
          ))}
        </Group>
      )}
      {match && (
        <Group
          gap={6}
          fz={11}
          c="dimmed"
          pt={6}
          style={{ borderTop: '1px solid var(--mantine-color-default-border)' }}
        >
          <IconArrowRight size={12} />
          Matches{' '}
          <span style={{ fontFamily: 'var(--mantine-font-family-monospace)' }}>
            {match}
          </span>{' '}
          ·
          <Anchor fz={11} onClick={() => onChange(`{colors.${match}}`)}>
            Use token instead
          </Anchor>
        </Group>
      )}
    </Stack>
  );
}

function MixTab({ value, hex, onChange, colors, exclude }: TabProps) {
  const mix: Mix | undefined = typeof value !== 'string' ? value : undefined;
  const setMix = (patch: Partial<Mix>) =>
    onChange({
      $type: 'mix',
      inputs: [hex ?? '#000000', '#00000000'],
      amount: 0.5,
      space: 'oklch',
      ...mix,
      ...patch,
    } satisfies Mix);
  const [a, b] = mix?.inputs ?? [hex ?? '#000000', '#00000000'];
  const gradient = `linear-gradient(in ${mix?.space ?? 'oklch'} 90deg, ${resolveColor(colors, a) ?? 'transparent'}, ${resolveColor(colors, b) ?? 'transparent'})`;
  const amount = Math.round((mix?.amount ?? 0.5) * 100);
  return (
    <Stack gap={10} p={12} fz={12}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '44px 1fr',
          gap: '6px 8px',
          alignItems: 'center',
        }}
      >
        <Text c="dimmed" fz={12}>
          From
        </Text>
        <ColorField
          value={a}
          onChange={(v) => setMix({ inputs: [v as Mix['inputs'][0], b] })}
          colors={colors}
          exclude={exclude}
          allowMix={false}
        />
        <Text c="dimmed" fz={12}>
          To
        </Text>
        <ColorField
          value={b}
          onChange={(v) => setMix({ inputs: [a, v as Mix['inputs'][1]] })}
          colors={colors}
          exclude={exclude}
          allowMix={false}
        />
      </div>
      <Group gap={10} wrap="nowrap">
        <Slider
          flex={1}
          min={0}
          max={100}
          size={18}
          radius={9}
          thumbSize={20}
          label={null}
          value={amount}
          onChange={(v) => setMix({ amount: v / 100 })}
          styles={{
            root: { paddingInline: 0 },
            track: {
              '--track-bg': 'transparent',
              background: `${gradient}, repeating-conic-gradient(#d0d0d0 0 25%, #fff 0 50%) 0 0 / 10px 10px`,
              borderRadius: 9,
              border: '1px solid var(--mantine-color-default-border)',
            } as React.CSSProperties,
            bar: { display: 'none' },
            thumb: {
              borderWidth: 2,
              background: '#fff',
              boxShadow: 'var(--mantine-shadow-sm)',
            },
          }}
        />
        <NumberInput
          size="xs"
          w={48}
          min={0}
          max={100}
          hideControls
          suffix="%"
          styles={{
            input: { ...monoInput.input, textAlign: 'right', paddingInline: 6 },
          }}
          value={amount}
          onChange={(v) => typeof v === 'number' && setMix({ amount: v / 100 })}
        />
      </Group>
      <Group gap={8} wrap="nowrap">
        <Text c="dimmed" fz={12} style={{ whiteSpace: 'nowrap' }}>
          Colorspace
        </Text>
        <Select
          size="xs"
          flex={1}
          data={SPACES}
          allowDeselect={false}
          value={mix?.space ?? 'oklch'}
          onChange={(v) => v && setMix({ space: v as Mix['space'] })}
          styles={monoInput}
          comboboxProps={{ withinPortal: false }}
        />
      </Group>
    </Stack>
  );
}
