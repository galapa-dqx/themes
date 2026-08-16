import { useState } from 'react';
import { ActionIcon, Button, ColorInput, Select, TextInput } from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import type { ThemeMode, ThemePalette } from '@/theme';
import SpecimenIsland from './SpecimenIsland';
import styles from './Studio.module.css';

/** The nine convention roles, as documentation — the palette itself is open,
 *  so a fork adds, renames or removes freely. */
const HINTS: Record<string, string> = {
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

/** Palette editor. Built-in themes are read-only; custom themes edit live. */
export default function Palette() {
  const { theme, themeId, isCustomTheme, updateCustomTheme } = useOSSettings();
  const [newRole, setNewRole] = useState('');

  const writePalette = (palette: ThemePalette) =>
    updateCustomTheme(themeId, { palette });

  const setColor = (role: string, value: string) => {
    if (!HEX.test(value)) return;
    writePalette({ ...theme.palette, [role]: value.toLowerCase() });
  };

  const removeRole = (role: string) => {
    const next = { ...theme.palette };
    delete next[role];
    writePalette(next);
  };

  const renameRole = (from: string, raw: string) => {
    const to = raw.trim();
    if (!to || to === from || theme.palette[to] !== undefined) return;
    // Preserve order: rebuild with the key swapped in place.
    const next: ThemePalette = {};
    for (const [k, v] of Object.entries(theme.palette)) next[k === from ? to : k] = v;
    writePalette(next);
  };

  const addRole = () => {
    const name = newRole.trim();
    if (!name || theme.palette[name] !== undefined) return;
    writePalette({ ...theme.palette, [name]: '#888888' });
    setNewRole('');
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

      <h3 className={styles.SectionTitle}>Palette</h3>
      <span className={styles.Meta}>
        Roles are open — controls reference them as{' '}
        <code>--theme-&lt;role&gt;</code>. The nine below are convention, not
        schema.
      </span>
      <div className={styles.PaletteGrid}>
        {Object.keys(theme.palette).map((role) => (
          <div key={role} className={styles.SwatchRow}>
            <ColorInput
              size="xs"
              w={130}
              format="hex"
              value={theme.palette[role] ?? ''}
              disabled={!isCustomTheme}
              onChange={(value) => setColor(role, value)}
              aria-label={`${role} color`}
            />
            <div className={styles.RoleText}>
              {isCustomTheme ? (
                <TextInput
                  size="xs"
                  w={120}
                  key={`name-${role}`}
                  defaultValue={role}
                  onBlur={(e) => renameRole(role, e.target.value)}
                  aria-label={`${role} name`}
                />
              ) : (
                <span className={styles.RoleName}>{role}</span>
              )}
              <span className={styles.Meta}>{HINTS[role] ?? 'Custom role'}</span>
            </div>
            {isCustomTheme && (
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                onClick={() => removeRole(role)}
                aria-label={`Remove ${role}`}
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
            placeholder="new role name"
            value={newRole}
            onChange={(e) => setNewRole(e.target.value)}
            aria-label="New role name"
          />
          <Button
            size="xs"
            variant="default"
            onClick={addRole}
            disabled={!newRole.trim()}
          >
            Add role
          </Button>
        </div>
      )}

      <h3 className={styles.SectionTitle}>Live specimen</h3>
      <SpecimenIsland />
    </div>
  );
}
