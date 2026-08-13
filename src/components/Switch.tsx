import styles from './Switch.module.css';

export default function Switch({
  checked,
  onChange,
  'aria-label': ariaLabel,
  disabled = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  'aria-label'?: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={styles.Switch}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <span className={styles.Knob} />
    </button>
  );
}
