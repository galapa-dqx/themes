import type { ReactNode } from 'react';
import styles from './Button.module.css';

export default function Button({
  children,
  onClick,
  type = 'button',
  disabled = false,
}: {
  children: ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit';
  disabled?: boolean;
}) {
  return (
    <button
      type={type}
      className={styles.Button}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
