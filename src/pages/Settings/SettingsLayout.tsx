import { Outlet, useLocation } from '@tanstack/react-router';
import TabBar, { type TabItem } from '@/components/TabBar';
import styles from './SettingsLayout.module.css';

const SECTIONS: TabItem[] = [
  { id: 'game', label: 'Game', to: '/settings/game' },
  { id: 'players', label: 'Players', to: '/settings/players' },
  { id: 'graphics', label: 'Graphics', to: '/settings/graphics' },
  { id: 'controls', label: 'Controls', to: '/settings/controls' },
  { id: 'sound', label: 'Sound', to: '/settings/sound' },
  { id: 'clarity', label: 'Clarity', to: '/settings/clarity' },
  { id: 'about', label: 'About', to: '/settings/about' },
];

export default function SettingsLayout() {
  const { pathname } = useLocation();
  const activeId =
    SECTIONS.find((section) => pathname.startsWith(String(section.to)))?.id ??
    'graphics';

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
