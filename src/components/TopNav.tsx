import { useEffect, useRef } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { Button, SegmentedControl, Select } from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import { THEMES } from '@/theme';
import styles from './TopNav.module.css';

const BUILT_IN = Object.entries(THEMES);

type ThemeSide = 'editor' | 'preview';

/** Top-level app chrome. Unthemed on purpose: it must stay usable while the
 *  theme under development is broken. */
export default function TopNav() {
  const { themeId, customThemes, createTheme } = useOSSettings();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  const customEntries = Object.entries(customThemes);

  // Where we are inside the current theme, e.g. "editor/slicer" or
  // "preview/settings/graphics". Theme-agnostic so it survives id swaps.
  const subpath = pathname.startsWith('/themes/')
    ? pathname.replace(/^\/themes\/[^/]+\/?/, '') || 'editor'
    : 'editor';
  const side: ThemeSide = subpath.startsWith('preview') ? 'preview' : 'editor';

  // Remember where you were on each side so the toggle round-trips.
  const lastRef = useRef<Record<ThemeSide, string>>({
    editor: 'editor',
    preview: 'preview',
  });
  useEffect(() => {
    lastRef.current[side] = subpath;
  }, [side, subpath]);

  // Assembled dynamically, so resolved by the router at runtime, not the
  // type system — every target here matches a real route.
  const goto = (path: string) => void navigate({ to: path as '/' });

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
        onChange={(value) => value && goto(`/themes/${value}/${subpath}`)}
        allowDeselect={false}
        searchable
        aria-label="Theme"
      />
      <Button
        size="xs"
        variant="default"
        onClick={() => {
          const id = createTheme();
          goto(`/themes/${id}/${side === 'editor' ? subpath : 'editor'}`);
        }}
      >
        + New theme
      </Button>
      <SegmentedControl
        size="xs"
        ml="auto"
        value={side}
        onChange={(value) =>
          goto(`/themes/${themeId}/${lastRef.current[value as ThemeSide]}`)
        }
        data={[
          { value: 'editor', label: 'Editor' },
          { value: 'preview', label: 'Preview' },
        ]}
      />
    </nav>
  );
}
