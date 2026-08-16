import { useLocation } from '@tanstack/react-router';
import type { DOMAttributes } from 'react';
import TabBar, { type TabItem } from './TabBar';
import Themed from './Themed';
import { IconDismiss, IconMaximize, IconMinimize } from './icons';
import { useOptionalWindowContext } from '@/context/window';
import styles from './TitleBar.module.css';

/** $themeId is inherited from the current location's params. */
const TABS: TabItem[] = [
  { id: 'launcher', label: 'Launcher', to: '/themes/$themeId/preview' },
  {
    id: 'settings',
    label: 'Settings',
    to: '/themes/$themeId/preview/settings/graphics',
  },
];

/** Keeps clicks on tabs/buttons from starting a window drag. */
const inert: Pick<DOMAttributes<HTMLDivElement>, 'onPointerDown' | 'onDoubleClick'> = {
  onPointerDown: (e) => e.stopPropagation(),
  onDoubleClick: (e) => e.stopPropagation(),
};

export default function TitleBar() {
  const win = useOptionalWindowContext();
  const { pathname } = useLocation();
  const activeId = pathname.includes('/settings') ? 'settings' : 'launcher';

  return (
    <Themed
      as="header"
      part="titlebar"
      className={styles.TitleBar}
      onPointerDown={win?.startMove}
      onDoubleClick={win?.toggleMaximize}
    >
      <span className={styles.Wordmark}>Galapa</span>
      <div className={styles.Center} {...inert}>
        <TabBar items={TABS} activeId={activeId} hints="bumper" />
      </div>
      <div className={styles.Captions} {...inert}>
        <Themed
          as="button"
          part="titlebar.caption"
          type="button"
          className={styles.CaptionBtn}
          aria-label="Minimize"
        >
          <IconMinimize />
        </Themed>
        <Themed
          as="button"
          part="titlebar.caption"
          type="button"
          className={styles.CaptionBtn}
          aria-label={win?.isMaximized ? 'Restore' : 'Maximize'}
          onClick={win?.toggleMaximize}
        >
          <IconMaximize />
        </Themed>
        <Themed
          as="button"
          part="titlebar.close"
          type="button"
          className={styles.CaptionBtn}
          aria-label="Close"
          onClick={win?.close}
        >
          <IconDismiss />
        </Themed>
      </div>
    </Themed>
  );
}
