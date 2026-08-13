import { Outlet } from '@tanstack/react-router';
import TitleBar from './TitleBar';
import styles from './AppShell.module.css';

/** The Galapa app frame: custom title bar + themed, noise-textured body. */
export default function AppShell() {
  return (
    <div className={`app-shell ${styles.AppShell}`}>
      <TitleBar />
      <main className={styles.Body}>
        <Outlet />
      </main>
    </div>
  );
}
