import type { ReactNode } from 'react'
import { WindowContext, type WindowContextValue } from './WindowContext'

export function WindowProvider({
  value,
  children,
}: {
  value: WindowContextValue
  children: ReactNode
}) {
  return (
    <WindowContext.Provider value={value}>{children}</WindowContext.Provider>
  )
}
