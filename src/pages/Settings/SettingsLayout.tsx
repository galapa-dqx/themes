import { Outlet, useLocation } from '@tanstack/react-router';
import TabBar, { type TabItem } from '@/components/TabBar';
import styles from './SettingsLayout.module.css';

/** $themeId is inherited from the current location's params. */
const SECTIONS: TabItem[] = [
  { id: 'game', label: 'Game', to: '/themes/$themeId/preview/settings/game' },
  { id: 'players', label: 'Players', to: '/themes/$themeId/preview/settings/players' },
  { id: 'graphics', label: 'Graphics', to: '/themes/$themeId/preview/settings/graphics' },
  { id: 'controls', label: 'Controls', to: '/themes/$themeId/preview/settings/controls' },
  { id: 'sound', label: 'Sound', to: '/themes/$themeId/preview/settings/sound' },
  { id: 'clarity', label: 'Clarity', to: '/themes/$themeId/preview/settings/clarity' },
  { id: 'about', label: 'About', to: '/themes/$themeId/preview/settings/about' },
];

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const section = pathname.split('/').filter(Boolean).pop();
  const activeId = SECTIONS.find((s) => s.id === section)?.id ?? 'graphics';

  return (
    <div className={styles.Settings}>
      <header className={styles.SubTabs}>
        <TabBar items={SECTIONS} activeId={activeId} size="sm" hints="trigger" />
      </header>
      <div className={styles.Body}>
        <Outlet />
      </div>
    </div>
  );
}
