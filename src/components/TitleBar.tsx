import { useLocation } from '@tanstack/react-router';
import type { DOMAttributes } from 'react';
import TabBar, { type TabItem } from './TabBar';
import { IconDismiss, IconMaximize, IconMinimize } from './icons';
import { useOptionalWindowContext } from '@/context/window';
import styles from './TitleBar.module.css';

const TABS: TabItem[] = [
  { id: 'launcher', label: 'Launcher', to: '/' },
  { id: 'settings', label: 'Settings', to: '/settings/graphics' },
];

/** Keeps clicks on tabs/buttons from starting a window drag. */
const inert: Pick<DOMAttributes<HTMLDivElement>, 'onPointerDown' | 'onDoubleClick'> = {
  onPointerDown: (e) => e.stopPropagation(),
  onDoubleClick: (e) => e.stopPropagation(),
};

export default function TitleBar() {
  const win = useOptionalWindowContext();
  const { pathname } = useLocation();
  const activeId = pathname.startsWith('/settings') ? 'settings' : 'launcher';

  return (
    <header
      className={styles.TitleBar}
      onPointerDown={win?.startMove}
      onDoubleClick={win?.toggleMaximize}
    >
      <span className={styles.Wordmark}>Galapa</span>
      <div className={styles.Center} {...inert}>
        <TabBar items={TABS} activeId={activeId} hints="bumper" />
      </div>
      <div className={styles.Captions} {...inert}>
        <button type="button" className={styles.CaptionBtn} aria-label="Minimize">
          <IconMinimize />
        </button>
        <button
          type="button"
          className={styles.CaptionBtn}
          aria-label={win?.isMaximized ? 'Restore' : 'Maximize'}
          onClick={win?.toggleMaximize}
        >
          <IconMaximize />
        </button>
        <button
          type="button"
          className={`${styles.CaptionBtn} ${styles.Close}`}
          aria-label="Close"
          onClick={win?.close}
        >
          <IconDismiss />
        </button>
      </div>
    </header>
  );
}
