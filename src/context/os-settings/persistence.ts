import { THEMES, type AuthoringTheme } from '@/theme';

// v4: the authoring vocabulary collapsed into a single `tokens` surface with
// two namespaces (colours and text styles); `palette` and `fonts` are gone,
// and colour tokens changed grammar from `--theme-` to `--color-`. v3 payloads
// can't be read as designs any more.
export const STORAGE_KEY = 'galapa-ui.themes.v4';

/** Theme every bad or missing id falls back to. */
export const FALLBACK_THEME_ID = 'kyururu';

export const builtIn = (id: string): AuthoringTheme | undefined =>
  THEMES[id as keyof typeof THEMES];

export type Persisted = {
  themeId?: string;
  customThemes?: Record<string, AuthoringTheme>;
};

/** Loose validation: keep anything theme-shaped, drop the rest. A built-in and
 *  a stored custom theme are one kind of object, so this is the same shape
 *  check the built-in loader trusts. */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Persisted;
    const customThemes: Record<string, AuthoringTheme> = {};
    for (const [id, theme] of Object.entries(data.customThemes ?? {})) {
      if (
        theme &&
        typeof theme === 'object' &&
        theme.tokens &&
        theme.tokens.colors &&
        theme.tokens.text &&
        theme.controls
      ) {
        customThemes[id] = theme;
      }
    }
    return {
      themeId: typeof data.themeId === 'string' ? data.themeId : undefined,
      customThemes,
    };
  } catch (err) {
    console.warn('[theme] failed to load persisted themes', err);
    return {};
  }
}

/** Last-used theme id, validated against storage. Drives the "/" redirect. */
export function resolveInitialThemeId(): string {
  const { themeId, customThemes } = loadPersisted();
  return themeId && (customThemes?.[themeId] ?? builtIn(themeId))
    ? themeId
    : FALLBACK_THEME_ID;
}
