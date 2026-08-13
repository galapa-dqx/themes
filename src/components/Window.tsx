import {
  useEffect,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from 'react'
import WindowTitleBar from './WindowTitleBar'
import { WindowProvider } from '@/context/window'
import './Window.css'

type Bounds = { x: number; y: number; w: number; h: number }

type ResizeDir = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
const RESIZE_DIRS: ResizeDir[] = ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']

const MIN_W = 800
const MIN_H = 600

// Placement survives leaving/re-entering the preview route. Fine as a single
// module slot while the preview is the only Window on screen.
let cachedBounds: Bounds | null = null
let cachedMaximized = false

export default function Window({
  title,
  children,
  onClose,
  chrome = 'system',
}: {
  title: string
  children: ReactNode
  onClose?: () => void
  /** 'system' renders the OS title bar; 'app' lets children supply their own
   *  chrome (wired to the window via useOptionalWindowContext). */
  chrome?: 'system' | 'app'
}) {
  const [bounds, setBounds] = useState<Bounds>(() => {
    if (cachedBounds) return cachedBounds
    const w = Math.max(MIN_W, Math.min(960, window.innerWidth - 80))
    const h = Math.max(MIN_H, Math.min(680, window.innerHeight - 80))
    return {
      w,
      h,
      x: Math.max(0, (window.innerWidth - w) / 2),
      y: Math.max(0, (window.innerHeight - h) / 2),
    }
  })
  const [maximized, setMaximized] = useState(cachedMaximized)
  useEffect(() => {
    cachedBounds = bounds
    cachedMaximized = maximized
  }, [bounds, maximized])

  const track = (
    e: ReactPointerEvent,
    onMove: (dx: number, dy: number) => void,
  ) => {
    e.preventDefault()
    const sx = e.clientX
    const sy = e.clientY
    const move = (ev: globalThis.PointerEvent) =>
      onMove(ev.clientX - sx, ev.clientY - sy)
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    window.addEventListener('pointercancel', up)
  }

  const startMove = (e: ReactPointerEvent) => {
    if (maximized || e.button !== 0) return
    const start = bounds
    track(e, (dx, dy) =>
      setBounds({ ...start, x: start.x + dx, y: start.y + dy }),
    )
  }

  const startResize = (dir: ResizeDir) => (e: ReactPointerEvent) => {
    if (maximized || e.button !== 0) return
    const start = bounds
    track(e, (dx, dy) => {
      let { x, y, w, h } = start
      if (dir.includes('e')) w = Math.max(MIN_W, start.w + dx)
      if (dir.includes('s')) h = Math.max(MIN_H, start.h + dy)
      if (dir.includes('w')) {
        w = Math.max(MIN_W, start.w - dx)
        x = start.x + start.w - w
      }
      if (dir.includes('n')) {
        h = Math.max(MIN_H, start.h - dy)
        y = start.y + start.h - h
      }
      setBounds({ x, y, w, h })
    })
  }

  const toggleMaximize = () => setMaximized((m) => !m)

  return (
    <WindowProvider
      value={{
        title,
        isMaximized: maximized,
        toggleMaximize,
        startMove,
        close: onClose,
      }}
    >
      <div
        className={`win-window${maximized ? ' win-maximized' : ''}`}
        style={
          maximized
            ? undefined
            : {
                left: bounds.x,
                top: bounds.y,
                width: bounds.w,
                height: bounds.h,
              }
        }
      >
        {!maximized &&
          RESIZE_DIRS.map((dir) => (
            <div
              key={dir}
              className={`win-resize win-resize-${dir}`}
              onPointerDown={startResize(dir)}
            />
          ))}
        {chrome === 'system' && <WindowTitleBar />}
        <div className="win-body">{children}</div>
      </div>
    </WindowProvider>
  )
}
