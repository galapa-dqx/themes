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
import { THEMES, resolveTheme, type AuthoringTheme, type CompiledTheme } from '@/theme';
import { ensureFontLoaded } from '@/theme/googleFonts';

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
  // load whatever font roles the active theme names.
  useEffect(() => {
    for (const role of Object.values(theme.fonts)) {
      void ensureFontLoaded(role.family);
    }
  }, [theme]);

  // Resolution is async (inlining art means fetching it), so the compiled
  // theme lags the authoring one by a microtask-or-fetch. Keep the last good
  // result while a new one resolves — on a theme switch that means the old
  // theme stays painted until the new one is ready, so there's no flash of
  // unstyled chrome. The Studio drives this on every keystroke.
  const [resolved, setResolved] = useState<{
    compiled: CompiledTheme;
    warnings: string[];
    errors: string[];
  } | null>(null);
  useEffect(() => {
    let alive = true;
    void resolveTheme(theme).then((result) => {
      if (alive) setResolved(result);
    });
    return () => {
      alive = false;
    };
  }, [theme]);

  const value = {
    ...settings,
    themeId,
    theme,
    compiled: resolved?.compiled ?? null,
    themeWarnings: resolved?.warnings ?? [],
    themeErrors: resolved?.errors ?? [],
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
    updateCustomTheme: (id: string, patch: Partial<AuthoringTheme>) =>
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
