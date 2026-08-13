import {
  Subtract16Regular,
  Square16Regular,
  SquareMultiple16Regular,
  Dismiss16Regular,
} from '@fluentui/react-icons'
import { useWindowContext } from '@/context/window'

export default function WindowTitleBar() {
  const { title, isMaximized, toggleMaximize, startMove, close } =
    useWindowContext()

  return (
    <header
      className="win-titlebar"
      onPointerDown={startMove}
      onDoubleClick={toggleMaximize}
    >
      <span className="win-icon" aria-hidden="true" />
      <span className="win-title">{title}</span>
      <div
        className="win-caption-controls"
        onPointerDown={(e) => e.stopPropagation()}
        onDoubleClick={(e) => e.stopPropagation()}
      >
        <button type="button" className="win-caption-btn" aria-label="Minimize">
          <Subtract16Regular />
        </button>
        <button
          type="button"
          className="win-caption-btn"
          aria-label={isMaximized ? 'Restore' : 'Maximize'}
          onClick={toggleMaximize}
        >
          {isMaximized ? <SquareMultiple16Regular /> : <Square16Regular />}
        </button>
        <button
          type="button"
          className="win-caption-btn win-close"
          aria-label="Close"
          onClick={close}
        >
          <Dismiss16Regular />
        </button>
      </div>
    </header>
  )
}
