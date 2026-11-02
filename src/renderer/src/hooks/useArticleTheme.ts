import { useCallback, useEffect, useRef, useState } from 'react'
import { DEFAULT_AVAILABLE_THEME, findTheme, type AvailableTheme } from '../theme/library'

type UseArticleThemeOptions = {
  articleHash: string | null
  themes: AvailableTheme[]
  ready: boolean
}

export type ArticleThemeController = {
  activeTheme: AvailableTheme
  themeReady: boolean
  selectTheme: (id: string) => void
}

/** 当前文章主题选择；主题编辑与草稿在 Settings 页 */
export function useArticleTheme(options: UseArticleThemeOptions): ArticleThemeController {
  const { articleHash, themes, ready } = options
  const [activeId, setActiveId] = useState(DEFAULT_AVAILABLE_THEME.id)
  const [themeReady, setThemeReady] = useState(false)
  const resolvedHash = useRef('')

  const activeTheme = findTheme(themes, activeId) ?? DEFAULT_AVAILABLE_THEME

  useEffect(() => {
    if (!articleHash) {
      resolvedHash.current = ''
      setThemeReady(false)
      return
    }
    if (!ready || resolvedHash.current === articleHash) return
    resolvedHash.current = articleHash
    setThemeReady(false)

    let cancelled = false
    void (async () => {
      let id: string | null = null
      try {
        id = (await window.fucha.getArticle(articleHash))?.themeId ?? null
      } catch {
        // 存储不可用时回退默认主题
      }
      if (!id) {
        try {
          const preference = await window.fucha.getPreference('theme.active')
          if (typeof preference === 'string') id = preference
        } catch {
          // 存储不可用时回退默认主题
        }
      }
      if (cancelled) return
      setActiveId((findTheme(themes, id) ?? DEFAULT_AVAILABLE_THEME).id)
      setThemeReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [articleHash, ready, themes])

  const selectTheme = useCallback(
    (id: string): void => {
      if (!findTheme(themes, id)) return
      setActiveId(id)
      if (articleHash) void window.fucha.setArticleTheme(articleHash, id).catch(() => {})
      void window.fucha.setPreference('theme.active', id).catch(() => {})
    },
    [articleHash, themes]
  )

  return { activeTheme, themeReady, selectTheme }
}
