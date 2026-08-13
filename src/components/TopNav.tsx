import { Button, SegmentedControl, Select } from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import type { AppView } from '@/context/os-settings/OSSettingsContext';
import { THEMES } from '@/theme';
import styles from './TopNav.module.css';

const BUILT_IN = Object.entries(THEMES);

/** Top-level app chrome. Unthemed on purpose: it must stay usable while the
 *  theme under development is broken. */
export default function TopNav() {
  const { view, setView, themeId, setThemeId, customThemes, createTheme } =
    useOSSettings();
  const customEntries = Object.entries(customThemes);

  const themeData = [
    ...(customEntries.length
      ? [
          {
            group: 'Custom',
            items: customEntries.map(([id, theme]) => ({
              value: id,
              label: theme.label,
            })),
          },
        ]
      : []),
    {
      group: 'Dark',
      items: BUILT_IN.filter(([, t]) => t.mode === 'dark').map(([id, t]) => ({
        value: id,
        label: t.label,
      })),
    },
    {
      group: 'Light',
      items: BUILT_IN.filter(([, t]) => t.mode === 'light').map(([id, t]) => ({
        value: id,
        label: t.label,
      })),
    },
  ];

  return (
    <nav className={styles.TopNav} aria-label="Workspace">
      <span className={styles.Brand}>galapa-ui</span>
      <Select
        size="xs"
        w={180}
        data={themeData}
        value={themeId}
        onChange={(value) => value && setThemeId(value)}
        allowDeselect={false}
        searchable
        aria-label="Theme"
      />
      <Button size="xs" variant="default" onClick={createTheme}>
        + New theme
      </Button>
      <SegmentedControl
        size="xs"
        ml="auto"
        value={view}
        onChange={(value) => setView(value as AppView)}
        data={[
          { value: 'studio', label: 'Studio' },
          { value: 'preview', label: 'Preview' },
        ]}
      />
    </nav>
  );
}
