import { useEffect, useRef } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { ArticleMeta, ErrorPanel, Icon, LoadingPanel } from '../../components'
import { useArticlePreview } from '../../hooks/useArticlePreview'
import { updatePreviewImages } from '../../pipeline/images'

/** 预览页：对 ?url= 跑抓取流程，加载、成功与失败都在这一页内呈现 */
const Preview = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url') ?? ''
  const { state, retry } = useArticlePreview(url)
  const articleBodyRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (state.view !== 'preview') return
    updatePreviewImages(articleBodyRef.current, state.article, state.articleHash)
  }, [state])

  if (!url) return <Navigate to="/" replace />

  const goHome = (): void => {
    navigate('/')
  }

  const cancel = (): void => {
    navigate(`/?url=${encodeURIComponent(url)}`)
  }

  return (
    <main className="relative h-full overflow-hidden bg-white">
      {(state.view === 'preview' || state.view === 'error') && (
        <button
          type="button"
          onClick={goHome}
          className="button button-back absolute top-16 left-6 z-10 h-7">
          <Icon name="arrow-left" />
          首页
        </button>
      )}
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-white">
        {state.view === 'loading' && <LoadingPanel stage={state.stage} onCancel={cancel} />}
        {state.view === 'error' && <ErrorPanel error={state.error} onRetry={retry} />}
        {state.view === 'preview' && (
          <>
            <ArticleMeta
              article={state.article}
              onRefresh={retry}
              refreshing={state.refreshing}
              refreshError={state.refreshError}
            />
            <div className="reading-viewport animate-fade-in min-h-0 flex-1 overflow-y-auto">
              {/* html 已在 extractArticle 里经 sanitizeHtml 白名单净化 */}
              <div
                ref={articleBodyRef}
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
