/**
 * 4i/4j: SVG assets packaged with the theme, as a card grid or a list, with
 * a detail panel that hosts the nine-slice editor. Version 1 asset tokens
 * are SVG only; slicing is stored in the SVG itself.
 *
 * ponytail: slicing edits write straight to OPFS, outside the document's
 * undo history and tab sync. Route them through the project writer if undo
 * for artwork edits is ever wanted.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActionIcon,
  Button,
  Card,
  Group,
  SegmentedControl,
  Stack,
  Text,
  TextInput,
  UnstyledButton,
} from '@mantine/core';
import {
  IconLayoutGrid,
  IconList,
  IconPlus,
  IconUpload,
  IconTrash,
} from '@tabler/icons-react';
import { Effect } from 'effect';
import { defaultSlicing, parseAsset, type Asset } from './nineSlice';
import { writeProjectFile } from './persistence';
import { useProjectStore } from './projectStore';
import { runtime } from './runtime';
import { Slicer } from './slicer';
import { DropZone } from './FontsPage';
import { SliceEditor } from './SliceEditor';
import { Heading, RowMenu, UsedBy } from './tokensShared';
import {
  EMPTY,
  kb,
  mono,
  nameFromFile,
  safeFileName,
  useRename,
} from './tokensUtil';
import { NameInput } from './tokensShared';
import {
  bakeColors,
  freeName,
  replaceReferences,
  type TokenView,
} from './tokenView';
import { useProjectFile } from './useProjectFile';

type Row = TokenView['assets'][number];
type Filter = 'all' | 'used' | 'unused';
const CHECKER =
  'repeating-conic-gradient(var(--mantine-color-gray-1) 0 25%, var(--mantine-color-gray-0) 0 50%) 0 0 / 12px 12px';
const COLUMNS =
  '44px minmax(100px, 150px) minmax(0, 1fr) minmax(90px, 1fr) 20px';

/** Width × height from the SVG's viewBox, or its width/height attributes. */
const svgSize = (text: string | undefined) => {
  if (!text) return undefined;
  const vb = /viewBox="([^"]+)"/
    .exec(text)?.[1]
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (vb?.length === 4 && vb.every(Number.isFinite))
    return [vb[2], vb[3]] as const;
  const w = Number(/\swidth="([\d.]+)/.exec(text)?.[1]);
  const h = Number(/\sheight="([\d.]+)/.exec(text)?.[1]);
  return w && h ? ([w, h] as const) : undefined;
};

/** Cuts an asset and writes it, yielding slicing warnings (or the failure). */
const persist = (dir: string, path: string, a: Asset) =>
  runtime.runPromise(
    Effect.flatMap(Slicer, (s) => s.cut(a)).pipe(
      Effect.tap((cut) =>
        writeProjectFile(dir, path, new TextEncoder().encode(cut.text)),
      ),
      Effect.map((cut) => cut.warnings),
      Effect.catchAll((e) => Effect.succeed([e.message])),
    ),
  );

/** The SVG with `{colors.name}` paints replaced by their resolved hex, as a data URL. */
function useSvg(path: string | undefined) {
  const file = useProjectFile(path, 'image/svg+xml');
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  return useMemo(() => {
    const bytes = file?.file?.bytes;
    if (!bytes) return { error: file?.error };
    const raw = new TextDecoder().decode(bytes);
    const text = bakeColors(raw, colors);
    return {
      raw,
      text,
      size: svgSize(raw),
      bytes: bytes.length,
      url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(text)}`,
    };
  }, [file, colors]);
}

export function AssetsPage({ view }: { view: TokenView }) {
  const rows = view.assets;
  const [selected, setSelected] = useState<string>();
  const [mode, setMode] = useState<'grid' | 'list'>('grid');
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const edit = useProjectStore((s) => s.edit);
  const dir = useProjectStore((s) => s.dir);
  const assets = useProjectStore((s) => s.doc.tokens.assets ?? EMPTY);
  const { renaming, setRenaming, commit } = useRename('assets');
  const current = rows.find((r) => r.name === selected) ?? rows[0];
  const used = (r: Row) => r.usedBy.length + r.usedByTokens.length > 0;
  const shown = rows.filter(
    (r) =>
      (filter === 'all' || (filter === 'used') === used(r)) &&
      r.name.includes(query.toLowerCase()),
  );

  const upload = async (file: File, name = nameFromFile(file.name)) => {
    if (!/\.svg$/i.test(file.name)) return;
    const path = `./assets/${safeFileName(file.name)}`;
    await runtime.runPromise(
      writeProjectFile(dir, path, new Uint8Array(await file.arrayBuffer())),
    );
    const token = name in assets ? freeName(assets, name) : name;
    edit('Add asset', (d) => void ((d.tokens.assets ??= {})[token] = path));
    setAdding(false);
    setSelected(token);
  };
  const menu = (r: Row) => (
    <RowMenu
      used={r.used}
      usedByControls={r.usedBy.length}
      onRename={() => setRenaming({ from: r.name, to: r.name })}
      onDuplicate={() =>
        edit(
          `Duplicate ${r.name}`,
          (d) =>
            void (d.tokens.assets![freeName(d.tokens.assets!, r.name)] =
              r.value),
        )
      }
      replace={{
        options: rows.map((x) => x.name).filter((n) => n !== r.name),
        onReplace: (to) =>
          edit(`Replace ${r.name}`, (d) =>
            replaceReferences(d, 'assets', r.name, to),
          ),
      }}
      onDelete={() =>
        edit(`Delete ${r.name}`, (d) => void delete d.tokens.assets![r.name])
      }
    />
  );
  const nameCell = (r: Row) =>
    renaming?.from === r.name ? (
      <div onClick={(e) => e.stopPropagation()}>
        <NameInput
          value={renaming.to}
          onChange={(to) => setRenaming({ ...renaming, to })}
          taken={(n) => n !== r.name && n in assets}
          onSubmit={commit}
          onCancel={() => setRenaming(undefined)}
        />
      </div>
    ) : (
      <Text {...mono} fw={r.name === current?.name ? 600 : undefined} truncate>
        {r.name}
      </Text>
    );
  const chip = (value: Filter, label: string, n: number) => (
    <UnstyledButton
      key={value}
      onClick={() => setFilter(value)}
      px={10}
      py={3}
      fz={11}
      fw={filter === value ? 600 : undefined}
      style={{
        borderRadius: 12,
        background:
          filter === value ? 'var(--mantine-color-blue-light)' : undefined,
        color:
          filter === value
            ? 'var(--mantine-color-blue-light-color)'
            : undefined,
        border:
          filter === value
            ? '1px solid transparent'
            : '1px solid var(--mantine-color-default-border)',
      }}
    >
      {label} {n}
    </UnstyledButton>
  );

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(360px, 1fr) minmax(240px, 320px)',
        minHeight: 0,
      }}
    >
      <Stack gap={16} p="20px 24px" style={{ overflow: 'auto', minWidth: 0 }}>
        <Heading
          title="Assets"
          description="SVG artwork packaged with the theme. Controls in Image mode pick an asset from here and slice it."
          action={
            <Group gap={12} wrap="nowrap">
              <SegmentedControl
                size="xs"
                value={mode}
                onChange={(v) => setMode(v as 'grid' | 'list')}
                data={[
                  {
                    value: 'grid',
                    label: (
                      <IconLayoutGrid size={13} style={{ display: 'block' }} />
                    ),
                  },
                  {
                    value: 'list',
                    label: <IconList size={13} style={{ display: 'block' }} />,
                  },
                ]}
              />
              <Button
                size="xs"
                leftSection={<IconPlus size={14} />}
                onClick={() => setAdding(true)}
              >
                Add asset…
              </Button>
            </Group>
          }
        />
        <Group gap={10}>
          <TextInput
            size="xs"
            w={220}
            placeholder="Filter assets"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Group gap={6}>
            {chip('all', 'All', rows.length)}
            {chip('used', 'Used', rows.filter(used).length)}
            {chip('unused', 'Unused', rows.filter((r) => !used(r)).length)}
          </Group>
        </Group>
        {mode === 'grid' ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 12,
            }}
          >
            {shown.map((r) => (
              <AssetCard
                key={r.name}
                row={r}
                selected={r.name === current?.name}
                onSelect={() => setSelected(r.name)}
                name={nameCell(r)}
                menu={menu(r)}
              />
            ))}
            <DropZone onFile={(f) => void upload(f)} accept=".svg">
              <Stack
                gap={6}
                align="center"
                justify="center"
                mih={150}
                style={{ width: '100%', textAlign: 'center' }}
              >
                <IconUpload size={20} />
                Drop SVG here or browse
                <Text fz={11} c="dimmed">
                  Name defaults to the file name
                </Text>
              </Stack>
            </DropZone>
          </div>
        ) : (
          <Card shadow="xs" padding={0} style={{ overflowX: 'auto' }}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: COLUMNS,
                gap: 10,
                padding: '10px 14px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--mantine-color-dimmed)',
                textTransform: 'uppercase',
                letterSpacing: 0.4,
                borderBottom: '1px solid var(--mantine-color-default-border)',
              }}
            >
              <span />
              <span>Token</span>
              <span>File</span>
              <span>Used by</span>
              <span />
            </div>
            {shown.map((r) => (
              <AssetListRow
                key={r.name}
                row={r}
                selected={r.name === current?.name}
                onSelect={() => setSelected(r.name)}
                name={nameCell(r)}
                menu={menu(r)}
              />
            ))}
            {(adding || shown.length === 0) && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: COLUMNS,
                  alignItems: 'center',
                  gap: 10,
                  padding: '10px 14px',
                  fontSize: 13,
                  background: adding
                    ? 'var(--mantine-color-blue-light)'
                    : undefined,
                }}
              >
                <div
                  style={{
                    width: 44,
                    height: 32,
                    borderRadius: 4,
                    background: CHECKER,
                    border: '1px solid var(--mantine-color-default-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <IconUpload size={14} color="var(--mantine-color-dimmed)" />
                </div>
                <Text fz={12} c="dimmed">
                  New asset
                </Text>
                <DropZone onFile={(f) => void upload(f)} accept=".svg">
                  Drop SVG or browse
                </DropZone>
                <Text fz={11} c="dimmed">
                  Saves on drop
                </Text>
                {adding && (
                  <ActionIcon
                    size="sm"
                    variant="subtle"
                    color="gray"
                    aria-label="Discard"
                    onClick={() => setAdding(false)}
                  >
                    <IconTrash size={15} />
                  </ActionIcon>
                )}
              </div>
            )}
          </Card>
        )}
        {adding && mode === 'grid' && (
          <Text fz={12} c="dimmed">
            Drop an SVG on the dashed card, or click it to browse.
          </Text>
        )}
      </Stack>
      {current ? (
        <AssetDetail
          key={current.name}
          row={current}
          onReplace={(f) => void upload(f, current.name)}
        />
      ) : (
        <div
          style={{
            borderLeft: '1px solid var(--mantine-color-default-border)',
          }}
        />
      )}
    </div>
  );
}

function Preview({
  url,
  height,
  error,
}: {
  url?: string;
  height: number;
  error?: string;
}) {
  return (
    <div
      style={{
        height,
        borderRadius: 4,
        background: CHECKER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '1px solid var(--mantine-color-default-border)',
      }}
    >
      {url ? (
        <img src={url} alt="" style={{ maxWidth: '90%', maxHeight: '85%' }} />
      ) : (
        <Text fz={11} c={error ? 'red' : 'dimmed'}>
          {error ? 'Missing file' : '…'}
        </Text>
      )}
    </div>
  );
}

const fileLine = (r: Row, size: readonly [number, number] | undefined) =>
  `${(r.resolved.value ?? r.value).replace(/^\.\/assets\//, '')}${size ? ` · ${size[0]}×${size[1]}` : ''} · vector`;

function AssetCard({
  row: r,
  selected,
  onSelect,
  name,
  menu,
}: {
  row: Row;
  selected: boolean;
  onSelect(): void;
  name: React.ReactNode;
  menu: React.ReactNode;
}) {
  const svg = useSvg(r.resolved.value);
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        padding: 10,
        border: `1px solid ${selected ? 'var(--mantine-color-blue-6)' : 'var(--mantine-color-default-border)'}`,
        borderRadius: 'var(--mantine-radius-md)',
        background: 'var(--mantine-color-body)',
        boxShadow: selected ? '0 0 0 2px rgba(34,139,230,.2)' : undefined,
        cursor: 'pointer',
        minWidth: 0,
      }}
    >
      <Preview url={svg.url} height={72} error={svg.error} />
      <Group gap={4} wrap="nowrap" justify="space-between">
        <div
          style={{ minWidth: 0, flex: 1 }}
          onClick={(e) => e.stopPropagation()}
        >
          {name}
        </div>
        <div onClick={(e) => e.stopPropagation()}>{menu}</div>
      </Group>
      <Text fz={11} c={r.resolved.error ? 'red' : 'dimmed'} truncate>
        {r.resolved.error ?? fileLine(r, svg.size)}
      </Text>
      <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
    </div>
  );
}

function AssetListRow({
  row: r,
  selected,
  onSelect,
  name,
  menu,
}: {
  row: Row;
  selected: boolean;
  onSelect(): void;
  name: React.ReactNode;
  menu: React.ReactNode;
}) {
  const svg = useSvg(r.resolved.value);
  return (
    <div
      onClick={onSelect}
      style={{
        display: 'grid',
        gridTemplateColumns: COLUMNS,
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        borderBottom: '1px solid var(--mantine-color-default-border)',
        fontSize: 13,
        background: selected ? 'var(--mantine-color-blue-light)' : undefined,
        cursor: 'pointer',
      }}
    >
      <Preview url={svg.url} height={32} error={svg.error} />
      <div onClick={(e) => e.stopPropagation()}>{name}</div>
      <Stack gap={2} style={{ minWidth: 0 }}>
        <Text fz={12} truncate>
          {(r.resolved.value ?? r.value).replace(/^\.\/assets\//, '')}
        </Text>
        <Text fz={11} c={r.resolved.error ? 'red' : 'dimmed'} truncate>
          {r.resolved.error ??
            `${svg.size ? `${svg.size[0]}×${svg.size[1]} · ` : ''}vector`}
        </Text>
      </Stack>
      <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
      <div onClick={(e) => e.stopPropagation()}>{menu}</div>
    </div>
  );
}

function AssetDetail({
  row: r,
  onReplace,
}: {
  row: Row;
  onReplace(file: File): void;
}) {
  const path = r.resolved.value;
  const svg = useSvg(path);
  const dir = useProjectStore((s) => s.dir);
  const colors = useProjectStore((s) => s.doc.tokens.colors ?? EMPTY);
  const parsed = useMemo(() => {
    if (!svg.raw) return undefined;
    try {
      return { asset: parseAsset(svg.raw) };
    } catch (e) {
      return { error: (e as Error).message };
    }
  }, [svg.raw]);
  const [edited, setEdited] = useState<Asset>();
  const asset = edited ?? parsed?.asset;
  const [notes, setNotes] = useState<string[]>([]);
  // Edits show immediately and reach OPFS a moment later, or on unmount.
  const pending = useRef<{ timer: number; asset: Asset }>(undefined);
  const save = (a: Asset) => {
    setEdited(a);
    if (pending.current) clearTimeout(pending.current.timer);
    pending.current = {
      asset: a,
      timer: window.setTimeout(() => {
        pending.current = undefined;
        void persist(dir, path!, a).then(setNotes);
      }, 300),
    };
  };
  useEffect(
    () => () => {
      const p = pending.current;
      if (!p) return;
      clearTimeout(p.timer);
      pending.current = undefined;
      void persist(dir, path!, p.asset);
    },
    [dir, path],
  );
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
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--mantine-color-default-border)',
        }}
      >
        <Text fw={600} {...mono}>
          {r.name}
        </Text>
        <Text fz={12} c="dimmed" truncate>
          {fileLine(r, svg.size)}
          {svg.bytes ? ` · ${kb(svg.bytes)}` : ''}
        </Text>
      </div>
      <Stack gap={12} p={16} fz={12}>
        {asset?.slicing ? (
          <SliceEditor
            art={bakeColors(asset.art, colors)}
            viewBox={asset.viewBox}
            value={asset.slicing}
            onChange={(slicing) => save({ ...asset, slicing })}
            height={170}
          />
        ) : (
          <Preview url={svg.url} height={140} error={svg.error} />
        )}
        {parsed?.error && (
          <Text fz={11} c="red">
            {parsed.error}
          </Text>
        )}
        {notes.map((n) => (
          <Text key={n} fz={11} c="orange">
            {n}
          </Text>
        ))}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '70px 1fr',
            gap: '8px 12px',
            alignItems: 'center',
          }}
        >
          <Text c="dimmed" fz={12}>
            Logical
          </Text>
          <Text {...mono}>
            {asset
              ? `${asset.viewBox[2]} × ${asset.viewBox[3]}`
              : svg.size
                ? `${svg.size[0]} × ${svg.size[1]}`
                : '—'}
          </Text>
          <Text c="dimmed" fz={12}>
            Used by
          </Text>
          <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
        </div>
        <Text fz={11} c="dimmed" lh={1.5}>
          {asset?.slicing
            ? 'Slicing is stored in the SVG itself, so every control using this asset shares it.'
            : 'A plain image. Frame-style controls need slices, a content area and an overdraw margin: add them here.'}
        </Text>
        <Group gap={8}>
          <DropZone onFile={onReplace} accept=".svg" solid>
            Replace file…
          </DropZone>
          {asset &&
            (asset.slicing ? (
              <Button
                variant="subtle"
                size="xs"
                onClick={() => save({ ...asset, slicing: undefined })}
              >
                Remove slicing
              </Button>
            ) : (
              <Button
                variant="default"
                size="xs"
                onClick={() =>
                  save({ ...asset, slicing: defaultSlicing(asset.viewBox) })
                }
              >
                Add slicing
              </Button>
            ))}
          {/* ponytail: enabled once the Controls page exists. */}
          <Button variant="subtle" size="xs" disabled>
            Open in control
          </Button>
        </Group>
      </Stack>
    </div>
  );
}
