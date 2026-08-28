import { useEffect, useState } from 'react';
import {
  ActionIcon,
  Autocomplete,
  Button,
  Checkbox,
  ColorInput,
  NumberInput,
  Select,
  TextInput,
} from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import type { LabelCase, TextStyle, ThemeMode, ThemeTokens } from '@/theme';
import { ensureFontLoaded, fetchGoogleFonts } from '@/theme/googleFonts';
import SpecimenIsland from './SpecimenIsland';
import styles from './Studio.module.css';

/** The nine convention colour names, as documentation — the namespace is open,
 *  so a fork adds, renames or removes freely. */
const COLOR_HINTS: Record<string, string> = {
  bg: 'App background',
  surface: 'Cards, panels, inputs',
  'surface-2': 'Chrome strips, tracks',
  border: 'Outlines, faint text',
  text: 'Primary text',
  muted: 'Secondary text, labels',
  accent: 'Selection, primary actions',
  success: 'Positive category color',
  danger: 'Errors, close button',
};

const HEX = /^#[0-9a-f]{6}$/i;

const SEED_FAMILIES = [
  'Crimson Pro',
  'Source Sans 3',
  'Space Grotesk',
  'Inter',
  'Playfair Display',
];

const LABEL_CASES: LabelCase[] = ['none', 'uppercase', 'lowercase', 'capitalize'];

/** Every text style needs seven fields. This is the placeholder used when a
 *  role is added or a legacy theme has an incomplete entry — the Studio never
 *  edits it in place, it just fills the gaps so the controls have something
 *  to render. */
const FALLBACK_STYLE: TextStyle = {
  family: '',
  fallback: 'sans-serif',
  weight: 400,
  style: 'normal',
  size: 14,
  letterSpacing: 0,
  case: 'none',
};

function TextStyleEditor({
  title,
  hint,
  style,
  families,
  disabled,
  onChange,
  onRename,
  onRemove,
}: {
  title: string;
  hint?: string;
  style: TextStyle;
  families: string[];
  disabled: boolean;
  onChange: (next: TextStyle) => void;
  onRename?: (nextName: string) => void;
  onRemove?: () => void;
}) {
  return (
    <div className={styles.TokenGroup}>
      <div className={styles.Row}>
        {onRename ? (
          <TextInput
            size="xs"
            w={130}
            defaultValue={title}
            onBlur={(e) => onRename(e.target.value)}
            aria-label={`${title} name`}
          />
        ) : (
          <span className={styles.RoleName}>{title}</span>
        )}
        {hint && <span className={styles.Meta}>{hint}</span>}
        {onRemove && (
          <ActionIcon
            size="sm"
            variant="subtle"
            color="gray"
            onClick={onRemove}
            aria-label={`Remove ${title}`}
            style={{ marginLeft: 'auto' }}
          >
            ×
          </ActionIcon>
        )}
      </div>
      <div className={styles.Row}>
        <Autocomplete
          size="xs"
          w={200}
          data={families}
          limit={12}
          value={style.family}
          disabled={disabled}
          onChange={(family) => onChange({ ...style, family })}
          onOptionSubmit={(family) => void ensureFontLoaded(family)}
          onBlur={() => void ensureFontLoaded(style.family)}
          aria-label={`${title} family`}
          placeholder="Search Google Fonts…"
        />
        <Select
          size="xs"
          w={110}
          data={['serif', 'sans-serif']}
          value={style.fallback}
          disabled={disabled}
          allowDeselect={false}
          onChange={(fallback) =>
            fallback &&
            onChange({ ...style, fallback: fallback as TextStyle['fallback'] })
          }
          aria-label={`${title} fallback`}
        />
        <NumberInput
          size="xs"
          w={90}
          min={100}
          max={900}
          step={100}
          value={style.weight}
          disabled={disabled}
          onChange={(value) =>
            onChange({ ...style, weight: typeof value === 'number' ? value : 400 })
          }
          aria-label={`${title} weight`}
        />
        <Checkbox
          size="xs"
          label="italic"
          checked={style.style === 'italic'}
          disabled={disabled}
          onChange={(e) =>
            onChange({
              ...style,
              style: e.currentTarget.checked ? 'italic' : 'normal',
            })
          }
        />
      </div>
      <div className={styles.Row}>
        <NumberInput
          size="xs"
          w={90}
          min={6}
          max={96}
          step={1}
          value={style.size}
          disabled={disabled}
          onChange={(value) =>
            onChange({ ...style, size: typeof value === 'number' ? value : 14 })
          }
          aria-label={`${title} size`}
          label="Size"
        />
        <NumberInput
          size="xs"
          w={110}
          step={0.1}
          value={style.letterSpacing}
          disabled={disabled}
          onChange={(value) =>
            onChange({
              ...style,
              letterSpacing: typeof value === 'number' ? value : 0,
            })
          }
          aria-label={`${title} letter-spacing`}
          label="Tracking"
        />
        <Select
          size="xs"
          w={130}
          data={LABEL_CASES}
          value={style.case}
          disabled={disabled}
          allowDeselect={false}
          onChange={(value) =>
            value && onChange({ ...style, case: value as LabelCase })
          }
          aria-label={`${title} case`}
          label="Case"
        />
      </div>
    </div>
  );
}

/** Design Tokens: colours and text styles on one page, two sections. */
export default function DesignTokensPage() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();
  const disabled = !isCustomTheme;
  const [newColor, setNewColor] = useState('');
  const [newText, setNewText] = useState('');
  const [families, setFamilies] = useState<string[]>(SEED_FAMILIES);

  useEffect(() => {
    let alive = true;
    fetchGoogleFonts().then(
      (list) => {
        if (alive) setFamilies(list.map((entry) => entry.family));
      },
      () => {
        /* offline: seed list stays */
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  const writeTokens = (tokens: ThemeTokens) =>
    updateCustomTheme(themeId, { tokens });

  /* ── Colours ─────────────────────────────────────────────────────── */

  const setColor = (name: string, value: string) => {
    if (!HEX.test(value)) return;
    writeTokens({
      ...theme.tokens,
      colors: { ...theme.tokens.colors, [name]: value.toLowerCase() },
    });
  };

  const removeColor = (name: string) => {
    const colors = { ...theme.tokens.colors };
    delete colors[name];
    writeTokens({ ...theme.tokens, colors });
  };

  const renameColor = (from: string, raw: string) => {
    const to = raw.trim();
    if (!to || to === from || theme.tokens.colors[to] !== undefined) return;
    const colors: Record<string, string> = {};
    for (const [k, v] of Object.entries(theme.tokens.colors))
      colors[k === from ? to : k] = v;
    writeTokens({ ...theme.tokens, colors });
  };

  const addColor = () => {
    const name = newColor.trim();
    if (!name || theme.tokens.colors[name] !== undefined) return;
    writeTokens({
      ...theme.tokens,
      colors: { ...theme.tokens.colors, [name]: '#888888' },
    });
    setNewColor('');
  };

  /* ── Text styles ─────────────────────────────────────────────────── */

  const setTextStyle = (name: string, style: TextStyle) =>
    writeTokens({
      ...theme.tokens,
      text: { ...theme.tokens.text, [name]: style },
    });

  const removeTextStyle = (name: string) => {
    const text = { ...theme.tokens.text };
    delete text[name];
    writeTokens({ ...theme.tokens, text });
  };

  const renameTextStyle = (from: string, raw: string) => {
    const to = raw.trim();
    if (!to || to === from || theme.tokens.text[to] !== undefined) return;
    const text: Record<string, TextStyle> = {};
    for (const [k, v] of Object.entries(theme.tokens.text))
      text[k === from ? to : k] = v;
    writeTokens({ ...theme.tokens, text });
  };

  const addTextStyle = () => {
    const name = newText.trim();
    if (!name || theme.tokens.text[name] !== undefined) return;
    writeTokens({
      ...theme.tokens,
      text: { ...theme.tokens.text, [name]: { ...FALLBACK_STYLE } },
    });
    setNewText('');
  };

  const readStyle = (name: string): TextStyle =>
    theme.tokens.text[name] ?? FALLBACK_STYLE;

  return (
    <div className={styles.Tool}>
      <h3 className={styles.SectionTitle}>Chrome</h3>
      <div className={styles.Row}>
        <span className={styles.Label}>Window chrome</span>
        <Select
          size="xs"
          w={110}
          data={['light', 'dark']}
          value={theme.mode}
          disabled={!isCustomTheme}
          allowDeselect={false}
          onChange={(value) =>
            value && updateCustomTheme(themeId, { mode: value as ThemeMode })
          }
          aria-label="Window chrome"
        />
      </div>

      <h3 className={styles.SectionTitle}>Colours</h3>
      <span className={styles.Meta}>
        Names are open — controls reference them as{' '}
        <code>--color-&lt;name&gt;</code>. The nine below are convention, not
        schema.
      </span>
      <div className={styles.PaletteGrid}>
        {Object.keys(theme.tokens.colors).map((name) => (
          <div key={name} className={styles.SwatchRow}>
            <ColorInput
              size="xs"
              w={130}
              format="hex"
              value={theme.tokens.colors[name] ?? ''}
              disabled={!isCustomTheme}
              onChange={(value) => setColor(name, value)}
              aria-label={`${name} color`}
            />
            <div className={styles.RoleText}>
              {isCustomTheme ? (
                <TextInput
                  size="xs"
                  w={120}
                  key={`name-${name}`}
                  defaultValue={name}
                  onBlur={(e) => renameColor(name, e.target.value)}
                  aria-label={`${name} name`}
                />
              ) : (
                <span className={styles.RoleName}>{name}</span>
              )}
              <span className={styles.Meta}>
                {COLOR_HINTS[name] ?? 'Custom colour'}
              </span>
            </div>
            {isCustomTheme && (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => removeColor(name)}
                aria-label={`Remove ${name}`}
              >
                ×
              </ActionIcon>
            )}
          </div>
        ))}
      </div>
      {isCustomTheme && (
        <div className={styles.Row}>
          <TextInput
            size="xs"
            w={160}
            placeholder="new colour name"
            value={newColor}
            onChange={(e) => setNewColor(e.target.value)}
            aria-label="New colour name"
          />
          <Button
            size="xs"
            variant="default"
            onClick={addColor}
            disabled={!newColor.trim()}
          >
            Add colour
          </Button>
        </div>
      )}

      <h3 className={styles.SectionTitle}>Text styles</h3>
      <span className={styles.Meta}>
        Each text style carries all seven fields — family, fallback, weight,
        style, size, letter-spacing, case. Controls reference the whole style
        as <code>--text-&lt;name&gt;</code>, or one field as{' '}
        <code>--text-&lt;name&gt;:&lt;field&gt;</code>.
      </span>
      {Object.keys(theme.tokens.text).map((name) => (
        <TextStyleEditor
          key={name}
          title={name}
          style={readStyle(name)}
          families={families}
          disabled={disabled}
          onChange={(next) => setTextStyle(name, next)}
          onRename={isCustomTheme ? (to) => renameTextStyle(name, to) : undefined}
          onRemove={isCustomTheme ? () => removeTextStyle(name) : undefined}
        />
      ))}
      {isCustomTheme && (
        <div className={styles.Row}>
          <TextInput
            size="xs"
            w={160}
            placeholder="new style name"
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            aria-label="New text style name"
          />
          <Button
            size="xs"
            variant="default"
            onClick={addTextStyle}
            disabled={!newText.trim()}
          >
            Add text style
          </Button>
        </div>
      )}

      <h3 className={styles.SectionTitle}>Live specimen</h3>
      <SpecimenIsland />
    </div>
  );
}
