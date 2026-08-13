import { Button } from '@mantine/core';
import { useOSSettings } from '@/context/os-settings';
import styles from './Studio.module.css';

/** Full-width notice under the studio header when the selected theme is
 *  built-in (read-only). Rendered once by StudioWorkspace. */
export default function ReadOnlyBanner() {
  const { theme, isCustomTheme, createTheme } = useOSSettings();
  if (isCustomTheme) return null;
  return (
    <div className={styles.Banner}>
      <span>
        "{theme.label}" is a built-in theme and read-only — copy it to make
        changes.
      </span>
      <Button size="xs" radius="xl" color="yellow" variant="light" onClick={createTheme}>
        Create editable copy
      </Button>
    </div>
  );
}
