import { createContext, type PointerEvent as ReactPointerEvent } from 'react'

export type WindowContextValue = {
  title: string
  isMaximized: boolean
  toggleMaximize: () => void
  startMove: (e: ReactPointerEvent) => void
  close?: () => void
}

export const WindowContext = createContext<WindowContextValue | null>(null)
