import type { Article, FetchError, ImageDownloadResult } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Icon } from './components'
import { ExtractError, extractArticle } from './pipeline/extract'
import { renderPreviewHtml } from './pipeline/images'
import { ArticleMeta } from './views/ArticleMeta'
import ComposeView from './views/ComposeView'

type Stage = 'request' | 'extract'

type UiState =
  | { view: 'idle' }
  | { view: 'loading'; stage: Stage }
  | { view: 'preview'; article: Article; previewHtml: string }
  | { view: 'error'; error: AppError }

export interface AppError {
  kind: FetchError['kind'] | 'extract'
  message: string
}

const ERROR_LABEL: Record<AppError['kind'], string> = {
  network: '网络不可达',
  timeout: '请求超时',
  rejected: '目标拒绝',
  captcha: '需要验证',
  extract: '无法提取正文',
}

async function urlHash(url: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(url))
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
    .slice(0, 32)
}

const paint = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 16))

export default function App() {
  const [state, setState] = useState<UiState>({ view: 'idle' })
  const [draft, setDraft] = useState('')
  const requestId = useRef(0)

  const submit = useCallback(
    async (rawUrl: string) => {
      const url = rawUrl.trim()
      if (!url || state.view === 'loading') return
      if (import.meta.hot) sessionStorage.setItem('fucha:last-url', rawUrl)
      const currentRequest = ++requestId.current
      setDraft(rawUrl)
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
    },
    [state.view]
  )

  useEffect(() => {
    if (!import.meta.hot || sessionStorage.getItem('fucha:reprocess-on-load') !== '1') return
    sessionStorage.removeItem('fucha:reprocess-on-load')
    const url = sessionStorage.getItem('fucha:last-url')
    if (url) void submit(url)
  }, [submit])

  const retry = useCallback(() => {
    if (state.view === 'error') void submit(draft)
  }, [state.view, draft, submit])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'l') {
        if (state.view !== 'idle') return
        event.preventDefault()
        document.querySelector<HTMLInputElement>('.url-form input')?.select()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [state.view])

  const goHome = useCallback(() => {
    requestId.current += 1
    setDraft('')
    setState({ view: 'idle' })
  }, [])

  const cancelLoading = useCallback(() => {
    requestId.current += 1
    setState({ view: 'idle' })
  }, [])

  const busy = state.view === 'loading'

  if (state.view === 'idle') {
    return (
      <main className="compose-screen">
        <div aria-hidden="true" className="drag-region absolute inset-x-0 top-0 h-20" />
        <div className="compose-layout">
          <ComposeView url={draft} onUrlChange={setDraft} onSubmit={submit} disabled={busy} />
        </div>
      </main>
    )
  }

  return (
    <main className="h-full overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        {state.view === 'preview' && <ArticleMeta article={state.article} onGoHome={goHome} />}
        {state.view === 'loading' && <LoadingPanel stage={state.stage} onCancel={cancelLoading} />}
        {state.view === 'preview' && <PreviewPanel html={state.previewHtml} />}
        {state.view === 'error' && (
          <ErrorPanel
            error={state.error}
            label={ERROR_LABEL[state.error.kind]}
            onRetry={retry}
            onGoHome={goHome}
          />
        )}
      </div>
    </main>
  )
}

const LoadingPanel = (props: { stage: Stage; onCancel: () => void }) => {
  const { stage, onCancel } = props
  const label = stage === 'request' ? '正在请求' : '正在解析'
  return (
    <div className="flex h-full min-h-0 flex-col" aria-busy="true">
      <div className="article-header drag-region">
        <div className="content-column">
          <div className="article-toolbar">
            <span className="loading-brand">浮槎</span>
            <button type="button" onClick={onCancel} className="button button-secondary">
              <Icon name="close" />
              取消
            </button>
          </div>
          <div className="article-heading-slot">
            <h1>正在读取文章</h1>
          </div>
          <p role="status" className="loading-status">
            {label}，请稍候…
          </p>
        </div>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column skeleton-content" aria-hidden="true">
          <div className="skeleton-line skeleton-heading" />
          <div className="skeleton-paragraph">
            {[96, 100, 93, 100, 76].map((width, index) => (
              <div key={index} className="skeleton-line" style={{ width: `${width}%` }} />
            ))}
          </div>
          <div className="skeleton-paragraph">
            {[100, 91, 98, 65].map((width, index) => (
              <div key={index} className="skeleton-line" style={{ width: `${width}%` }} />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

LoadingPanel.displayName = 'LoadingPanel'

const PreviewPanel = ({ html }: { html: string }) => {
  return (
    <div className="reading-viewport fade-in min-h-0 flex-1 overflow-y-auto">
      <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

PreviewPanel.displayName = 'PreviewPanel'

type ErrorPanelProps = {
  error: AppError
  label: string
  onRetry: () => void
  onGoHome: () => void
}

const ErrorPanel = (props: ErrorPanelProps) => {
  const { error, label, onRetry, onGoHome } = props
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="article-header drag-region">
        <div className="content-column">
          <div className="article-toolbar">
            <button type="button" onClick={onGoHome} className="button button-back">
              <Icon name="arrow-left" />
              首页
            </button>
          </div>
          <div className="article-heading-slot">
            <h1>{label}</h1>
          </div>
        </div>
      </div>
      <div className="reading-viewport min-h-0 flex-1 overflow-y-auto">
        <div className="content-column error-content">
          <div className="error-notice" role="alert">
            <Icon name="alert" />
            <p>{error.message}</p>
          </div>
          <button type="button" onClick={onRetry} className="button button-primary retry-button">
            重新尝试
            <Icon name="arrow-right" />
          </button>
        </div>
      </div>
    </div>
  )
}

ErrorPanel.displayName = 'ErrorPanel'
