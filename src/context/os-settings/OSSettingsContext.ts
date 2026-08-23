import { createContext } from 'react';
import type { AuthoringTheme, CompiledTheme } from '@/theme';

export type WinStyle = 'win11' | 'win10';
export type ScreenMode = 'desktop' | 'console';

export type OSSettings = {
  winStyle: WinStyle;
  mode: ScreenMode;
  /** User-created themes, editable in the Studio. Stored in authoring form —
   *  the same shape as a built-in. */
  customThemes: Record<string, AuthoringTheme>;
};

export type OSSettingsContextValue = OSSettings & {
  /** Selected theme id — from the /themes/$themeId route (custom UUID or
   *  built-in key), falling back to the last known theme for bad URLs. */
  themeId: string;
  /** The selected theme in authoring form — what the Studio edits and what
   *  the font loader reads its roles from. */
  theme: AuthoringTheme;
  /** The selected theme resolved to literals — what every themed surface
   *  renders from. `null` only until the first resolve completes; on a theme
   *  switch the previous compiled theme is held until the next is ready, so
   *  there is no flash of unstyled chrome. */
  compiled: CompiledTheme | null;
  /** Non-fatal issues from the last resolve (undefined tokens, failed art). */
  themeWarnings: string[];
  /** Compilation errors from the last resolve — the ones that would make the
   *  theme unshippable, chiefly text-bearing controls with incomplete
   *  typography. The compiled theme still previews (whatever was resolvable
   *  is painted), but export refuses these. */
  themeErrors: string[];
  /** True when the selected theme is user-created (and thus editable). */
  isCustomTheme: boolean;
  /** False when the URL names a theme id that doesn't exist. */
  isKnownTheme: boolean;
  setWinStyle: (winStyle: WinStyle) => void;
  setMode: (mode: ScreenMode) => void;
  /** Clone the current theme into a new editable custom theme and return its
   *  id. Selection is the URL's job — callers navigate to the new id. */
  createTheme: () => string;
  updateCustomTheme: (id: string, patch: Partial<AuthoringTheme>) => void;
  /** Remove a custom theme. Callers navigate away if it was selected. */
  deleteTheme: (id: string) => void;
};

export const OSSettingsContext = createContext<OSSettingsContextValue | null>(
  null,
);
