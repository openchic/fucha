import type { AvailableTheme } from '../../theme/library'
import { useOutletContext } from 'react-router'

export type SettingsContextValue = {
  themes: AvailableTheme[]
  ready: boolean
  refresh: () => void
  registerLeaveGuard: (guard: (() => Promise<boolean>) | null) => void
}

export function useSettingsContext(): SettingsContextValue {
  const context = useOutletContext<SettingsContextValue | null>()
  if (!context) throw new Error('useSettingsContext 必须在 Settings 布局内使用')
  return context
}
