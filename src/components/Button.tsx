import type { ReactNode } from 'react';
import Themed from './Themed';
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
    <Themed
      as="button"
      part="button"
      state={disabled ? 'disabled' : undefined}
      type={type}
      className={styles.Button}
      disabled={disabled}
      onClick={onClick}
    >
      {children}
    </Themed>
  );
}
