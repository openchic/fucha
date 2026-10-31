import type { ThemeToken } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  DEFAULT_AVAILABLE_THEME,
  findTheme,
  recordToTheme,
  themeErrorMessage,
  type AvailableTheme,
} from '../theme/library'

type UseArticleThemeOptions = {
  articleHash: string | null
  themes: AvailableTheme[]
  ready: boolean
  onThemeCreated?: () => void
}

export type ArticleThemeController = {
  activeTheme: AvailableTheme
  visibleTheme: AvailableTheme
  editing: boolean
  dirty: boolean
  themeReady: boolean
  selectTheme: (id: string) => void
  beginEdit: () => void
  cancelEdit: () => void
  updateToken: (token: ThemeToken) => void
  saveAs: (name: string) => Promise<string | null>
  confirmLeave: () => boolean
}

const DISCARD_PROMPT = '有未保存的主题调整，确定放弃？'

/** 当前文章主题、编辑草稿与另存为；草稿只存在于内存 */
export function useArticleTheme(options: UseArticleThemeOptions): ArticleThemeController {
  const { articleHash, themes, ready, onThemeCreated } = options
  const [activeId, setActiveId] = useState(DEFAULT_AVAILABLE_THEME.id)
  const [override, setOverride] = useState<AvailableTheme | null>(null)
  const [draft, setDraft] = useState<AvailableTheme | null>(null)
  const [editing, setEditing] = useState(false)
  const [themeReady, setThemeReady] = useState(false)
  const resolvedHash = useRef('')

  const activeTheme =
    findTheme(themes, activeId) ?? (override?.id === activeId ? override : DEFAULT_AVAILABLE_THEME)
  const visibleTheme = draft ?? activeTheme
  const dirty =
    editing && draft !== null && JSON.stringify(draft.token) !== JSON.stringify(activeTheme.token)

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
      const next = findTheme(themes, id) ?? DEFAULT_AVAILABLE_THEME
      setActiveId(next.id)
      setOverride(null)
      setDraft(null)
      setEditing(false)
      setThemeReady(true)
    })()

    return () => {
      cancelled = true
    }
  }, [articleHash, ready, themes])

  useEffect(() => {
    if (!dirty) return
    const handleBeforeUnload = (event: BeforeUnloadEvent): void => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  const persistChoice = useCallback(
    (id: string) => {
      if (articleHash) void window.fucha.setArticleTheme(articleHash, id).catch(() => {})
      void window.fucha.setPreference('theme.active', id).catch(() => {})
    },
    [articleHash]
  )

  const selectTheme = useCallback(
    (id: string): void => {
      if (id === activeTheme.id) return
      if (editing && dirty && !window.confirm(DISCARD_PROMPT)) return
      if (!findTheme(themes, id)) return
      setActiveId(id)
      setOverride(null)
      setDraft(null)
      setEditing(false)
      persistChoice(id)
    },
    [activeTheme.id, dirty, editing, persistChoice, themes]
  )

  const beginEdit = useCallback((): void => {
    setDraft({ ...activeTheme, token: structuredClone(activeTheme.token) })
    setEditing(true)
  }, [activeTheme])

  const cancelEdit = useCallback((): void => {
    if (dirty && !window.confirm(DISCARD_PROMPT)) return
    setDraft(null)
    setEditing(false)
  }, [dirty])

  const updateToken = useCallback((token: ThemeToken): void => {
    setDraft((current) => (current ? { ...current, token } : current))
  }, [])

  const saveAs = useCallback(
    async (rawName: string): Promise<string | null> => {
      const name = rawName.trim()
      if (!name) return '请输入主题名称'
      if (!draft) return '没有可保存的主题调整'

      const token: ThemeToken = {
        ...structuredClone(draft.token),
        id: `custom-${crypto.randomUUID()}`,
        name,
        builtin: false,
      }

      try {
        const record = await window.fucha.createTheme({
          token,
          css: draft.css,
          sourceThemeId: activeTheme.id,
        })
        const created = recordToTheme(record)
        setOverride(created)
        setActiveId(created.id)
        setDraft(null)
        setEditing(false)
        onThemeCreated?.()
        persistChoice(created.id)
        return null
      } catch (error) {
        return themeErrorMessage(error, '保存主题失败')
      }
    },
    [activeTheme.id, draft, onThemeCreated, persistChoice]
  )

  const confirmLeave = useCallback((): boolean => !dirty || window.confirm(DISCARD_PROMPT), [dirty])

  return {
    activeTheme,
    visibleTheme,
    editing,
    dirty,
    themeReady,
    selectTheme,
    beginEdit,
    cancelEdit,
    updateToken,
    saveAs,
    confirmLeave,
  }
}
