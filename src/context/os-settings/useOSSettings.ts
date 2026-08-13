import { useContext } from 'react'
import { OSSettingsContext } from './OSSettingsContext'

export function useOSSettings() {
  const ctx = useContext(OSSettingsContext)
  if (!ctx) {
    throw new Error('useOSSettings must be used within an OSSettingsProvider')
  }
  return ctx
}
