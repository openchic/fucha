import type { Article, FetchError, ImageDownloadResult } from '@shared/types'
import type { StoredArticle } from '@shared/store-types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExtractError, extractArticle } from '../pipeline/extract'
import { renderPreviewHtml } from '../pipeline/images'
import { highlightArticleHtml } from '../theme/highlight'

/** 错误态载荷，kind 决定界面上展示的失败分类 */
export type AppError = {
  kind: FetchError['kind'] | 'extract'
  message: string
}

export type Stage = 'request' | 'extract'

export type ArticlePreviewState =
  | { view: 'loading'; stage: Stage; quiet?: boolean }
  | {
      view: 'preview'
      article: Article
      articleHash: string
      previewHtml: string
      refreshing: boolean
      refreshError?: string
      /** 每次重新提取或打开快照更新，用于区分刷新与图片状态更新 */
      loadedAt: number
      /** 是否直接读取历史快照；快照打开不走 upsert */
      fromSnapshot: boolean
    }
  | { view: 'error'; error: AppError }

export type UseArticlePreviewResult = {
  state: ArticlePreviewState
  retry: () => void
  refresh: () => void
}

type UseArticlePreviewOptions = {
  /** 历史列表带来的快照 hash；有值时优先打开本地快照 */
  snapshotHash?: string
}

const HASH_PATTERN = /^[a-f0-9]{32}$/

async function urlHash(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

const paint = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 16))

function toArticle(stored: StoredArticle): Article {
  return {
    title: stored.title,
    author: stored.author,
    publishedAt: stored.publishedAt,
    sourceUrl: stored.sourceUrl,
    cover: stored.cover,
    html: stored.html,
    images: stored.images.map(({ id, originalUrl, status, width, height }) => ({
      id,
      originalUrl,
      status,
      width,
      height,
    })),
  }
}

async function resolveImages(article: Article, articleHash: string): Promise<Article> {
  const results: ImageDownloadResult[] = await window.api
    .downloadImages({
      articleHash,
      images: article.images.map(({ id, originalUrl }) => ({ id, originalUrl })),
    })
    .catch(() => article.images.map(({ id }) => ({ id, status: 'failed' as const })))
  return {
    ...article,
    images: article.images.map((asset) => {
      const result = results.find((item) => item.id === asset.id)
      return { ...asset, status: result?.status ?? 'failed', localPath: result?.file }
    }),
  }
}

/** 对给定链接跑一次抓取、提取与图片下载；带 snapshotHash 时优先打开历史快照 */
export function useArticlePreview(
  url: string,
  options: UseArticlePreviewOptions = {}
): UseArticlePreviewResult {
  const [state, setState] = useState<ArticlePreviewState>({ view: 'loading', stage: 'request' })
  const requestId = useRef(0)
  const snapshotHash = HASH_PATTERN.test(options.snapshotHash ?? '') ? options.snapshotHash! : ''

  const run = useCallback(
    async (keepPreviousPreview = false, forceNetwork = false) => {
      const currentRequest = ++requestId.current
      const useSnapshot = Boolean(snapshotHash) && !forceNetwork
      if (keepPreviousPreview) {
        setState((current) =>
          current.view === 'preview'
            ? { ...current, refreshing: true, refreshError: undefined }
            : { view: 'loading', stage: 'request' }
        )
      } else if (useSnapshot) {
        setState((current) =>
          current.view === 'preview'
            ? { ...current, refreshing: true, refreshError: undefined }
            : { view: 'loading', stage: 'request', quiet: true }
        )
      } else {
        setState({ view: 'loading', stage: 'request' })
      }

      let article: Article | null = null
      let hash = ''
      let fromSnapshot = false

      if (useSnapshot) {
        try {
          const stored = await window.api.getArticle(snapshotHash)
          if (currentRequest !== requestId.current) return
          if (stored) {
            article = toArticle(stored)
            hash = stored.hash
            fromSnapshot = true
          }
        } catch {
          // 存储不可用时退回网络抓取
        }
        if (currentRequest !== requestId.current) return
      }

      if (!article) {
        if (useSnapshot && !keepPreviousPreview) {
          setState({ view: 'loading', stage: 'request' })
        }
        const fetched = await window.api.fetchArticle(url).catch(() => ({
          ok: false as const,
          error: { kind: 'network' as const, message: '连接中断，请稍后重试。' },
        }))
        if (currentRequest !== requestId.current) return
        if (!fetched.ok) {
          setState((current) =>
            keepPreviousPreview && current.view === 'preview'
              ? { ...current, refreshing: false, refreshError: fetched.error.message }
              : { view: 'error', error: fetched.error }
          )
          return
        }

        if (!keepPreviousPreview) {
          setState({ view: 'loading', stage: 'extract' })
          await paint()
        }
        if (currentRequest !== requestId.current) return
        try {
          article = extractArticle(fetched.html, fetched.finalUrl)
        } catch (error) {
          const message = error instanceof ExtractError ? error.message : '解析正文时出现意外错误'
          setState((current) =>
            keepPreviousPreview && current.view === 'preview'
              ? { ...current, refreshing: false, refreshError: message }
              : { view: 'error', error: { kind: 'extract', message } }
          )
          return
        }

        hash = await urlHash(fetched.finalUrl)
        if (currentRequest !== requestId.current) return
      }

      if (!article) return

      setState({
        view: 'preview',
        article,
        articleHash: hash,
        previewHtml: highlightArticleHtml(renderPreviewHtml(article)),
        refreshing: false,
        loadedAt: Date.now(),
        fromSnapshot,
      })

      const completedArticle = await resolveImages(article, hash)
      if (currentRequest !== requestId.current) return
      setState((current) =>
        current.view === 'preview' && current.articleHash === hash
          ? { ...current, article: completedArticle, refreshing: false }
          : current
      )
    },
    [snapshotHash, url]
  )

  useEffect(() => {
    if (!url && !snapshotHash) return
    void run()
    return () => {
      requestId.current += 1
    }
  }, [run, url, snapshotHash])

  const retry = useCallback(() => {
    void run(true)
  }, [run])

  const refresh = useCallback(() => {
    void run(true, true)
  }, [run])

  return { state, retry, refresh }
}
