import { useEffect, useState, type ReactNode } from 'react';
import { OSSettingsContext, type OSSettings } from './OSSettingsContext';
import { THEMES, type Theme } from '@/theme';
import { ensureFontLoaded } from '@/studio/googleFonts';

const STORAGE_KEY = 'galapa-ui.themes.v1';

const builtIn = (id: string): Theme | undefined =>
  THEMES[id as keyof typeof THEMES];

type Persisted = {
  themeId?: string;
  customThemes?: Record<string, Theme>;
};

/** Loose validation: keep anything theme-shaped, drop the rest. */
function loadPersisted(): Persisted {
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

export function OSSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OSSettings>(() => {
    const persisted = loadPersisted();
    const customThemes = persisted.customThemes ?? {};
    const themeId =
      persisted.themeId &&
      (customThemes[persisted.themeId] || builtIn(persisted.themeId))
        ? persisted.themeId
        : 'kyururu';
    return {
      themeId,
      winStyle: 'win11',
      mode: 'desktop',
      view: 'studio',
      customThemes,
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          themeId: settings.themeId,
          customThemes: settings.customThemes,
        }),
      );
    } catch (err) {
      console.warn('[theme] failed to persist themes (storage quota?)', err);
    }
  }, [settings.themeId, settings.customThemes]);

  const theme =
    settings.customThemes[settings.themeId] ??
    builtIn(settings.themeId) ??
    THEMES.kyururu;

  // Persisted custom themes may reference Google Fonts that aren't bundled;
  // load whatever the active theme needs.
  useEffect(() => {
    const { heading, body, strong } = theme.fonts;
    void ensureFontLoaded(heading.family);
    void ensureFontLoaded(body.family);
    if (strong) void ensureFontLoaded(strong.family);
  }, [theme]);

  const value = {
    ...settings,
    theme,
    isCustomTheme: settings.themeId in settings.customThemes,
    setThemeId: (themeId: string) => setSettings((s) => ({ ...s, themeId })),
    setWinStyle: (winStyle: OSSettings['winStyle']) =>
      setSettings((s) => ({ ...s, winStyle })),
    setMode: (mode: OSSettings['mode']) => setSettings((s) => ({ ...s, mode })),
    setView: (view: OSSettings['view']) => setSettings((s) => ({ ...s, view })),
    createTheme: () =>
      setSettings((s) => {
        const base =
          s.customThemes[s.themeId] ?? builtIn(s.themeId) ?? THEMES.kyururu;
        const id = `custom-${Date.now().toString(36)}`;
        const clone = structuredClone(base);
        clone.label = `${base.label} Copy`;
        return {
          ...s,
          themeId: id,
          view: 'studio',
          customThemes: { ...s.customThemes, [id]: clone },
        };
      }),
    updateCustomTheme: (id: string, patch: Partial<Theme>) =>
      setSettings((s) => {
        const existing = s.customThemes[id];
        if (!existing) return s;
        return {
          ...s,
          customThemes: { ...s.customThemes, [id]: { ...existing, ...patch } },
        };
      }),
    deleteTheme: (id: string) =>
      setSettings((s) => {
        if (!(id in s.customThemes)) return s;
        const customThemes = { ...s.customThemes };
        delete customThemes[id];
        return {
          ...s,
          customThemes,
          themeId: s.themeId === id ? 'kyururu' : s.themeId,
        };
      }),
  };

  return (
    <OSSettingsContext.Provider value={value}>
      {children}
    </OSSettingsContext.Provider>
  );
}
