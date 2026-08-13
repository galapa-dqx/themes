import { createContext } from 'react';
import type { Theme } from '@/theme';

export type WinStyle = 'win11' | 'win10';
export type ScreenMode = 'desktop' | 'console';

export type OSSettings = {
  winStyle: WinStyle;
  mode: ScreenMode;
  /** User-created themes, editable in the Studio palette page. */
  customThemes: Record<string, Theme>;
};

export type OSSettingsContextValue = OSSettings & {
  /** Selected theme id — from the /themes/$themeId route (custom UUID or
   *  built-in key), falling back to the last known theme for bad URLs. */
  themeId: string;
  /** The selected theme object (custom first, then built-ins). */
  theme: Theme;
  /** True when the selected theme is user-created (and thus editable). */
  isCustomTheme: boolean;
  /** False when the URL names a theme id that doesn't exist. */
  isKnownTheme: boolean;
  setWinStyle: (winStyle: WinStyle) => void;
  setMode: (mode: ScreenMode) => void;
  /** Clone the current theme into a new editable custom theme and return its
   *  id. Selection is the URL's job — callers navigate to the new id. */
  createTheme: () => string;
  updateCustomTheme: (id: string, patch: Partial<Theme>) => void;
  /** Remove a custom theme. Callers navigate away if it was selected. */
  deleteTheme: (id: string) => void;
};

export const OSSettingsContext = createContext<OSSettingsContextValue | null>(
  null,
);
