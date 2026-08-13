import { useState } from 'react';
import {
  Button,
  FileButton,
  NumberInput,
  SegmentedControl,
  Select,
  TextInput,
} from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import { parseNineSlice } from '@/theme/nineSlice';
import {
  DEFAULT_GEOMETRY,
  resolveGeometry,
  type CornerShape,
  type Edges,
  type Part,
  type PartState,
  type PathPart,
  type PathStateOverride,
  type ThemeColors,
  type ThemeToken,
} from '@/theme';
import PartSpecimen from './PartSpecimen';
import styles from './Studio.module.css';

const STATES: PartState[] = [
  'hover',
  'pressed',
  'focused',
  'disabled',
  'selected',
  'checked',
];
const INTERACTIVE_STATES: readonly string[] = ['hover', 'pressed', 'focused'];
const CORNERS: CornerShape[] = ['round', 'bevel', 'scoop', 'notch', 'squircle'];
const ROLES = [
  'bg',
  'surface',
  'surface-2',
  'border',
  'text',
  'muted',
  'accent',
  'success',
  'danger',
] as const;

function resolveToken(
  token: ThemeToken | undefined,
  colors: ThemeColors,
): string {
  if (!token || token === 'none') return 'transparent';
  return colors[token.slice('--theme-'.length) as keyof ThemeColors] ?? '#ff00ff';
}

/** Strip undefined fields so overrides stay minimal and serialisable. */
function prune<T extends object>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out) as (keyof T)[]) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

function parseThickness(text: string): number | Edges | undefined {
  const parts = text.trim().split(/\s+/).filter(Boolean).map(Number);
  if (!parts.length || parts.some(Number.isNaN)) return undefined;
  if (parts.length === 1) return parts[0];
  if (parts.length === 4) return parts as Edges;
  return undefined;
}

const thicknessText = (bt: number | Edges | undefined): string =>
  bt === undefined ? '' : typeof bt === 'number' ? String(bt) : bt.join(' ');

const TOKEN_OPTIONS = [
  { value: 'unset', label: '(default)' },
  { value: 'none', label: 'none' },
  ...ROLES.map((role) => ({
    value: `--theme-${role}`,
    label: `--theme-${role}`,
  })),
];

function TokenField({
  label,
  value,
  colors,
  disabled,
  onChange,
}: {
  label: string;
  value: ThemeToken | undefined;
  colors: ThemeColors;
  disabled: boolean;
  onChange: (token: ThemeToken | undefined) => void;
}) {
  return (
    <div className={styles.Row}>
      <span className={styles.Label}>{label}</span>
      <span
        className={styles.TokenSwatch}
        style={{ background: resolveToken(value, colors) }}
      />
      <Select
        size="xs"
        w={170}
        data={TOKEN_OPTIONS}
        value={value ?? 'unset'}
        disabled={disabled}
        allowDeselect={false}
        onChange={(next) =>
          next &&
          onChange(next === 'unset' ? undefined : (next as ThemeToken))
        }
        aria-label={label}
      />
    </div>
  );
}

/** Pick a part and a state in the page header; the frames below show what
 *  each edit scope covers, with a specimen of just that component. */
export default function ControlsPage() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();
  const disabled = !isCustomTheme;

  const geometry = resolveGeometry(theme.geometry);
  const partIds = [
    ...new Set([
      ...Object.keys(DEFAULT_GEOMETRY),
      ...Object.keys(theme.geometry ?? {}),
    ]),
  ];
  const [partId, setPartId] = useState('button');
  const [stateSel, setStateSel] = useState<'base' | PartState>('base');
  const [assetDraft, setAssetDraft] = useState('');
  const [uploadNote, setUploadNote] = useState<{
    kind: 'error' | 'ok';
    text: string;
  } | null>(null);
  const part: Part | undefined = geometry[partId];

  const writePart = (next: Part | undefined, assets?: Record<string, string>) => {
    const nextGeometry = { ...(theme.geometry ?? {}) };
    if (next) nextGeometry[partId] = next;
    else delete nextGeometry[partId];
    updateCustomTheme(themeId, {
      geometry: nextGeometry,
      ...(assets ? { assets } : {}),
    });
  };

  const editBase = (patch: Partial<PathPart>) => {
    if (part?.shape !== 'Path') return;
    writePart(prune({ ...part, ...patch }));
  };

  const editState = (state: PartState, patch: Partial<PathStateOverride>) => {
    if (part?.shape !== 'Path') return;
    const states = { ...(part.states ?? {}) };
    const merged = prune({ ...(states[state] ?? {}), ...patch });
    if (Object.keys(merged).length === 0) delete states[state];
    else states[state] = merged;
    writePart(
      prune({
        ...part,
        states: Object.keys(states).length ? states : undefined,
      }),
    );
  };

  /** Validate an uploaded .9.svg, store it as a data URL, wire it to the
   *  part under `assetKey`. Data URLs persist with the theme. */
  const applyAssetFile = (file: File | null, assetKey: string) => {
    if (!file) return;
    void file.text().then((text) => {
      try {
        const set = parseNineSlice(text, theme.colors);
        const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
        writePart(
          { shape: 'Asset', asset: assetKey },
          { ...theme.assets, [assetKey]: url },
        );
        const warn = set.warnings.length
          ? ` (${set.warnings.length} warning${set.warnings.length > 1 ? 's' : ''} — see console)`
          : '';
        setUploadNote({
          kind: 'ok',
          text: `${file.name}: valid ${set.cols}×${set.rows} nine-slice applied${warn}`,
        });
      } catch (err) {
        setUploadNote({
          kind: 'error',
          text: `${file.name}: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    });
  };

  const overridden = partId in (theme.geometry ?? {});
  const isPath = part?.shape === 'Path';
  const stateOverride =
    isPath && stateSel !== 'base' ? part.states?.[stateSel] : undefined;
  const scopeFields =
    stateSel === 'base'
      ? isPath
        ? part
        : undefined
      : stateOverride ?? {};

  return (
    <div className={styles.Tool}>
      {/* Page header: which component, which state — governs everything below. */}
      <div className={styles.PageHeader}>
        <Select
          size="xs"
          w={180}
          searchable
          data={partIds.map((id) => ({
            value: id,
            label: id + (id in (theme.geometry ?? {}) ? ' •' : ''),
          }))}
          value={partId}
          allowDeselect={false}
          onChange={(id) => {
            if (!id) return;
            setPartId(id);
            setStateSel('base');
            setUploadNote(null);
          }}
          aria-label="Component part"
        />
        {isPath && (
          <SegmentedControl
            size="xs"
            value={stateSel}
            onChange={(value) => setStateSel(value as 'base' | PartState)}
            data={(['base', ...STATES] as const).map((s) => ({
              value: s,
              label: s + (s !== 'base' && part.states?.[s] ? ' •' : ''),
            }))}
          />
        )}
        <span className={styles.Meta} style={{ marginLeft: 'auto' }}>
          {overridden ? 'themed override' : 'app default'} ·{' '}
          {part?.shape ?? 'missing'}
        </span>
        {overridden && !disabled && (
          <Button size="xs" variant="default" onClick={() => writePart(undefined)}>
            Reset to default
          </Button>
        )}
      </div>

      {part?.shape === 'Asset' && (
        <fieldset className={styles.Frame}>
          <legend>Asset surface</legend>
          <span className={styles.Meta}>
            This part renders the .9.svg asset "{part.asset}".
          </span>
          <div className={styles.Row}>
            <TextInput
              size="xs"
              style={{ flex: 1, minWidth: 220 }}
              value={theme.assets?.[part.asset] ?? ''}
              disabled={disabled}
              onChange={(e) =>
                updateCustomTheme(themeId, {
                  assets: { ...theme.assets, [part.asset]: e.target.value },
                })
              }
              aria-label="Asset URL"
            />
            {!disabled && (
              <>
                <FileButton
                  onChange={(file) => applyAssetFile(file, part.asset)}
                  accept=".svg,image/svg+xml"
                >
                  {(props) => (
                    <Button size="xs" variant="default" {...props}>
                      Upload replacement
                    </Button>
                  )}
                </FileButton>
                <Button
                  size="xs"
                  variant="default"
                  onClick={() =>
                    writePart({
                      shape: 'Path',
                      fill: '--theme-surface',
                      borderColor: '--theme-border',
                      borderThickness: 1,
                    })
                  }
                >
                  Convert to Path
                </Button>
              </>
            )}
          </div>
          {uploadNote && (
            <span
              className={uploadNote.kind === 'error' ? styles.Error : styles.Good}
            >
              {uploadNote.text}
            </span>
          )}
          <PartSpecimen partId={partId} state="base" />
        </fieldset>
      )}

      {isPath && scopeFields && (
        <>
          <fieldset className={styles.Frame}>
            <legend>
              {stateSel === 'base' ? 'Base style' : `${stateSel} overrides`}
            </legend>
            {stateSel !== 'base' && (
              <span className={styles.Meta}>
                Unset fields inherit the base values.
                {INTERACTIVE_STATES.includes(stateSel) &&
                  ` "${stateSel}" is interactive — hover, press, or focus the specimen to see it.`}
              </span>
            )}
            <TokenField
              label="Fill"
              value={scopeFields.fill}
              colors={theme.colors}
              disabled={disabled}
              onChange={(fill) =>
                stateSel === 'base'
                  ? editBase({ fill })
                  : editState(stateSel, { fill })
              }
            />
            <TokenField
              label="Border"
              value={scopeFields.borderColor}
              colors={theme.colors}
              disabled={disabled}
              onChange={(borderColor) =>
                stateSel === 'base'
                  ? editBase({ borderColor })
                  : editState(stateSel, { borderColor })
              }
            />
            <TokenField
              label="Content"
              value={scopeFields.contentColor}
              colors={theme.colors}
              disabled={disabled}
              onChange={(contentColor) =>
                stateSel === 'base'
                  ? editBase({ contentColor })
                  : editState(stateSel, { contentColor })
              }
            />
            <div className={styles.Row}>
              <TextInput
                key={`bw-${partId}-${stateSel}`}
                size="xs"
                w={130}
                label="Border width"
                placeholder="1 or 0 0 2 0"
                defaultValue={thicknessText(scopeFields.borderThickness)}
                disabled={disabled}
                onBlur={(e) => {
                  const borderThickness = parseThickness(e.target.value);
                  if (stateSel === 'base') editBase({ borderThickness });
                  else editState(stateSel, { borderThickness });
                }}
              />
              {stateSel !== 'base' && stateOverride && !disabled && (
                <Button
                  size="xs"
                  variant="default"
                  style={{ alignSelf: 'flex-end' }}
                  onClick={() =>
                    editState(stateSel, {
                      fill: undefined,
                      borderColor: undefined,
                      contentColor: undefined,
                      borderThickness: undefined,
                    })
                  }
                >
                  Clear state
                </Button>
              )}
            </div>
            <PartSpecimen partId={partId} state={stateSel} />
          </fieldset>

          <fieldset className={styles.Frame}>
            <legend>Shape — all states</legend>
            <div className={styles.Row}>
              <TextInput
                key={`rad-${partId}`}
                size="xs"
                w={90}
                label="Radius"
                placeholder="0 | pill"
                defaultValue={
                  part.radius === undefined ? '' : String(part.radius)
                }
                disabled={disabled}
                onBlur={(e) => {
                  const text = e.target.value.trim();
                  editBase({
                    radius:
                      text === ''
                        ? undefined
                        : text === 'pill'
                          ? 'pill'
                          : Number.isNaN(Number(text))
                            ? undefined
                            : Number(text),
                  });
                }}
              />
              <Select
                size="xs"
                w={120}
                label="Corner"
                data={[{ value: 'unset', label: '(default)' }, ...CORNERS]}
                value={part.corner ?? 'unset'}
                disabled={disabled}
                allowDeselect={false}
                onChange={(value) =>
                  value &&
                  editBase({
                    corner:
                      value === 'unset' ? undefined : (value as CornerShape),
                  })
                }
              />
              <NumberInput
                size="xs"
                w={120}
                label="Transition ms"
                min={0}
                max={2000}
                value={part.transition?.duration ?? ''}
                disabled={disabled}
                onChange={(value) =>
                  editBase({
                    transition:
                      typeof value === 'number'
                        ? { duration: value }
                        : undefined,
                  })
                }
              />
            </div>
          </fieldset>

          <fieldset className={styles.Frame}>
            <legend>Swap to a .9.svg asset</legend>
            <div className={styles.Row}>
              <FileButton
                onChange={(file) => applyAssetFile(file, partId)}
                accept=".svg,image/svg+xml"
                disabled={disabled}
              >
                {(props) => (
                  <Button size="xs" variant="default" disabled={disabled} {...props}>
                    Upload .9.svg
                  </Button>
                )}
              </FileButton>
              <span className={styles.Meta}>or</span>
              <TextInput
                size="xs"
                style={{ flex: 1, minWidth: 220 }}
                placeholder="/theme-assets/… or data: URL of a .9.svg"
                value={assetDraft}
                disabled={disabled}
                onChange={(e) => setAssetDraft(e.target.value)}
                aria-label="Asset URL"
              />
              <Button
                size="xs"
                variant="default"
                disabled={disabled || !assetDraft.trim()}
                onClick={() => {
                  writePart(
                    { shape: 'Asset', asset: partId },
                    { ...theme.assets, [partId]: assetDraft.trim() },
                  );
                  setAssetDraft('');
                }}
              >
                Apply URL
              </Button>
            </div>
            {uploadNote && (
              <span
                className={
                  uploadNote.kind === 'error' ? styles.Error : styles.Good
                }
              >
                {uploadNote.text}
              </span>
            )}
          </fieldset>
        </>
      )}
    </div>
  );
}
