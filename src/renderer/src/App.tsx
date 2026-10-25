import type { Article, FetchError, ImageDownloadResult } from '@shared/types'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ExtractError, extractArticle } from './pipeline/extract'
import { renderPreviewHtml } from './pipeline/images'
import ComposeView from './views/ComposeView'
import PreviewView, { ArticleMeta } from './views/PreviewView'

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

      const fetched = await window.fucha.fetchArticle(url)
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

  const busy = state.view === 'loading'
  const spread = state.view !== 'idle'

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-canvas">
      <header className="flex h-16 shrink-0 items-center gap-6 bg-shell px-5">
        <div className="flex shrink-0 items-baseline gap-3">
          <span className="text-title font-medium tracking-[0.12em] text-shell-text">浮槎</span>
          <span className="text-secondary text-shell-muted">渡文过海</span>
        </div>
        {spread && (
          <PreviewView url={draft} onUrlChange={setDraft} onSubmit={submit} disabled={busy} />
        )}
        {state.view === 'preview' && (
          <nav aria-label="文章操作" className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              disabled
              className="h-9 rounded-control px-3 text-secondary text-shell-muted disabled:cursor-not-allowed disabled:opacity-50"
              title="主题选择（后续版本提供）">
              主题
            </button>
            <button
              type="button"
              disabled
              className="h-9 rounded-control px-3 text-secondary text-shell-muted disabled:cursor-not-allowed disabled:opacity-50"
              title="保存 HTML（后续版本提供）">
              保存
            </button>
            <button
              type="button"
              disabled
              className="h-9 rounded-control bg-primary px-4 text-secondary font-medium text-primary-ink disabled:cursor-not-allowed disabled:opacity-40"
              title="复制到公众号编辑器（后续版本提供）">
              复制
            </button>
          </nav>
        )}
      </header>

      {state.view === 'idle' ? (
        <main className="min-h-0 flex-1 overflow-y-auto bg-canvas">
          <ComposeView url={draft} onUrlChange={setDraft} onSubmit={submit} disabled={busy} />
        </main>
      ) : (
        <main className="flex min-h-0 flex-1 flex-col bg-white">
          {state.view === 'preview' && <ArticleMeta article={state.article} />}
          <div className="min-h-0 flex-1">
            {state.view === 'loading' && <LoadingPanel stage={state.stage} />}
            {state.view === 'preview' && <PreviewPanel html={state.previewHtml} />}
            {state.view === 'error' && (
              <ErrorPanel
                error={state.error}
                label={ERROR_LABEL[state.error.kind]}
                onRetry={retry}
              />
            )}
          </div>
        </main>
      )}
    </div>
  )
}

function LoadingPanel({ stage }: { stage: Stage }) {
  const label = stage === 'request' ? '正在请求' : '正在解析'
  return (
    <div className="h-full overflow-y-auto bg-white">
      <div className="mx-auto w-full max-w-[45.25rem] px-6 py-10">
        <p aria-live="polite" className="mb-8 text-secondary text-ink-soft">
          {label}…
        </p>
        <div className="h-7 w-3/4 rounded-control bg-skeleton" />
        <div className="mt-4 h-4 w-1/3 rounded-control bg-skeleton" />
        <div className="mt-12 space-y-4">
          {[92, 100, 96, 88, 100, 72].map((width, index) => (
            <div
              key={index}
              className="h-4 rounded-control bg-skeleton"
              style={{ width: `${width}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function PreviewPanel({ html }: { html: string }) {
  return (
    <div className="fade-in h-full overflow-y-auto bg-white">
      <div className="article-body" dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  )
}

function ErrorPanel({
  error,
  label,
  onRetry,
}: {
  error: AppError
  label: string
  onRetry: () => void
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-white px-10 text-center">
      <p className="text-title font-medium text-ink">{label}</p>
      <p className="mt-3 max-w-[26rem] text-body leading-relaxed text-ink-soft">{error.message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-6 h-10 rounded-control bg-primary px-5 text-body font-medium text-primary-ink transition-opacity duration-200 hover:opacity-85">
        重试
      </button>
    </div>
  )
}
