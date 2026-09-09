/**
 * 4h: font sources (Google Fonts families or local TTF/OTF/TTC/OTC files),
 * with samples rendered in the real font, faces read from the file by
 * fontTools or from the Google Fonts catalog, and a detail panel.
 */
import { useRef, useState, type ReactNode } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Badge,
  Button,
  Card,
  Group,
  Stack,
  Text,
  UnstyledButton,
} from '@mantine/core';
import {
  IconBrandGoogle,
  IconFileTypography,
  IconInfoCircle,
  IconPlus,
  IconTrash,
  IconUpload,
} from '@tabler/icons-react';
import type { FontInfo } from '@/compiler/fontTools';
import type { GoogleFont } from '@/compiler/googleFonts';
import { writeProjectFile } from './persistence';
import { useProjectStore } from './projectStore';
import { runtime } from './runtime';
import { Heading, NameInput, RowMenu, UsedBy } from './tokensShared';
import {
  EMPTY,
  kb,
  mono,
  nameFromFile,
  safeFileName,
  useRename,
} from './tokensUtil';
import {
  fontLabel,
  freeName,
  replaceReferences,
  TOKEN_NAME,
  type TokenView,
} from './tokenView';
import {
  googleFaces,
  useFontFamily,
  useFontInfo,
  useGoogleCatalog,
  useGoogleFont,
  useProjectFile,
} from './useProjectFile';

const COLUMNS = '100px minmax(0, 1fr) 120px minmax(90px, 1fr) 20px';
const row = (extra?: React.CSSProperties): React.CSSProperties => ({
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
const FONT_EXT = /\.(ttf|ttc|otf|otc)$/i;

type Row = TokenView['fonts'][number];
type FaceLine = { weight: number; style: string; variable: boolean };

/** Face chips: axis ranges for variable sources, weights and italic otherwise. */
const faceChips = (
  info: FontInfo | undefined,
  google: GoogleFont | undefined,
): string[] => {
  const chips: string[] = [];
  if (google) {
    const f = googleFaces(google);
    if (f.wght) chips.push(`wght ${f.wght[0]}–${f.wght[1]}`);
    else if (f.weights.length) chips.push(f.weights.join(' · '));
    chips.push(...f.otherAxes);
    if (f.italic) chips.push('italic');
    return chips;
  }
  if (!info) return chips;
  const wght = info.axes.find((a) => a.tag === 'wght');
  if (wght) chips.push(`wght ${wght.min}–${wght.max}`);
  else {
    const weights = [...new Set(info.faces.map((f) => f.weight))].sort(
      (a, b) => a - b,
    );
    if (weights.length) chips.push(weights.join(' · '));
  }
  for (const a of info.axes) if (a.tag !== 'wght') chips.push(a.tag);
  if (info.faces.some((f) => f.style !== 'normal')) chips.push('italic');
  return chips;
};

/** The faces a Google family offers, as lines for the detail panel. */
const googleFaceLines = (google: GoogleFont): FaceLine[] => {
  const f = googleFaces(google);
  const styles = f.italic ? ['normal', 'italic'] : ['normal'];
  return f.wght
    ? styles.map((style) => ({ weight: 400, style, variable: true }))
    : f.weights.flatMap((weight) =>
        styles.map((style) => ({ weight, style, variable: false })),
      );
};

/** Everything a row needs to know about its source, from the file or the catalog. */
function useSource(source: string | undefined) {
  const gfont = source?.startsWith('gfont:');
  const family = useFontFamily(source);
  const file = useProjectFile(gfont ? undefined : source);
  const inspected = useFontInfo(gfont ? undefined : source, file?.file?.bytes);
  const google = useGoogleFont(source);
  const catalogLoaded = useGoogleCatalog().length > 0;
  return {
    gfont,
    family,
    file,
    info: inspected?.info,
    inspectError: inspected?.error,
    google,
    catalogLoaded,
  };
}

export function FontsPage({ view }: { view: TokenView }) {
  const [selected, setSelected] = useState<string>();
  const rows = view.fonts;
  const current = rows.find((r) => r.name === selected) ?? rows[0];
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(360px, 1fr) minmax(240px, 320px)',
        minHeight: 0,
      }}
    >
      <Stack gap={16} p="20px 24px" style={{ overflow: 'auto', minWidth: 0 }}>
        <FontTable
          rows={rows}
          selected={current?.name}
          onSelect={setSelected}
        />
      </Stack>
      {current ? (
        <FontDetail key={current.name} row={current} />
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

function FontTable({
  rows,
  selected,
  onSelect,
}: {
  rows: Row[];
  selected?: string;
  onSelect(name: string): void;
}) {
  const edit = useProjectStore((s) => s.edit);
  const dir = useProjectStore((s) => s.dir);
  const fonts = useProjectStore((s) => s.doc.tokens.fonts ?? EMPTY);
  const { renaming, setRenaming, commit } = useRename('fonts');
  const [draft, setDraft] = useState<{ name: string; family: string }>();
  const catalog = useGoogleCatalog();
  const taken = (n: string) => n in fonts;
  const query = draft?.family.trim().toLowerCase() ?? '';
  const matches = query
    ? catalog
        .filter((f) => f.family.toLowerCase().includes(query))
        .slice(0, 40)
        .map((f) => f.family)
    : [];

  const addSource = (name: string, source: string) => {
    if (!name || !TOKEN_NAME.test(name) || taken(name)) return;
    edit('Add font', (d) => void ((d.tokens.fonts ??= {})[name] = source));
    setDraft(undefined);
    onSelect(name);
  };
  const addGoogle = (picked = draft?.family.trim()) => {
    if (!draft || !picked) return;
    // Canonical capitalization and `+` separators come from the catalog when it knows the family.
    const family =
      catalog.find((f) => f.family.toLowerCase() === picked.toLowerCase())
        ?.family ?? picked;
    addSource(
      draft.name || nameFromFile(family),
      `gfont:${family.replace(/\s+/g, '+')}`,
    );
  };
  const upload = async (
    file: File,
    name = draft?.name || nameFromFile(file.name),
  ) => {
    if (!FONT_EXT.test(file.name)) return;
    const path = `./assets/fonts/${safeFileName(file.name)}`;
    await runtime.runPromise(
      writeProjectFile(dir, path, new Uint8Array(await file.arrayBuffer())),
    );
    addSource(taken(name) ? freeName(fonts, name) : name, path);
  };

  return (
    <>
      <Heading
        title="Fonts"
        description="Named font sources: a Google Fonts family or a local TTF / OTF / TTC / OTC file. Typography picks a token here and then chooses weight, style and axes from what the source provides."
        action={
          <Button
            size="xs"
            leftSection={<IconPlus size={14} />}
            onClick={() => setDraft({ name: '', family: '' })}
          >
            Add font…
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
          <span>Sample · source</span>
          <span>Faces</span>
          <span>Used by</span>
          <span />
        </div>
        {draft && (
          <div style={row({ background: 'var(--mantine-color-blue-light)' })}>
            <NameInput
              value={draft.name}
              onChange={(name) => setDraft({ ...draft, name })}
              taken={taken}
              onSubmit={() => addGoogle()}
              onCancel={() => setDraft(undefined)}
            />
            <Group gap={6} wrap="nowrap" style={{ minWidth: 0 }}>
              <Autocomplete
                size="xs"
                flex={1}
                leftSection={<IconBrandGoogle size={14} />}
                placeholder={
                  catalog.length
                    ? 'Search Google Fonts…'
                    : 'Google Fonts family…'
                }
                data={matches}
                limit={40}
                value={draft.family}
                onChange={(family) =>
                  setDraft((d) => (d ? { ...d, family } : d))
                }
                onOptionSubmit={(family) => addGoogle(family)}
                onKeyDown={(e) =>
                  e.key === 'Enter' &&
                  !matches.includes(draft.family) &&
                  addGoogle()
                }
              />
              <DropZone
                onFile={(f) => void upload(f)}
                accept=".ttf,.ttc,.otf,.otc"
              >
                <IconUpload size={14} /> or drop a file
              </DropZone>
            </Group>
            <Text fz={11} c="dimmed">
              Read from source
            </Text>
            <Text fz={11} c="dimmed">
              Saves once resolved
            </Text>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Discard"
              onClick={() => setDraft(undefined)}
            >
              <IconTrash size={15} />
            </ActionIcon>
          </div>
        )}
        {rows.map((r) => (
          <FontRow
            key={r.name}
            row={r}
            selected={r.name === selected}
            onSelect={() => onSelect(r.name)}
            name={
              renaming?.from === r.name ? (
                <NameInput
                  value={renaming.to}
                  onChange={(to) => setRenaming({ ...renaming, to })}
                  taken={(n) => n !== r.name && taken(n)}
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
                      void (d.tokens.fonts![freeName(d.tokens.fonts!, r.name)] =
                        r.value),
                  )
                }
                replace={{
                  options: rows.map((x) => x.name).filter((n) => n !== r.name),
                  onReplace: (to) =>
                    edit(`Replace ${r.name}`, (d) =>
                      replaceReferences(d, 'fonts', r.name, to),
                    ),
                }}
                onDelete={() =>
                  edit(
                    `Delete ${r.name}`,
                    (d) => void delete d.tokens.fonts![r.name],
                  )
                }
              />
            }
          />
        ))}
        {rows.length === 0 && !draft && (
          <Text p={16} c="dimmed" fz={13}>
            No fonts yet.
          </Text>
        )}
        <Group gap={8} p="10px 14px" fz={12} c="dimmed" wrap="nowrap">
          <IconInfoCircle size={14} style={{ flex: 'none' }} />
          Google Fonts references resolve to the current upstream bytes on each
          export; local files are inspected directly. Export compiles each used
          weight / style / axis combination to one static face.
        </Group>
      </Card>
    </>
  );
}

function FontRow({
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
  const source = r.resolved.value;
  const { gfont, family, file, info, inspectError, google, catalogLoaded } =
    useSource(source);
  const chips = faceChips(info, google);
  const sourceLine = gfont
    ? `${source} · ${google ? (google.axes ? 'variable' : 'static') : 'Google Fonts'}`
    : `${source?.replace(/^\.\//, '')}${info ? ` · ${info.faces.length} face${info.faces.length === 1 ? '' : 's'}` : ''}${file?.file ? ` · ${kb(file.file.bytes.length)}` : ''}`;
  const empty = gfont
    ? catalogLoaded
      ? 'Not in Google Fonts'
      : 'Loading catalog…'
    : inspectError
      ? 'Unreadable'
      : file?.error
        ? 'Missing file'
        : 'Reading…';
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
        <span
          style={{
            font: `400 18px/1.1 ${family ? `'${family}', ` : ''}sans-serif`,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {SAMPLE}
        </span>
        <Text
          fz={11}
          c={r.resolved.error ? 'red' : 'dimmed'}
          truncate
          style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
        >
          {gfont ? (
            <IconBrandGoogle size={12} />
          ) : (
            <IconFileTypography size={12} />
          )}
          {r.resolved.error ?? sourceLine}
        </Text>
      </Stack>
      <Group gap={4}>
        {chips.map((c) => (
          <Badge
            key={c}
            variant="light"
            color="gray"
            size="sm"
            tt="none"
            fw={400}
          >
            {c}
          </Badge>
        ))}
        {chips.length === 0 && (
          <Text fz={11} c="dimmed">
            {empty}
          </Text>
        )}
      </Group>
      <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
      <div onClick={(e) => e.stopPropagation()}>{menu}</div>
    </div>
  );
}

function FontDetail({ row: r }: { row: Row }) {
  const dir = useProjectStore((s) => s.dir);
  const edit = useProjectStore((s) => s.edit);
  const source = r.resolved.value;
  const { gfont, family, file, info, google, catalogLoaded } =
    useSource(source);
  const faces: readonly FaceLine[] | undefined =
    info?.faces ?? (google ? googleFaceLines(google) : undefined);
  const axes = info?.axes.length
    ? info.axes.map((a) => `${a.tag} ${a.min}–${a.max}`)
    : (google?.axes?.map((a) => `${a.tag} ${a.start}–${a.end}`) ?? []);
  const replace = async (f: File) => {
    if (!FONT_EXT.test(f.name)) return;
    const path = `./assets/fonts/${safeFileName(f.name)}`;
    await runtime.runPromise(
      writeProjectFile(dir, path, new Uint8Array(await f.arrayBuffer())),
    );
    edit(`Replace ${r.name}`, (d) => void (d.tokens.fonts![r.name] = path));
  };
  const label = (t: string) => (
    <Text fz={11} fw={600} c="dimmed" tt="uppercase" lts={0.4}>
      {t}
    </Text>
  );
  const kindLabel = gfont
    ? google
      ? google.axes
        ? 'Google Fonts · variable'
        : 'Google Fonts · static'
      : 'Google Fonts'
    : (info?.faces.length ?? 0) > 1
      ? 'local collection'
      : 'local file';
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
        <Text fz={12} c="dimmed">
          {google?.family ?? info?.family ?? (source ? fontLabel(source) : '')}{' '}
          · {kindLabel}
        </Text>
      </div>
      <Stack gap={14} p={16} fz={12}>
        {label('Source')}
        <Group
          gap={8}
          wrap="nowrap"
          p="6px 10px"
          style={{
            border: '1px solid var(--mantine-color-default-border)',
            borderRadius: 4,
            background: 'var(--mantine-color-body)',
            minWidth: 0,
          }}
        >
          {gfont ? (
            <IconBrandGoogle size={15} color="var(--mantine-color-dimmed)" />
          ) : (
            <IconFileTypography size={15} color="var(--mantine-color-dimmed)" />
          )}
          <Text {...mono} truncate style={{ flex: 1 }}>
            {source?.replace(/^\.\//, '')}
          </Text>
          {file?.file && (
            <Text fz={11} c="dimmed">
              {kb(file.file.bytes.length)}
            </Text>
          )}
        </Group>
        {label('Faces found')}
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 'var(--mantine-radius-sm)',
            border: '1px solid var(--mantine-color-default-border)',
            background: 'var(--mantine-color-body)',
            display: 'grid',
            gridTemplateColumns: '1fr auto',
            gap: '8px 12px',
            alignItems: 'center',
          }}
        >
          {faces ? (
            faces.map((f, i) => (
              <span key={i} style={{ display: 'contents' }}>
                <span
                  style={{
                    font: `${f.style === 'normal' ? '' : 'italic '}${f.weight} 18px/1.2 ${family ? `'${family}', ` : ''}sans-serif`,
                  }}
                >
                  {SAMPLE}
                </span>
                <Text {...mono} fz={11} c="dimmed">
                  {f.variable ? 'variable' : f.weight} {f.style}
                </Text>
              </span>
            ))
          ) : (
            <Text c="dimmed" fz={12} style={{ gridColumn: '1 / -1' }}>
              {gfont
                ? catalogLoaded
                  ? 'Not in Google Fonts'
                  : 'Loading catalog…'
                : 'Reading…'}
            </Text>
          )}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '70px minmax(0, 1fr)',
            gap: '8px 12px',
            alignItems: 'center',
          }}
        >
          <Text c="dimmed" fz={12}>
            Axes
          </Text>
          <Text fz={12} c={axes.length ? undefined : 'dimmed'}>
            {axes.length ? axes.join(' · ') : 'none · static faces'}
          </Text>
          <Text c="dimmed" fz={12}>
            License
          </Text>
          <div>
            <Text fz={12}>
              {info?.license.identifier ??
                info?.license.description ??
                (gfont ? 'From Google Fonts on export' : '—')}
            </Text>
            {info && (
              <Text fz={11} c="dimmed">
                From embedded name table · packaged as-is
              </Text>
            )}
          </div>
          <Text c="dimmed" fz={12}>
            Used by
          </Text>
          <UsedBy controls={r.usedBy} tokens={r.usedByTokens} />
        </div>
        <Group gap={8}>
          <DropZone
            onFile={(f) => void replace(f)}
            accept=".ttf,.ttc,.otf,.otc"
            solid
          >
            Replace source…
          </DropZone>
          {/* ponytail: enabled once the Controls page can show a token's uses. */}
          <Button variant="subtle" size="xs" disabled>
            Find uses
          </Button>
        </Group>
      </Stack>
    </div>
  );
}

/** A file button that also accepts drops. `solid` renders as a default button. */
export function DropZone({
  onFile,
  accept,
  children,
  solid,
}: {
  onFile(file: File): void;
  accept: string;
  children: ReactNode;
  solid?: boolean;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
      />
      <UnstyledButton
        onClick={() => input.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files[0];
          if (f) onFile(f);
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          padding: solid ? '5px 12px' : '5px 10px',
          border: `1px ${solid ? 'solid' : 'dashed'} var(--mantine-color-${over ? 'blue-6' : solid ? 'default-border' : 'gray-5'})`,
          borderRadius: 4,
          fontSize: 12,
          fontWeight: solid ? 500 : undefined,
          color: solid ? undefined : 'var(--mantine-color-dimmed)',
          background: 'var(--mantine-color-body)',
          whiteSpace: 'nowrap',
          flex: 'none',
        }}
      >
        {children}
      </UnstyledButton>
    </>
  );
}
