import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArticleMeta, ErrorPanel, LoadingPanel } from '../../components'
import { useArticlePreview } from '../../hooks/useArticlePreview'

/** 预览页：对 ?url= 跑抓取流程，加载、成功与失败都在这一页内呈现 */
const Preview = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url') ?? ''
  const { state, retry } = useArticlePreview(url)

  if (!url) return <Navigate to="/" replace />

  const goHome = (): void => {
    navigate('/')
  }

  const cancel = (): void => {
    navigate(`/?url=${encodeURIComponent(url)}`)
  }

  return (
    <main className="h-full overflow-hidden bg-white">
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        {state.view === 'loading' && <LoadingPanel stage={state.stage} onCancel={cancel} />}
        {state.view === 'error' && (
          <ErrorPanel error={state.error} onRetry={retry} onGoHome={goHome} />
        )}
        {state.view === 'preview' && (
          <>
            <ArticleMeta article={state.article} onGoHome={goHome} />
            <div className="reading-viewport animate-fade-in min-h-0 flex-1 overflow-y-auto">
              {/* html 已在 extractArticle 里经 sanitizeHtml 白名单净化 */}
              <div
                className="article-body"
                dangerouslySetInnerHTML={{ __html: state.previewHtml }}
              />
            </div>
          </>
        )}
      </div>
    </main>
  )
}

Preview.displayName = 'Preview'

export default Preview
