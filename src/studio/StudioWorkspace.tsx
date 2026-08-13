import { Outlet, useLocation, useNavigate } from '@tanstack/react-router';
import { SegmentedControl } from '@mantine/core';
import ReadOnlyBanner from './ReadOnlyBanner';
import { useOSSettings } from '@/context/os-settings';
import styles from './Studio.module.css';

const TABS = [
  { id: 'info', label: 'Info' },
  { id: 'palette', label: 'Palette' },
  { id: 'fonts', label: 'Fonts' },
  { id: 'controls', label: 'Controls' },
  { id: 'gallery', label: 'Gallery' },
  { id: 'slicer', label: 'Slicer' },
  { id: 'validator', label: 'Validator' },
] as const;

type StudioTab = (typeof TABS)[number]['id'];

/** Spelled out so the router keeps literal path types. */
const TOOL_LINKS = {
  info: '/themes/$themeId/editor/info',
  palette: '/themes/$themeId/editor/palette',
  fonts: '/themes/$themeId/editor/fonts',
  controls: '/themes/$themeId/editor/controls',
  gallery: '/themes/$themeId/editor/gallery',
  slicer: '/themes/$themeId/editor/slicer',
  validator: '/themes/$themeId/editor/validator',
} as const;

/** Tabs that edit the theme and need the read-only notice. */
const EDITOR_TABS: StudioTab[] = ['info', 'palette', 'fonts', 'controls'];

/**
 * Layout for /themes/$themeId/editor: each tool is a child route. Lives
 * OUTSIDE the themed subtree and uses only hardcoded neutral styling: the
 * theme being edited may be broken, and the tools must survive that. Only
 * the Gallery renders themed content, inside an explicitly scoped sandbox.
 */
export default function StudioWorkspace() {
  const navigate = useNavigate();
  const { themeId } = useOSSettings();
  const pathname = useLocation({ select: (l) => l.pathname });
  const tab = (pathname.split('/').filter(Boolean).pop() ?? 'palette') as StudioTab;

  return (
    <div className={styles.Workspace}>
      <header className={styles.Head}>
        <SegmentedControl
          size="xs"
          value={tab}
          onChange={(value) =>
            void navigate({
              to: TOOL_LINKS[value as StudioTab],
              params: { themeId },
            })
          }
          data={TABS.map((t) => ({ value: t.id, label: t.label }))}
          aria-label="Studio tools"
        />
      </header>
      {EDITOR_TABS.includes(tab) && <ReadOnlyBanner />}
      {/* Tools unmount on tab switch; the ones with real work-in-progress
          (slicer, validator) stash it in module caches to survive that. */}
      <div className={styles.Scroll}>
        <Outlet />
      </div>
    </div>
  );
}
