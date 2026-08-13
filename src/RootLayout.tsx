import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Window from './components/Window.tsx'
import AppShell from './components/AppShell.tsx'
import DesktopSettings from './components/DesktopSettings.tsx'
import TopNav from './components/TopNav.tsx'
import StudioWorkspace from './studio/StudioWorkspace.tsx'
import { OSSettingsProvider, useOSSettings } from './context/os-settings'
import { themeStyle } from './theme'

function Desktop() {
  const { theme, themeId, winStyle, mode, view } = useOSSettings()

  return (
    <>
      <div className="app-frame">
        <TopNav />
        <div className="app-view">
          {/* Both views stay mounted so switching loses no state
              (window position, studio work-in-progress). */}
          <div className="view-slot" hidden={view !== 'preview'}>
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
          </div>
          <div className="view-slot" hidden={view !== 'studio'}>
            <StudioWorkspace />
          </div>
        </div>
      </div>
      <TanStackRouterDevtools />
    </>
  )
}

export default function RootLayout() {
  return (
    <OSSettingsProvider>
      <Desktop />
    </OSSettingsProvider>
  )
}
