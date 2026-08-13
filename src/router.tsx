import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router'
import RootLayout from './RootLayout.tsx'
import { ThemeScope, NotFound } from './RouteNotices.tsx'
import DesktopPreview from './components/DesktopPreview.tsx'
import Home from './pages/Home/Home.tsx'
import SettingsLayout from './pages/Settings/SettingsLayout.tsx'
import GraphicsSettings from './pages/Settings/GraphicsSettings.tsx'
import AboutSettings from './pages/Settings/AboutSettings.tsx'
import SettingsPlaceholder from './pages/Settings/SettingsPlaceholder.tsx'
import StudioWorkspace from './studio/StudioWorkspace.tsx'
import InfoPage from './studio/InfoPage.tsx'
import Palette from './studio/Palette.tsx'
import FontsPage from './studio/FontsPage.tsx'
import ControlsPage from './studio/ControlsPage.tsx'
import Gallery from './studio/Gallery.tsx'
import Slicer from './studio/Slicer.tsx'
import Validator from './studio/Validator.tsx'
import { resolveInitialThemeId } from './context/os-settings'

const rootRoute = createRootRoute({
  component: RootLayout,
  notFoundComponent: NotFound,
})

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  beforeLoad: () => {
    throw redirect({
      to: '/themes/$themeId/editor',
      params: { themeId: resolveInitialThemeId() },
    })
  },
})

/** Everything about one theme lives under /themes/$themeId — the editor
 *  (unthemed tooling) and the preview (the themed desktop). */
const themeRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: 'themes/$themeId',
  component: ThemeScope,
})

const themeIndexRoute = createRoute({
  getParentRoute: () => themeRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/themes/$themeId/editor', params })
  },
})

const editorRoute = createRoute({
  getParentRoute: () => themeRoute,
  path: 'editor',
  component: StudioWorkspace,
})

const editorIndexRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/themes/$themeId/editor/palette', params })
  },
})

/* Spelled out one by one so the router keeps literal path types. */
const editorInfoRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'info',
  component: InfoPage,
})
const editorPaletteRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'palette',
  component: Palette,
})
const editorFontsRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'fonts',
  component: FontsPage,
})
const editorControlsRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'controls',
  component: ControlsPage,
})
const editorGalleryRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'gallery',
  component: Gallery,
})
const editorSlicerRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'slicer',
  component: Slicer,
})
const editorValidatorRoute = createRoute({
  getParentRoute: () => editorRoute,
  path: 'validator',
  component: Validator,
})

const previewRoute = createRoute({
  getParentRoute: () => themeRoute,
  path: 'preview',
  component: DesktopPreview,
})

const previewIndexRoute = createRoute({
  getParentRoute: () => previewRoute,
  path: '/',
  component: Home,
})

const settingsRoute = createRoute({
  getParentRoute: () => previewRoute,
  path: 'settings',
  component: SettingsLayout,
})

const settingsIndexRoute = createRoute({
  getParentRoute: () => settingsRoute,
  path: '/',
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/themes/$themeId/preview/settings/graphics', params })
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
  themeRoute.addChildren([
    themeIndexRoute,
    editorRoute.addChildren([
      editorIndexRoute,
      editorInfoRoute,
      editorPaletteRoute,
      editorFontsRoute,
      editorControlsRoute,
      editorGalleryRoute,
      editorSlicerRoute,
      editorValidatorRoute,
    ]),
    previewRoute.addChildren([
      previewIndexRoute,
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
    ]),
  ]),
])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
