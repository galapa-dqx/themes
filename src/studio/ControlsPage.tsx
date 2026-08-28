import { useState } from 'react';
import {
  Button,
  FileButton,
  NumberInput,
  SegmentedControl,
  Select,
  Switch,
  TextInput,
} from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import { parseNineSlice } from '@/theme/nineSlice';
import {
  CONTROL_IDS,
  TEXT_BEARING_CONTROLS,
  resolveColorValue,
  substituteTokens,
  type ColorValue,
  type ControlId,
  type CornerShape,
  type LabelCase,
  type PartState,
  type PathControl,
  type PathStateOverride,
  type TextTokenRef,
  type ThemeControls,
  type ColorTokenRef,
  type ThemeTokens,
  type TypeSpec,
} from '@/theme';
import EdgeInput from './EdgeInput';
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
const CASES: readonly LabelCase[] = ['none', 'uppercase', 'lowercase', 'capitalize'];

/** Normalize the authoring `text` field to the object form the editor works
 *  in. A shorthand string (`'--text-heading'`) becomes `{ style: '...' }`; an
 *  absent value becomes `{}`. The compiled output for both forms is the same,
 *  so this conversion is safe. */
function normalizeSpec(text: TypeSpec | undefined): Exclude<TypeSpec, string> {
  if (text === undefined) return {};
  if (typeof text === 'string') return { style: text };
  return text;
}

/** True when any field on this spec cherry-picks a piece — the editor's simple
 *  form doesn't render those, so we show an advisory instead. */
function hasPieceRef(spec: Exclude<TypeSpec, string>): boolean {
  const fields = ['family', 'fallback', 'weight', 'size', 'letterSpacing', 'case'] as const;
  return fields.some((f) => {
    const v = spec[f];
    return typeof v === 'string' && v.includes(':');
  });
}

/** A colour a control asks for → a swatch. Tokens and derivations both
 *  resolve; an unset value is transparent. */
function swatch(value: ColorValue | undefined, tokens: ThemeTokens): string {
  if (value === undefined) return 'transparent';
  return resolveColorValue(value, tokens, []);
}

/** Strip undefined fields so overrides stay minimal and serialisable. */
function prune<T extends object>(obj: T): T {
  const out = { ...obj };
  for (const key of Object.keys(out) as (keyof T)[]) {
    if (out[key] === undefined) delete out[key];
  }
  return out;
}

function TokenField({
  label,
  value,
  tokens,
  disabled,
  onChange,
}: {
  label: string;
  value: ColorValue | undefined;
  tokens: ThemeTokens;
  disabled: boolean;
  onChange: (token: ColorTokenRef | undefined) => void;
}) {
  // Derivations (mix/alpha) are authored in code; the picker edits tokens.
  const derived = typeof value === 'object' && value !== null;
  const token = typeof value === 'string' ? value : undefined;
  const options = [
    { value: 'unset', label: '(default)' },
    { value: 'none', label: 'none' },
    ...Object.keys(tokens.colors).map((role) => ({
      value: `--color-${role}`,
      label: `--color-${role}`,
    })),
  ];
  return (
    <div className={styles.Row}>
      <span className={styles.Label}>{label}</span>
      <span
        className={styles.TokenSwatch}
        style={{ background: swatch(value, tokens) }}
      />
      {derived ? (
        <span className={styles.Meta}>derived — edit in code</span>
      ) : (
        <Select
          size="xs"
          w={170}
          data={options}
          value={token ?? 'unset'}
          disabled={disabled}
          allowDeselect={false}
          onChange={(next) =>
            next && onChange(next === 'unset' ? undefined : (next as ColorTokenRef))
          }
          aria-label={label}
        />
      )}
    </div>
  );
}

/** Text-spec editor: pick a whole-token style plus optional literal overrides
 *  for size / letter-spacing / case. A control that cherry-picks pieces
 *  (`--text-…:family`) is authored in code — flag it and don't overwrite. */
function TextSpecEditor({
  value,
  tokens,
  required,
  disabled,
  onChange,
}: {
  value: TypeSpec | undefined;
  tokens: ThemeTokens;
  /** True for text-bearing controls — an empty style is a runtime error, so
   *  the picker never lets you clear it below 'unset'. */
  required: boolean;
  disabled: boolean;
  onChange: (next: TypeSpec | undefined) => void;
}) {
  const spec = normalizeSpec(value);
  const advanced = hasPieceRef(spec);

  const styleOptions = [
    { value: 'unset', label: required ? '(pick a style)' : '(default)' },
    ...Object.keys(tokens.text).map((name) => ({
      value: `--text-${name}`,
      label: `--text-${name}`,
    })),
  ];

  const patch = (next: Exclude<TypeSpec, string>) => {
    const cleaned: Exclude<TypeSpec, string> = {};
    if (next.style) cleaned.style = next.style;
    for (const k of ['family', 'fallback', 'weight', 'size', 'letterSpacing', 'case'] as const) {
      if (next[k] !== undefined) (cleaned as Record<string, unknown>)[k] = next[k];
    }
    // Collapse the whole-token-with-no-overrides case back to the shorthand
    // string form; the resolver treats both identically.
    if (cleaned.style && Object.keys(cleaned).length === 1) {
      onChange(cleaned.style);
    } else if (Object.keys(cleaned).length === 0) {
      onChange(undefined);
    } else {
      onChange(cleaned);
    }
  };

  if (advanced) {
    return (
      <div className={styles.Row}>
        <span className={styles.Label}>Type</span>
        <span className={styles.Meta}>
          cherry-picks a piece — authored in code
        </span>
      </div>
    );
  }

  return (
    <>
      <div className={styles.Row}>
        <Select
          size="xs"
          w={200}
          label="Style"
          data={styleOptions}
          value={spec.style ?? 'unset'}
          disabled={disabled}
          allowDeselect={false}
          onChange={(next) =>
            next &&
            patch({
              ...spec,
              style: next === 'unset' ? undefined : (next as TextTokenRef),
            })
          }
          aria-label="Text style"
        />
        <Select
          size="xs"
          w={130}
          label="Case"
          data={[{ value: 'unset', label: '(inherit)' }, ...CASES]}
          value={typeof spec.case === 'string' ? spec.case : 'unset'}
          disabled={disabled}
          allowDeselect={false}
          onChange={(next) =>
            next &&
            patch({
              ...spec,
              case: next === 'unset' ? undefined : (next as LabelCase),
            })
          }
        />
      </div>
      <div className={styles.Row}>
        <NumberInput
          size="xs"
          w={110}
          min={6}
          max={96}
          step={1}
          label="Size"
          placeholder="(inherit)"
          value={typeof spec.size === 'number' ? spec.size : ''}
          disabled={disabled}
          onChange={(next) =>
            patch({
              ...spec,
              size: typeof next === 'number' ? next : undefined,
            })
          }
        />
        <NumberInput
          size="xs"
          w={130}
          step={0.1}
          label="Tracking"
          placeholder="(inherit)"
          value={typeof spec.letterSpacing === 'number' ? spec.letterSpacing : ''}
          disabled={disabled}
          onChange={(next) =>
            patch({
              ...spec,
              letterSpacing: typeof next === 'number' ? next : undefined,
            })
          }
        />
      </div>
    </>
  );
}

/** Pick a control and a state in the page header; the frames below show what
 *  each edit scope covers, with a specimen of just that component. */
export default function ControlsPage() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();
  const disabled = !isCustomTheme;
  const tokens = theme.tokens;

  const [partId, setPartId] = useState<ControlId>('button');
  const [stateSel, setStateSel] = useState<'base' | PartState>('base');
  const [assetDraft, setAssetDraft] = useState('');
  const [uploadNote, setUploadNote] = useState<{
    kind: 'error' | 'ok';
    text: string;
  } | null>(null);

  const control = theme.controls[partId];
  const isWindow = partId === 'window';
  const shape = isWindow ? 'Window' : 'shape' in control ? control.shape : 'Text';
  const isPath = shape === 'Path';
  const path = isPath ? (control as PathControl) : undefined;

  const editWindow = (patch: { fill?: ColorValue; contentColor?: ColorValue; borderColor?: ColorValue }) => {
    updateCustomTheme(themeId, {
      controls: {
        ...theme.controls,
        window: prune({ ...control, ...patch }),
      } as ThemeControls,
    });
  };

  const writeControl = (
    next: PathControl | { shape: 'Asset'; asset: string; contentColor?: ColorValue },
    assets?: Record<string, string>,
  ) => {
    updateCustomTheme(themeId, {
      controls: { ...theme.controls, [partId]: next } as ThemeControls,
      ...(assets ? { assets: { ...theme.assets, ...assets } } : {}),
    });
  };

  const editBase = (patch: Partial<PathControl>) => {
    if (!path) return;
    writeControl(prune({ ...path, ...patch }) as PathControl);
  };

  const editState = (
    state: PartState,
    patch: Partial<PathStateOverride> & { showRing?: boolean },
  ) => {
    if (!path) return;
    const states = { ...(path.states ?? {}) };
    const merged = prune({ ...(states[state] ?? {}), ...patch });
    if (Object.keys(merged).length === 0) delete states[state];
    else states[state] = merged;
    writeControl(
      prune({
        ...path,
        states: Object.keys(states).length ? states : undefined,
      }) as PathControl,
    );
  };

  /** Validate an uploaded .9.svg, store its raw text as a data URL, wire it to
   *  the control under `assetKey`. The resolver substitutes tokens later. */
  const applyAssetFile = (file: File | null, assetKey: string) => {
    if (!file) return;
    void file.text().then((text) => {
      try {
        const set = parseNineSlice(substituteTokens(text, tokens));
        const url = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(text)))}`;
        writeControl({ shape: 'Asset', asset: assetKey }, { [assetKey]: url });
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

  const stateOverride =
    path && stateSel !== 'base' ? path.states?.[stateSel] : undefined;
  const scopeFields: PathStateOverride | PathControl | undefined =
    stateSel === 'base' ? path : (stateOverride ?? {});

  return (
    <div className={styles.Tool}>
      {/* Page header: which control, which state — governs everything below. */}
      <div className={styles.PageHeader}>
        <Select
          size="xs"
          w={200}
          searchable
          data={CONTROL_IDS.map((id) => ({
            value: id,
            label: id + (theme.controls[id] && 'shape' in theme.controls[id] ? '' : ' ·'),
          }))}
          value={partId}
          allowDeselect={false}
          onChange={(id) => {
            if (!id) return;
            setPartId(id as ControlId);
            setStateSel('base');
            setUploadNote(null);
          }}
          aria-label="Control"
        />
        {isPath && (
          <SegmentedControl
            size="xs"
            value={stateSel}
            onChange={(value) => setStateSel(value as 'base' | PartState)}
            data={(['base', ...STATES] as const).map((s) => ({
              value: s,
              label: s + (s !== 'base' && path?.states?.[s] ? ' •' : ''),
            }))}
          />
        )}
        <span className={styles.Meta} style={{ marginLeft: 'auto' }}>
          {shape}
        </span>
      </div>

      {shape === 'Window' && (
        <fieldset className={styles.Frame}>
          <legend>Window</legend>
          <span className={styles.Meta}>
            The app frame: its fill is the background, its content colour the
            text baseline, and its border wraps the whole window. No corners,
            states or art — a native window has none.
          </span>
          <TokenField
            label="Fill"
            value={(control as { fill?: ColorValue }).fill}
            tokens={tokens}
            disabled={disabled}
            onChange={(fill) => editWindow({ fill })}
          />
          <TokenField
            label="Content"
            value={(control as { contentColor?: ColorValue }).contentColor}
            tokens={tokens}
            disabled={disabled}
            onChange={(contentColor) => editWindow({ contentColor })}
          />
          <TokenField
            label="Border"
            value={(control as { borderColor?: ColorValue }).borderColor}
            tokens={tokens}
            disabled={disabled}
            onChange={(borderColor) => editWindow({ borderColor })}
          />
          <PartSpecimen partId={partId} state="base" />
        </fieldset>
      )}

      {shape === 'Text' && (
        <fieldset className={styles.Frame}>
          <legend>Text control</legend>
          <span className={styles.Meta}>
            A text control carries colour and type only.
          </span>
          {'contentColor' in control && (
            <TokenField
              label="Content"
              value={control.contentColor}
              tokens={tokens}
              disabled={disabled}
              onChange={(contentColor) =>
                updateCustomTheme(themeId, {
                  controls: {
                    ...theme.controls,
                    [partId]: prune({ ...control, contentColor }),
                  } as ThemeControls,
                })
              }
            />
          )}
          {'borderColor' in control && (
            <TokenField
              label="Border"
              value={control.borderColor}
              tokens={tokens}
              disabled={disabled}
              onChange={(borderColor) =>
                updateCustomTheme(themeId, {
                  controls: {
                    ...theme.controls,
                    [partId]: prune({ ...control, borderColor }),
                  } as ThemeControls,
                })
              }
            />
          )}
          {(TEXT_BEARING_CONTROLS as readonly ControlId[]).includes(partId) && (
            <TextSpecEditor
              value={(control as { text?: TypeSpec }).text}
              tokens={tokens}
              required
              disabled={disabled}
              onChange={(text) =>
                updateCustomTheme(themeId, {
                  controls: {
                    ...theme.controls,
                    [partId]: prune({ ...control, text }),
                  } as ThemeControls,
                })
              }
            />
          )}
          <PartSpecimen partId={partId} state="base" />
        </fieldset>
      )}

      {shape === 'Asset' && 'shape' in control && control.shape === 'Asset' && (
        <fieldset className={styles.Frame}>
          <legend>Asset surface</legend>
          <span className={styles.Meta}>
            This control renders the .9.svg asset "{control.asset}".
          </span>
          <div className={styles.Row}>
            <TextInput
              size="xs"
              style={{ flex: 1, minWidth: 220 }}
              value={theme.assets?.[control.asset] ?? ''}
              disabled={disabled}
              onChange={(e) =>
                updateCustomTheme(themeId, {
                  assets: { ...theme.assets, [control.asset]: e.target.value },
                })
              }
              aria-label="Asset URL"
            />
            {!disabled && (
              <>
                <FileButton
                  onChange={(file) => applyAssetFile(file, control.asset)}
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
                    writeControl({
                      shape: 'Path',
                      fill: '--color-surface',
                      borderColor: '--color-border',
                      borderThickness: 1,
                    })
                  }
                >
                  Convert to Path
                </Button>
              </>
            )}
          </div>
          <TokenField
            label="Content"
            value={control.contentColor}
            tokens={tokens}
            disabled={disabled}
            onChange={(contentColor) =>
              writeControl(
                prune({ ...control, contentColor }) as unknown as PathControl,
              )
            }
          />
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

      {isPath && path && scopeFields && (
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
            {stateSel === 'focused' && (
              <Switch
                size="xs"
                label="Show app focus ring"
                description="Turn this off only when the focused state supplies its own visible treatment."
                checked={path.states?.focused?.showRing !== false}
                disabled={disabled}
                onChange={(event) =>
                  editState('focused', {
                    showRing: event.currentTarget.checked ? undefined : false,
                  })
                }
              />
            )}
            <TokenField
              label="Fill"
              value={scopeFields.fill}
              tokens={tokens}
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
              tokens={tokens}
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
              tokens={tokens}
              disabled={disabled}
              onChange={(contentColor) =>
                stateSel === 'base'
                  ? editBase({ contentColor })
                  : editState(stateSel, { contentColor })
              }
            />
            <div className={styles.Row}>
              <EdgeInput
                label="Border width"
                width={130}
                value={scopeFields.borderThickness}
                disabled={disabled}
                onChange={(borderThickness) => {
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
                      opacity: undefined,
                      showRing: undefined,
                    })
                  }
                >
                  Clear state
                </Button>
              )}
            </div>
            <PartSpecimen partId={partId} state={stateSel} />
          </fieldset>

          {(TEXT_BEARING_CONTROLS as readonly ControlId[]).includes(partId) && (
            <fieldset className={styles.Frame}>
              <legend>Typography — all states</legend>
              <span className={styles.Meta}>
                A text-bearing control needs a complete style. Pick a{' '}
                <code>--text-*</code> token and override size / tracking / case
                inline as needed.
              </span>
              <TextSpecEditor
                value={path.text}
                tokens={tokens}
                required
                disabled={disabled}
                onChange={(text) => editBase({ text })}
              />
            </fieldset>
          )}

          <fieldset className={styles.Frame}>
            <legend>Shape — all states</legend>
            <div className={styles.Row}>
              <TextInput
                key={`rad-${partId}`}
                size="xs"
                w={90}
                label="Radius"
                placeholder="0 | pill"
                defaultValue={path.radius === undefined ? '' : String(path.radius)}
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
                value={path.corner ?? 'unset'}
                disabled={disabled}
                allowDeselect={false}
                onChange={(value) =>
                  value &&
                  editBase({
                    corner: value === 'unset' ? undefined : (value as CornerShape),
                  })
                }
              />
              <EdgeInput
                label="Padding"
                width={130}
                value={path.padding}
                disabled={disabled}
                onChange={(padding) => editBase({ padding })}
              />
            </div>
            <span className={styles.Meta}>
              Clear every box and the component keeps its own layout padding.
            </span>
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
                  writeControl(
                    { shape: 'Asset', asset: partId },
                    { [partId]: assetDraft.trim() },
                  );
                  setAssetDraft('');
                }}
              >
                Apply URL
              </Button>
            </div>
            {uploadNote && (
              <span
                className={uploadNote.kind === 'error' ? styles.Error : styles.Good}
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
