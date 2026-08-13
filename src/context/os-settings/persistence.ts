import { THEMES, type Theme } from '@/theme';

export const STORAGE_KEY = 'galapa-ui.themes.v1';

/** Theme every bad or missing id falls back to. */
export const FALLBACK_THEME_ID = 'kyururu';

export const builtIn = (id: string): Theme | undefined =>
  THEMES[id as keyof typeof THEMES];

export type Persisted = {
  themeId?: string;
  customThemes?: Record<string, Theme>;
};

/** Loose validation: keep anything theme-shaped, drop the rest. */
export function loadPersisted(): Persisted {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const data = JSON.parse(raw) as Persisted;
    const customThemes: Record<string, Theme> = {};
    for (const [id, theme] of Object.entries(data.customThemes ?? {})) {
      if (theme && typeof theme === 'object' && theme.colors && theme.fonts) {
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
