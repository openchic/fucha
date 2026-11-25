import type { FC, ReactNode } from 'react'
import { useCallback, useEffect, useLayoutEffect, useState } from 'react'
import { AppearanceContext, type AppearanceMode, type ResolvedAppearance } from '../../hooks'

type AppearanceProviderProps = {
  children: ReactNode
}

const COLOR_SCHEME_QUERY = '(prefers-color-scheme: dark)'

function isAppearanceMode(value: unknown): value is AppearanceMode {
  return value === 'system' || value === 'light' || value === 'dark'
}

function readSystemAppearance(): ResolvedAppearance {
  return window.matchMedia(COLOR_SCHEME_QUERY).matches ? 'dark' : 'light'
}

export const AppearanceProvider: FC<AppearanceProviderProps> = ({ children }) => {
  const [mode, setCurrentMode] = useState<AppearanceMode>('system')
  const [systemAppearance, setSystemAppearance] = useState<ResolvedAppearance>(readSystemAppearance)
  const resolvedMode = mode === 'system' ? systemAppearance : mode

  useEffect(() => {
    let active = true
    void window.api
      .getPreference('appearance.mode')
      .then((preference) => {
        if (active && isAppearanceMode(preference)) setCurrentMode(preference)
      })
      .catch(() => {
        // Unavailable preferences fall back to the current system appearance.
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const query = window.matchMedia(COLOR_SCHEME_QUERY)
    const updateSystemAppearance = (): void => {
      setSystemAppearance(query.matches ? 'dark' : 'light')
    }
    query.addEventListener('change', updateSystemAppearance)
    return () => query.removeEventListener('change', updateSystemAppearance)
  }, [])

  useLayoutEffect(() => {
    const root = document.documentElement
    root.dataset.appearance = resolvedMode
    root.style.colorScheme = resolvedMode
  }, [resolvedMode])

  const setMode = useCallback(async (nextMode: AppearanceMode): Promise<void> => {
    await window.api.setPreference('appearance.mode', nextMode)
    setCurrentMode(nextMode)
  }, [])

  return (
    <AppearanceContext.Provider value={{ mode, setMode }}>{children}</AppearanceContext.Provider>
  )
}

AppearanceProvider.displayName = 'AppearanceProvider'
