import { Outlet } from '@tanstack/react-router';
import TitleBar from './TitleBar';
import styles from './AppShell.module.css';

/** The Galapa app frame. Its background and text baseline are the `window`
 *  control (read directly, not through <Themed> — a native window frame is
 *  special); the window's border wraps the whole thing, drawn on the OS window
 *  frame in Window.css. */
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
