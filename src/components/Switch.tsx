import Themed from './Themed';
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
    <Themed
      as="button"
      part="switch.track"
      state={disabled ? 'disabled' : undefined}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={styles.Switch}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <Themed
        as="span"
        part="switch.thumb"
        state={checked ? 'checked' : undefined}
        className={styles.Knob}
      />
    </Themed>
  );
}
