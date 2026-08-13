import { useEffect, useState, type ReactNode } from 'react';
import { useParams } from '@tanstack/react-router';
import { OSSettingsContext, type OSSettings } from './OSSettingsContext';
import {
  STORAGE_KEY,
  FALLBACK_THEME_ID,
  builtIn,
  loadPersisted,
  resolveInitialThemeId,
} from './persistence';
import { THEMES, type Theme } from '@/theme';
import { ensureFontLoaded } from '@/studio/googleFonts';

export function OSSettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<OSSettings>(() => ({
    winStyle: 'win11',
    mode: 'desktop',
    customThemes: loadPersisted().customThemes ?? {},
  }));

  // Theme selection lives in the URL (/themes/$themeId/…). The provider sits
  // above those routes, so read the param loosely; it's absent only on
  // never-rendered redirect routes and the 404 page.
  const { themeId: routeThemeId } = useParams({ strict: false });
  const lookup = (id: string) => settings.customThemes[id] ?? builtIn(id);
  const isKnownTheme = routeThemeId == null || lookup(routeThemeId) != null;

  // Last id that resolved, so a bad URL (stale bookmark, deleted theme)
  // degrades to something real instead of poisoning persistence. Adjusted
  // during render (React's derived-state pattern) rather than in an effect.
  const [lastKnown, setLastKnown] = useState(resolveInitialThemeId);
  if (routeThemeId != null && isKnownTheme && routeThemeId !== lastKnown) {
    setLastKnown(routeThemeId);
  }
  const themeId =
    routeThemeId != null && isKnownTheme
      ? routeThemeId
      : lookup(lastKnown)
        ? lastKnown
        : FALLBACK_THEME_ID;
  const theme = lookup(themeId) ?? THEMES[FALLBACK_THEME_ID];

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ themeId, customThemes: settings.customThemes }),
      );
    } catch (err) {
      console.warn('[theme] failed to persist themes (storage quota?)', err);
    }
  }, [themeId, settings.customThemes]);

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
    themeId,
    theme,
    isCustomTheme: themeId in settings.customThemes,
    isKnownTheme,
    setWinStyle: (winStyle: OSSettings['winStyle']) =>
      setSettings((s) => ({ ...s, winStyle })),
    setMode: (mode: OSSettings['mode']) => setSettings((s) => ({ ...s, mode })),
    createTheme: () => {
      const id = crypto.randomUUID();
      setSettings((s) => {
        const base =
          s.customThemes[themeId] ?? builtIn(themeId) ?? THEMES[FALLBACK_THEME_ID];
        const clone = structuredClone(base);
        clone.label = `${base.label} Copy`;
        return { ...s, customThemes: { ...s.customThemes, [id]: clone } };
      });
      return id;
    },
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
        return { ...s, customThemes };
      }),
  };

  return (
    <OSSettingsContext.Provider value={value}>
      {children}
    </OSSettingsContext.Provider>
  );
}
