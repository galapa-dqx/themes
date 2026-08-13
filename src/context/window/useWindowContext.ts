import { useContext } from 'react'
import { WindowContext } from './WindowContext'

export function useWindowContext() {
  const ctx = useContext(WindowContext)
  if (!ctx) {
    throw new Error('useWindowContext must be used within a WindowProvider')
  }
  return ctx
}

/** Like useWindowContext, but returns null outside a Window (console mode). */
export function useOptionalWindowContext() {
  return useContext(WindowContext)
}
