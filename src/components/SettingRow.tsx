import type { ReactNode } from 'react';
import styles from './SettingRow.module.css';

export default function SettingRow({
  label,
  active = false,
  onActivate,
  children,
}: {
  label: string;
  /** Highlighted row (drives the help panel on settings pages). */
  active?: boolean;
  onActivate?: () => void;
  /** Value text or an inline control (e.g. a Switch). */
  children: ReactNode;
}) {
  return (
    <div
      className={`panel ${styles.SettingRow}`}
      data-active={active || undefined}
      tabIndex={onActivate ? 0 : undefined}
      onClick={onActivate}
      onFocus={onActivate}
    >
      <span className={styles.Label}>{label}</span>
      <span className={styles.Value}>{children}</span>
    </div>
  );
}
