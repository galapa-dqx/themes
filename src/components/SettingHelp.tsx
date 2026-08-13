import type { ReactNode } from 'react';
import Skin from './Skin';
import styles from './SettingHelp.module.css';

/** Right-hand explainer panel shown next to a settings list. */
export default function SettingHelp({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Skin part="panel" className={styles.SettingHelp} role="complementary">
      <h2 className={styles.Title}>{title}</h2>
      <div className={styles.Body}>{children}</div>
    </Skin>
  );
}
