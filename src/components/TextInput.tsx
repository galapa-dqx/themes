import { useId } from 'react';
import Themed from './Themed';
import styles from './TextInput.module.css';

/**
 * The label sits in a gap in the input's top stroke. A <fieldset>/<legend>
 * cut that gap for us, but a legend only cuts a real CSS border — parts draw
 * their stroke on <Themed>'s frame layer, or as slice art, and a legend knows
 * about neither. Handing it over as `label` seats it in the frame's top edge
 * instead, where flex opens the gap on its own.
 */
export default function TextInput({
  label,
  value,
  onChange = () => {},
  placeholder,
  type = 'text',
  disabled = false,
}: {
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  type?: 'text' | 'password' | 'email' | 'search';
  disabled?: boolean;
}) {
  const id = useId();

  return (
    <Themed
      part="input"
      state={disabled ? 'disabled' : undefined}
      className={styles.TextInput}
      label={
        <label htmlFor={id} className={styles.Label}>
          {label}
        </label>
      }
    >
      <input
        id={id}
        type={type}
        className={styles.Input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </Themed>
  );
}
