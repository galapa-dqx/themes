import { Button } from '@mantine/core';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { useOSSettings } from '@/context/os-settings';
import styles from './Studio.module.css';

/** Full-width notice under the studio header when the selected theme is
 *  built-in (read-only). Rendered once by StudioWorkspace. */
export default function ReadOnlyBanner() {
  const { theme, isCustomTheme, createTheme } = useOSSettings();
  const navigate = useNavigate();
  const pathname = useLocation({ select: (l) => l.pathname });
  if (isCustomTheme) return null;

  const copy = () => {
    const id = createTheme();
    // Same tool, new theme id; assembled path resolved at runtime.
    const to = pathname.replace(/^\/themes\/[^/]+/, `/themes/${id}`);
    void navigate({ to: to as '/' });
  };
  return (
    <div className={styles.Banner}>
      <span>
        "{theme.label}" is a built-in theme and read-only — copy it to make
        changes.
      </span>
      <Button size="xs" radius="xl" color="yellow" variant="light" onClick={copy}>
        Create editable copy
      </Button>
    </div>
  );
}
