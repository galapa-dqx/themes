import { useId } from 'react';
import styles from './TextInput.module.css';

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
    <fieldset className={styles.TextInput}>
      <legend className={styles.Label}>
        <label htmlFor={id}>{label}</label>
      </legend>
      <input
        id={id}
        type={type}
        className={styles.Input}
        value={value}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
      />
    </fieldset>
  );
}
