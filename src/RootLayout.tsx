import { Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import TopNav from './components/TopNav.tsx'
import { OSSettingsProvider } from './context/os-settings'

export default function RootLayout() {
  return (
    <OSSettingsProvider>
      <div className="app-frame">
        <TopNav />
        <div className="app-view">
          {/* Routes swap the active view here; components with real work-in-
              progress (slicer, validator, window placement) keep it in
              module-level caches so leaving a route doesn't lose it. */}
          <div className="view-slot">
            <Outlet />
          </div>
        </div>
      </div>
      <TanStackRouterDevtools />
    </OSSettingsProvider>
  )
}
