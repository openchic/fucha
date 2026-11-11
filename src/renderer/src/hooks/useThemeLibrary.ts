import { useCallback, useEffect, useMemo, useState } from 'react'
import { BUILTIN_AVAILABLE, type AvailableTheme, recordToTheme } from '../theme/library'

export type ThemeLibrary = {
  themes: AvailableTheme[]
  ready: boolean
  error?: string
  refresh: () => void
}

/** 内置主题 + 本地自定义主题；数据库不可用时只用内置主题 */
export function useThemeLibrary(): ThemeLibrary {
  const [customThemes, setCustomThemes] = useState<AvailableTheme[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    setError(undefined)
    window.api
      .listThemes()
      .then((records) => {
        if (cancelled) return
        setCustomThemes(records.map(recordToTheme))
      })
      .catch(() => {
        if (cancelled) return
        setCustomThemes([])
        setError('本地主题存储不可用')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const themes = useMemo(() => [...BUILTIN_AVAILABLE, ...customThemes], [customThemes])
  const refresh = useCallback(() => setRevision((value) => value + 1), [])

  return { themes, ready, error, refresh }
}
