import { ColorInput, Select } from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import type { ThemeColors, ThemeMode } from '@/theme';
import SpecimenIsland from './SpecimenIsland';
import styles from './Studio.module.css';

const ROLES: { key: keyof ThemeColors; label: string; hint: string }[] = [
  { key: 'bg', label: 'bg', hint: 'App background' },
  { key: 'surface', label: 'surface', hint: 'Cards, panels, inputs' },
  { key: 'surface-2', label: 'surface-2', hint: 'Chrome strips, tracks' },
  { key: 'border', label: 'border', hint: 'Outlines, faint text' },
  { key: 'text', label: 'text', hint: 'Primary text' },
  { key: 'muted', label: 'muted', hint: 'Secondary text, labels' },
  { key: 'accent', label: 'accent', hint: 'Selection, primary actions' },
  { key: 'success', label: 'success', hint: 'Positive category color' },
  { key: 'danger', label: 'danger', hint: 'Errors, close button' },
];

const HEX = /^#[0-9a-f]{6}$/i;

/** Palette editor. Built-in themes are read-only; custom themes edit live. */
export default function Palette() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();

  const setColor = (key: keyof ThemeColors, value: string) => {
    if (!HEX.test(value)) return;
    updateCustomTheme(themeId, {
      colors: { ...theme.colors, [key]: value.toLowerCase() },
    });
  };

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

      <h3 className={styles.SectionTitle}>Colors</h3>
      <div className={styles.PaletteGrid}>
        {ROLES.map((role) => (
          <div key={role.key} className={styles.SwatchRow}>
            <ColorInput
              size="xs"
              w={130}
              format="hex"
              value={theme.colors[role.key]}
              disabled={!isCustomTheme}
              onChange={(value) => setColor(role.key, value)}
              aria-label={`${role.label} color`}
            />
            <div className={styles.RoleText}>
              <span className={styles.RoleName}>{role.label}</span>
              <span className={styles.Meta}>{role.hint}</span>
            </div>
          </div>
        ))}
      </div>

      <h3 className={styles.SectionTitle}>Live specimen</h3>
      <SpecimenIsland />
    </div>
  );
}
