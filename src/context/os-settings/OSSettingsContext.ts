import { createContext } from 'react';
import type { Theme } from '@/theme';

export type WinStyle = 'win11' | 'win10';
export type ScreenMode = 'desktop' | 'console';
/** Top-level app view: the unthemed Studio, or the themed desktop preview. */
export type AppView = 'studio' | 'preview';

export type OSSettings = {
  /** Selected theme id — a built-in key or a custom theme id. */
  themeId: string;
  winStyle: WinStyle;
  mode: ScreenMode;
  view: AppView;
  /** User-created themes, editable in the Studio palette page. */
  customThemes: Record<string, Theme>;
};

export type OSSettingsContextValue = OSSettings & {
  /** The selected theme object (custom first, then built-ins). */
  theme: Theme;
  /** True when the selected theme is user-created (and thus editable). */
  isCustomTheme: boolean;
  setThemeId: (themeId: string) => void;
  setWinStyle: (winStyle: WinStyle) => void;
  setMode: (mode: ScreenMode) => void;
  setView: (view: AppView) => void;
  /** Clone the current theme into a new editable custom theme and select it. */
  createTheme: () => void;
  updateCustomTheme: (id: string, patch: Partial<Theme>) => void;
  /** Remove a custom theme; falls back to kyururu if it was selected. */
  deleteTheme: (id: string) => void;
};

export const OSSettingsContext = createContext<OSSettingsContextValue | null>(
  null,
);
