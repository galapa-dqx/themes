import { Link, Outlet, useParams } from '@tanstack/react-router'
import { FALLBACK_THEME_ID, useOSSettings } from './context/os-settings'

/** Guard for /themes/$themeId: a URL naming a theme that doesn't exist gets
 *  a plain notice instead of silently editing the fallback theme under the
 *  wrong id. */
export function ThemeScope() {
  const { themeId } = useParams({ strict: false })
  const { isKnownTheme } = useOSSettings()
  if (!isKnownTheme) {
    return (
      <div className="route-notice">
        <p>
          No theme with id <code>{themeId}</code> — it may have been deleted.
        </p>
        <Link to="/themes/$themeId/editor" params={{ themeId: FALLBACK_THEME_ID }}>
          Open the default theme
        </Link>
      </div>
    )
  }
  return <Outlet />
}

export function NotFound() {
  return (
    <div className="route-notice">
      <p>Nothing here.</p>
      <Link to="/">Back to the editor</Link>
    </div>
  )
}
