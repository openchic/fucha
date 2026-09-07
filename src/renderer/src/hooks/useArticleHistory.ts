import type { ArticleSummary } from '@shared/store-types'
import { useCallback, useEffect, useState } from 'react'

export type ArticleHistory = {
  items: ArticleSummary[]
  ready: boolean
  error?: string
  refresh: () => void
}

/** 历史文章摘要；数据库不可用时返回空列表，不阻断预览 */
export function useArticleHistory(): ArticleHistory {
  const [items, setItems] = useState<ArticleSummary[]>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string>()
  const [revision, setRevision] = useState(0)

  useEffect(() => {
    let cancelled = false
    window.api
      .listArticles(50, 0)
      .then((records) => {
        if (cancelled) return
        setItems(records)
        setError(undefined)
      })
      .catch(() => {
        if (cancelled) return
        setItems([])
        setError('历史暂不可用')
      })
      .finally(() => {
        if (!cancelled) setReady(true)
      })
    return () => {
      cancelled = true
    }
  }, [revision])

  const refresh = useCallback(() => setRevision((value) => value + 1), [])
  return { items, ready, error, refresh }
}
