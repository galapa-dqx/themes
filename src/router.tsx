import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import RootLayout from './RootLayout.tsx'
import Home from './pages/Home/Home.tsx'
import SettingsLayout from './pages/Settings/SettingsLayout.tsx'
import GraphicsSettings from './pages/Settings/GraphicsSettings.tsx'
import AboutSettings from './pages/Settings/AboutSettings.tsx'
import SettingsPlaceholder from './pages/Settings/SettingsPlaceholder.tsx'

const rootRoute = createRootRoute({
  component: RootLayout,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: Home,
})

const settingsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'settings',
  component: SettingsLayout,
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({ to: '/settings/graphics' })
  },
})

const graphicsSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'graphics',
  component: GraphicsSettings,
})

const aboutSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'about',
  component: AboutSettings,
})

/** Sections that exist in the design's tab bar but aren't designed yet.
 *  Spelled out one by one so the router keeps literal path types. */
const placeholderSection = (title: string) =>
  function PlaceholderPage() {
    return <SettingsPlaceholder title={title} />
  }

const gameSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'game',
  component: placeholderSection('Game'),
})
const playersSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'players',
  component: placeholderSection('Players'),
})
const controlsSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'controls',
  component: placeholderSection('Controls'),
})
const soundSettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'sound',
  component: placeholderSection('Sound'),
})
const claritySettingsRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: 'clarity',
  component: placeholderSection('Clarity'),
})

const routeTree = rootRoute.addChildren([
  indexRoute,
  settingsRoute.addChildren([
    settingsIndexRoute,
    graphicsSettingsRoute,
    aboutSettingsRoute,
    gameSettingsRoute,
    playersSettingsRoute,
    controlsSettingsRoute,
    soundSettingsRoute,
    claritySettingsRoute,
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
