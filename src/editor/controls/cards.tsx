/**
 * One card per kind (4a/4b/4k): the rows a node exposes, with the current
 * state's overrides marked and resettable. Each card reads the node's raw
 * JSON through `ControlEdit` and writes through `set`.
 */
import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Anchor,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Switch,
  Text,
} from '@mantine/core';
import { Effect } from 'effect';
import { Link, useParams } from 'react-router';
import { merge } from '@/compiler/controls';
import type { CatalogEntry } from '@/theme/catalog';
import { ColorField } from '@/editor/ColorField';
import { defaultSlicing, type Asset, type Slicing } from '@/editor/nineSlice';
import { writeProjectFile } from '@/editor/persistence';
import { ImagePart } from '@/editor/preview/ImagePart';
import {
  BUILTIN,
  resolveAsset,
  type Corner,
  type Four,
  type Size,
  type StateName,
} from '@/editor/preview/resolve';
import { useAsset, useSvgText } from '@/editor/preview/useAsset';
import { useProjectStore } from '@/editor/projectStore';
import { runtime } from '@/editor/runtime';
import { SliceEditor } from '@/editor/SliceEditor';
import { Slicer } from '@/editor/slicer';
import { controlLabel, EMPTY } from '@/editor/tokensUtil';
import {
  AssetField,
  CornerField,
  FieldRow,
  InsetField,
  NumberField,
  PaintField,
  RadiusField,
  Rows,
  SizeFields,
  TypographyField,
  type Paint,
} from './fields';
import {
  getIn,
  type ControlEdit,
  type PartPath,
  type Raw,
} from './useControlEdit';

export type CardProps = {
  path: PartPath;
  entry: CatalogEntry;
  state: StateName;
  edit: ControlEdit;
  title: string;
};

/** The node's base, this state's own overrides, and the effective merge. */
const scope = (raw: Raw, state: StateName) => {
  const { states, parts, ...base } = raw;
  void parts;
  const own =
    state === 'default'
      ? base
      : (((states as Raw | undefined)?.[state] as Raw) ?? EMPTY);
  return {
    base,
    own,
    eff: state === 'default' ? base : (merge(base, own) as Raw),
  };
};

/** Binds a card's rows to one node and state. */
function useRows({ path, state, edit }: CardProps) {
  const { base, own, eff } = scope(edit.node(path), state);
  const stateScope = state !== 'default';
  return {
    base,
    own,
    eff,
    stateScope,
    value: <T,>(key: string) => getIn(eff, key) as T | undefined,
    set: (key: string, v: unknown) => edit.set(path, state, key, v),
    /** A row whose field this state may override. */
    row: (label: string, key: string, field: ReactNode, hint?: ReactNode) => (
      <FieldRow
        label={label}
        overridden={stateScope && getIn(own, key) !== undefined}
        hint={hint}
        onReset={
          stateScope && getIn(own, key) !== undefined
            ? () => edit.set(path, state, key, undefined)
            : undefined
        }
      >
        {field}
      </FieldRow>
    ),
  };
}

function CardShell({
  title,
  header,
  children,
}: {
  title: string;
  header?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card shadow="xs" padding="md">
      <Group gap={8} mb={12} wrap="nowrap">
        <Text fw={600} style={{ flex: 1 }}>
          {title}
        </Text>
        {header}
      </Group>
      {children}
    </Card>
  );
}

/** The switch only picks whether the owner draws the ring; the ring is its own control. */
function RingHint() {
  const { id: themeId = '' } = useParams();
  return (
    <>
      The ring itself is the{' '}
      <Anchor
        component={Link}
        to={`/editor/${themeId}/controls/focus-ring`}
        fz={11}
      >
        Focus ring
      </Anchor>{' '}
      control
    </>
  );
}

/** Why the Default tab has rows this one doesn't: the schema has no per-state field for them. */
const StateNote = () => (
  <Text fz={11} c="dimmed" mt={12}>
    Only these fields can differ per state.
  </Text>
);

const opacityRow = (r: ReturnType<typeof useRows>) =>
  r.row(
    'Opacity',
    'opacity',
    <NumberField
      value={r.value<number>('opacity')}
      onChange={(v) => r.set('opacity', v)}
      placeholder={1}
      min={0}
      max={1}
      step={0.05}
      w={90}
    />,
  );
const sizeRow = (r: ReturnType<typeof useRows>, entry: CatalogEntry) =>
  entry.size && !r.stateScope
    ? r.row(
        'Size',
        'size',
        <SizeFields
          axes={entry.size}
          value={r.value<Size>('size')}
          onChange={(v) => r.set('size', v)}
        />,
      )
    : null;
/**
 * The tint, with the picked SVG's own answer about it: art that never says
 * `currentColor` ignores the field, art that does fails to compile without
 * it. Variant images have no single `asset`, so they keep the plain hint.
 */
function CurrentColorRow({
  r,
  uses: forced,
}: {
  r: ReturnType<typeof useRows>;
  /** A variant image answers for its whole set of variants (no single asset). */
  uses?: boolean;
}) {
  const tokens = useProjectStore((s) => s.doc.tokens);
  const { raw } = useSvgText(resolveAsset(tokens, r.value<string>('asset')));
  // Unknown (still loading, or a variant image with no single asset) is not
  // an answer: only art that certainly ignores or certainly needs the tint says so.
  const uses = forced ?? raw?.includes('currentColor');
  const value = r.value<Paint>('currentColor');
  return r.row(
    'Current color',
    'currentColor',
    <PaintField
      value={value}
      onChange={(v) => r.set('currentColor', v)}
      error={uses && value === undefined ? 'Required' : undefined}
    />,
    uses === false
      ? 'This SVG has no currentColor — the tint does nothing'
      : 'Tints currentColor in the SVG',
  );
}

export function FrameCard(props: CardProps) {
  const { entry, state, edit, path, title } = props;
  const r = useRows(props);
  const asset = r.eff.shape === 'asset';
  const ringOwner = state === 'focused' && entry.focusRingOwner;
  return (
    <CardShell
      title={title}
      header={
        !r.stateScope && (
          <SegmentedControl
            size="xs"
            data={[
              { value: 'path', label: 'Simple' },
              { value: 'asset', label: 'Image' },
            ]}
            value={asset ? 'asset' : 'path'}
            onChange={(v) => edit.setShape(path, v as 'path' | 'asset')}
          />
        )
      }
    >
      <Rows>
        {asset ? (
          <>
            {r.row(
              'Asset',
              'asset',
              <AssetField
                value={r.value<string>('asset')}
                onChange={(v) => r.set('asset', v)}
              />,
            )}
            <CurrentColorRow r={r} />
          </>
        ) : (
          <>
            {r.row(
              'Fill',
              'fill',
              <PaintField
                value={r.value<Paint>('fill')}
                onChange={(v) => r.set('fill', v)}
                allowNone
              />,
            )}
            {r.row(
              'Border',
              'border.color',
              <PaintField
                value={r.value<Paint>('border.color')}
                onChange={(v) => r.set('border.color', v)}
                allowNone
              />,
            )}
            {r.row(
              'Thickness',
              'border.thickness',
              <InsetField
                value={r.value<number | Four>('border.thickness')}
                onChange={(v) => r.set('border.thickness', v)}
              />,
            )}
            {r.row(
              'Radius',
              'radius',
              <RadiusField
                value={r.value<number | 'pill'>('radius')}
                onChange={(v) => r.set('radius', v)}
              />,
            )}
            {r.row(
              'Corner',
              'corner',
              <CornerField
                value={r.value<Corner>('corner')}
                onChange={(v) => r.set('corner', v)}
              />,
            )}
            {!r.stateScope &&
              r.row(
                'Padding',
                'padding',
                <InsetField
                  value={r.value<number | Four>('padding')}
                  onChange={(v) => r.set('padding', v)}
                />,
              )}
          </>
        )}
        {opacityRow(r)}
        {sizeRow(r, entry)}
        {ringOwner &&
          r.row(
            'Focus ring',
            'showRing',
            <Switch
              size="sm"
              label="Show the app focus ring"
              checked={r.value<boolean>('showRing') ?? true}
              onChange={(e) =>
                r.set('showRing', e.currentTarget.checked ? undefined : false)
              }
            />,
            <RingHint />,
          )}
      </Rows>
      {asset && !r.stateScope && (
        <SlicingSection value={r.value<string>('asset')} />
      )}
      {r.stateScope && <StateNote />}
    </CardShell>
  );
}

/** Cuts an asset and writes it back to the project (AssetsPage's `persist`). */
const persist = (dir: string, path: string, a: Asset) =>
  runtime.runPromise(
    Effect.flatMap(Slicer, (s) => s.cut(a)).pipe(
      Effect.tap((cut) =>
        writeProjectFile(dir, path, new TextEncoder().encode(cut.text)),
      ),
      Effect.catchAll(() => Effect.void),
    ),
  );

/** 4a: the inline slice editor for a direct file; 4k: read-only for a token. */
function SlicingSection({ value }: { value: string | undefined }) {
  const { id: themeId = '' } = useParams();
  const tokens = useProjectStore((s) => s.doc.tokens);
  const dir = useProjectStore((s) => s.dir);
  const path = resolveAsset(tokens, value);
  const token = value?.startsWith('{') ? value.slice(8, -1) : undefined;
  const { asset: parsed, error } = useAsset(path);
  const [edited, setEdited] = useState<Asset>();
  const asset = edited?.art === parsed?.art ? edited : parsed;
  // Edits show immediately and reach OPFS a moment later, or on unmount.
  const pending = useRef<{ timer: number; asset: Asset }>(undefined);
  const save = (slicing: Slicing) => {
    if (!asset || !path) return;
    const a = { ...asset, slicing };
    setEdited(a);
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      asset: a,
      timer: window.setTimeout(() => {
        pending.current = undefined;
        void persist(dir, path, a);
      }, 300),
    };
  };
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p || !path) return;
      clearTimeout(p.timer);
      pending.current = undefined;
      void persist(dir, path, p.asset);
    },
    [dir, path],
  );
  const slicing = useMemo(
    () => asset && (asset.slicing ?? defaultSlicing(asset.viewBox)),
    [asset],
  );
  if (!value) return null;
  if (!asset || !slicing)
    return (
      <Text fz={12} c="dimmed" mt={12}>
        {error ?? 'Loading…'}
      </Text>
    );
  return (
    <Stack gap={8} mt={12}>
      <div style={token ? { opacity: 0.6, pointerEvents: 'none' } : undefined}>
        <SliceEditor
          art={asset.art}
          viewBox={asset.viewBox}
          value={slicing}
          onChange={token ? () => {} : save}
          height={200}
        />
      </div>
      {token && (
        <Text fz={12} c="dimmed">
          Slices, content area and overdraw come from{' '}
          <Text span ff="monospace" fz={12}>
            {token}
          </Text>{' '}
          and apply everywhere it is used.{' '}
          <Anchor
            component={Link}
            to={`/editor/${themeId}/tokens/assets`}
            fz={12}
          >
            Edit in Assets
          </Anchor>
          .{/* ponytail: "detach a copy" (4k) not built. */}
        </Text>
      )}
    </Stack>
  );
}

export function TextCard(props: CardProps) {
  const { entry, title } = props;
  const r = useRows(props);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const color = r.value<Paint>('color');
  return (
    <CardShell title={title}>
      <Rows>
        {!r.stateScope &&
          r.row(
            'Font',
            'typography',
            <TypographyField
              value={r.value<string | Record<string, unknown>>('typography')}
              onChange={(v) => r.set('typography', v)}
              editable={entry.typography === 'editable'}
              error={r.base.typography === undefined ? 'Required' : undefined}
            />,
          )}
        {r.row(
          'Color',
          'color',
          color === undefined || color === 'none' ? (
            <PaintField
              value={undefined}
              onChange={(v) => r.set('color', v)}
              error={r.stateScope ? undefined : 'Required'}
            />
          ) : (
            <ColorField
              value={color}
              onChange={(v) => r.set('color', v)}
              colors={colors}
            />
          ),
        )}
        {opacityRow(r)}
        {entry.leftInset !== undefined &&
          !r.stateScope &&
          r.row(
            'Left inset',
            'leftInset',
            <NumberField
              value={r.value<number>('leftInset')}
              onChange={(v) => r.set('leftInset', v)}
              placeholder={entry.leftInset}
              suffix=" px"
              w={90}
            />,
            'Run of stroke before the label',
          )}
      </Rows>
      {r.stateScope && <StateNote />}
    </CardShell>
  );
}

export function PaintCard(props: CardProps) {
  const r = useRows(props);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const color = r.value<Paint>('color');
  return (
    <CardShell title={props.title}>
      <Rows>
        {r.row(
          'Color',
          'color',
          color === undefined || color === 'none' ? (
            <PaintField
              value={undefined}
              onChange={(v) => r.set('color', v)}
              error={r.stateScope ? undefined : 'Required'}
            />
          ) : (
            <ColorField
              value={color}
              onChange={(v) => r.set('color', v)}
              colors={colors}
            />
          ),
        )}
        {opacityRow(r)}
      </Rows>
    </CardShell>
  );
}

export function ImageCard(props: CardProps) {
  const { entry, state } = props;
  const r = useRows(props);
  return (
    <CardShell title={props.title}>
      <Rows>
        {r.row(
          'Asset',
          'asset',
          <AssetField
            value={r.value<string>('asset')}
            onChange={(v) => r.set('asset', v)}
            optional={entry.assetOptional || r.stateScope}
          />,
        )}
        <CurrentColorRow r={r} />
        {opacityRow(r)}
        {sizeRow(r, entry)}
        {state === 'focused' &&
          entry.focusRingOwner &&
          r.row(
            'Focus ring',
            'showRing',
            <Switch
              size="sm"
              label="Show the app focus ring"
              checked={r.value<boolean>('showRing') ?? true}
              onChange={(e) =>
                r.set('showRing', e.currentTarget.checked ? undefined : false)
              }
            />,
            <RingHint />,
          )}
      </Rows>
    </CardShell>
  );
}

export function VariantImageCard(props: CardProps) {
  const { entry, edit, path } = props;
  const r = useRows(props);
  const tokens = useProjectStore((s) => s.doc.tokens);
  const builtin = BUILTIN[[edit.id, ...path].join('.')] ?? {};
  return (
    <CardShell title={props.title}>
      <Rows>
        {(entry.variants ?? []).map((v) => (
          <Fragment key={v}>
            {r.row(
              controlLabel(v),
              `assets.${v}`,
              <Group gap={8} wrap="nowrap">
                {/* What this variant actually draws: its own art, or the built-in. */}
                <ImagePart
                  view={{
                    assets: {
                      [v]: resolveAsset(tokens, r.value(`assets.${v}`)),
                    },
                    builtin,
                    opacity: 1,
                    size: { width: 16, height: 16 },
                  }}
                  variant={v}
                  style={{ color: 'var(--mantine-color-dimmed)' }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <AssetField
                    value={r.value<string>(`assets.${v}`)}
                    onChange={(x) => r.set(`assets.${v}`, x)}
                    optional
                    placeholder="Default (built in)"
                  />
                </div>
              </Group>,
            )}
          </Fragment>
        ))}
        <CurrentColorRow
          r={r}
          // A variant left to the built-in art needs the tint; only a set
          // where every variant is the project's own art can go without.
          uses={
            (entry.variants ?? []).some((v) => !r.value(`assets.${v}`)) &&
            Object.values(builtin).some((a) => a.includes('currentColor'))
              ? true
              : undefined
          }
        />
        {opacityRow(r)}
        {sizeRow(r, entry)}
      </Rows>
    </CardShell>
  );
}

export function WindowCard(props: CardProps) {
  const r = useRows(props);
  const fill = r.value<Paint>('fill');
  return (
    <CardShell title={props.title}>
      <Rows>
        {r.row(
          'Fill',
          'fill',
          <PaintField
            value={fill}
            onChange={(v) => r.set('fill', v)}
            error={
              fill === undefined || fill === 'none' ? 'Required' : undefined
            }
          />,
          'Behind every page of the app',
        )}
        {r.row(
          'Border',
          'borderColor',
          <PaintField
            value={r.value<Paint>('borderColor')}
            onChange={(v) => r.set('borderColor', v)}
            allowNone
          />,
          '1px on the OS window frame; hidden when maximized and in console mode',
        )}
      </Rows>
    </CardShell>
  );
}

export function FocusRingCard(props: CardProps) {
  const r = useRows(props);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const color = r.value<Paint>('color');
  return (
    <CardShell title={props.title}>
      <Rows>
        {r.row(
          'Color',
          'color',
          color === undefined || color === 'none' ? (
            <PaintField
              value={undefined}
              onChange={(v) => r.set('color', v)}
              error="Required"
            />
          ) : (
            <ColorField
              value={color}
              onChange={(v) => r.set('color', v)}
              colors={colors}
            />
          ),
        )}
        {r.row(
          'Width',
          'width',
          <NumberField
            value={r.value<number>('width')}
            onChange={(v) => r.set('width', v)}
            placeholder={2}
            min={0}
            suffix=" px"
            w={90}
          />,
        )}
        {r.row(
          'Offset',
          'offset',
          <NumberField
            value={r.value<number>('offset')}
            onChange={(v) => r.set('offset', v)}
            placeholder={-2}
            suffix=" px"
            w={90}
          />,
          'Negative draws inside the edge',
        )}
      </Rows>
    </CardShell>
  );
}
