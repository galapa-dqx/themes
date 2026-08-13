import Window from './Window.tsx'
import AppShell from './AppShell.tsx'
import DesktopSettings from './DesktopSettings.tsx'
import { useOSSettings } from '@/context/os-settings'
import { themeStyle } from '@/theme'

/** The themed desktop preview at /themes/$themeId/preview. The in-app pages
 *  (launcher, settings) render into AppShell's outlet as child routes. */
export default function DesktopPreview() {
  const { theme, themeId, winStyle, mode } = useOSSettings()

  return (
    <div
      className="win-desktop theme-scope"
      data-theme={theme.mode}
      data-app-theme={themeId}
      data-win-style={winStyle}
      data-mode={mode}
      style={themeStyle(theme)}
    >
      {mode === 'desktop' ? (
        <Window title="Galapa" chrome="app">
          <AppShell />
        </Window>
      ) : (
        <div className="console-screen">
          <AppShell />
        </div>
      )}
      <DesktopSettings />
    </div>
  )
}
