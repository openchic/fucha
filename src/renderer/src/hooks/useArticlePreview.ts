import type { Article, FetchError, ImageDownloadResult } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExtractError, extractArticle } from '../pipeline/extract'
import { renderPreviewHtml } from '../pipeline/images'

/** 错误态载荷，kind 决定界面上展示的失败分类 */
export type AppError = {
  kind: FetchError['kind'] | 'extract'
  message: string
}

export type Stage = 'request' | 'extract'

export type ArticlePreviewState =
  | { view: 'loading'; stage: Stage }
  | { view: 'preview'; article: Article; previewHtml: string }
  | { view: 'error'; error: AppError }

export type UseArticlePreviewResult = {
  state: ArticlePreviewState
  retry: () => void
}

async function urlHash(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

const paint = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 16))

/** 对给定链接跑一次抓取、提取与图片下载；url 变化或重试时重跑 */
export function useArticlePreview(url: string): UseArticlePreviewResult {
  const [state, setState] = useState<ArticlePreviewState>({ view: 'loading', stage: 'request' })
  const requestId = useRef(0)

  const run = useCallback(async () => {
    const currentRequest = ++requestId.current
    setState({ view: 'loading', stage: 'request' })

    const fetched = await window.fucha.fetchArticle(url).catch(() => ({
      ok: false as const,
      error: { kind: 'network' as const, message: '连接中断，请稍后重试。' },
    }))
    if (currentRequest !== requestId.current) return
    if (!fetched.ok) {
      setState({ view: 'error', error: fetched.error })
      return
    }

    setState({ view: 'loading', stage: 'extract' })
    await paint()
    if (currentRequest !== requestId.current) return
    let article: Article
    try {
      article = extractArticle(fetched.html, fetched.finalUrl)
    } catch (error) {
      const message = error instanceof ExtractError ? error.message : '解析正文时出现意外错误'
      setState({ view: 'error', error: { kind: 'extract', message } })
      return
    }

    const hash = await urlHash(fetched.finalUrl)
    if (currentRequest !== requestId.current) return
    setState({ view: 'preview', article, previewHtml: renderPreviewHtml(article, hash, []) })

    const results: ImageDownloadResult[] = await window.fucha
      .downloadImages({
        articleHash: hash,
        images: article.images.map(({ id, originalUrl }) => ({ id, originalUrl })),
      })
      .catch(() => article.images.map(({ id }) => ({ id, status: 'failed' as const })))
    if (currentRequest !== requestId.current) return
    const completedArticle: Article = {
      ...article,
      images: article.images.map((asset) => {
        const result = results.find((item) => item.id === asset.id)
        return { ...asset, status: result?.status ?? 'failed', localPath: result?.file }
      }),
    }
    setState({
      view: 'preview',
      article: completedArticle,
      previewHtml: renderPreviewHtml(completedArticle, hash, results),
    })
  }, [url])

  useEffect(() => {
    if (!url) return
    void run()
    return () => {
      requestId.current += 1
    }
  }, [run, url])

  const retry = useCallback(() => {
    void run()
  }, [run])

  return { state, retry }
}
