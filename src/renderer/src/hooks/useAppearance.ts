import { createContext, useContext } from 'react'

export type AppearanceMode = 'system' | 'light' | 'dark'
export type ResolvedAppearance = Exclude<AppearanceMode, 'system'>

export type AppearanceContextValue = {
  mode: AppearanceMode
  setMode: (mode: AppearanceMode) => Promise<void>
}

export const AppearanceContext = createContext<AppearanceContextValue | null>(null)

export function useAppearance(): AppearanceContextValue {
  const appearance = useContext(AppearanceContext)
  if (!appearance) throw new Error('useAppearance 必须在 AppearanceProvider 内使用')
  return appearance
}
