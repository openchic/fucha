import type { Article } from '@shared/types'
import type { StoredImageInput } from '@shared/store-types'
import { usePageBridge } from '@shared/pageBridge'
import { useEffect, useMemo, useRef } from 'react'
import { Navigate, useLocation, useNavigate, useSearchParams } from 'react-router'
import { ArticleMeta, ErrorPanel, LoadingPanel } from '../../components'
import { useArticleExport, useArticlePreview, useArticleTheme, useThemeLibrary } from '../../hooks'
import { updatePreviewImages } from '../../pipeline/images'
import { buildPreviewCss } from '../../theme/apply'

function toStoredImages(article: Article): StoredImageInput[] {
  return article.images.map(({ id, originalUrl, status, width, height }) => ({
    id,
    originalUrl,
    status,
    width,
    height,
  }))
}

type PreviewContentProps = {
  url: string
  snapshotHash: string
}

/** Preview 子路由：文章抓取、主题选择、导出与右侧内容 */
const PreviewContent = ({ url, snapshotHash }: PreviewContentProps) => {
  const navigate = useNavigate()
  const location = useLocation()
  const { setPage, refreshHistory } = usePageBridge()
  const { state, retry, refresh } = useArticlePreview(url, { snapshotHash })
  const articleBodyRef = useRef<HTMLDivElement>(null)
  const savedHashRef = useRef('')
  const savedSnapshotRef = useRef('')
  const visitedSnapshotRef = useRef('')
  const persistedImagesRef = useRef('')
  const library = useThemeLibrary()
  const article = state.view === 'preview' ? state.article : null
  const articleHash = state.view === 'preview' ? state.articleHash : null
  const articleTheme = useArticleTheme({
    articleHash,
    themes: library.themes,
    ready: library.ready,
  })
  const previewCss = useMemo(
    () => buildPreviewCss(articleTheme.activeTheme),
    [articleTheme.activeTheme]
  )
  const { state: exportState, copy } = useArticleExport(
    article,
    articleHash ?? '',
    articleTheme.activeTheme
  )

  useEffect(() => {
    setPage({ activeHash: articleHash ?? undefined })
    return () => setPage(null)
  }, [articleHash, setPage])

  useEffect(() => {
    if (state.view !== 'preview') return
    updatePreviewImages(articleBodyRef.current, state.article, state.articleHash)
  }, [state])

  useEffect(() => {
    if (state.view !== 'preview' || !state.fromSnapshot) return
    savedHashRef.current = state.articleHash
    const snapshotKey = `${state.articleHash}:${state.loadedAt}`
    if (visitedSnapshotRef.current === snapshotKey) return
    visitedSnapshotRef.current = snapshotKey
    void window.fucha.touchArticle(state.articleHash).catch(() => {})
  }, [state])

  useEffect(() => {
    if (state.view !== 'preview' || state.fromSnapshot || !articleTheme.themeReady) return
    const snapshotKey = `${state.articleHash}:${state.loadedAt}`
    if (savedSnapshotRef.current === snapshotKey) return
    savedSnapshotRef.current = snapshotKey
    savedHashRef.current = state.articleHash
    void window.fucha
      .saveArticle({
        hash: state.articleHash,
        finalUrl: state.article.sourceUrl,
        article: state.article,
        images: toStoredImages(state.article),
        themeId: articleTheme.activeTheme.id,
      })
      .then(() => refreshHistory())
      .catch(() => {})
  }, [state, articleTheme.themeReady, articleTheme.activeTheme.id, refreshHistory])

  useEffect(() => {
    if (state.view !== 'preview' || savedHashRef.current !== state.articleHash) return
    const images = toStoredImages(state.article)
    const signature = JSON.stringify(images)
    if (persistedImagesRef.current === signature) return
    persistedImagesRef.current = signature
    void window.fucha.replaceArticleImages(state.articleHash, images).catch(() => {})
  }, [state])

  const cancel = (): void => {
    navigate(`/?url=${encodeURIComponent(url)}`)
  }

  return (
    <>
      {state.view === 'loading' && !state.quiet && (
        <LoadingPanel stage={state.stage} onCancel={cancel} />
      )}
      {state.view === 'error' && <ErrorPanel error={state.error} onRetry={retry} />}
      {state.view === 'preview' && (
        <>
          <ArticleMeta
            article={state.article}
            onRefresh={refresh}
            refreshing={state.refreshing}
            refreshError={state.refreshError}
            themes={library.themes}
            themeId={articleTheme.activeTheme.id}
            onThemeChange={articleTheme.selectTheme}
            onManageThemes={() => {
              navigate('/settings/themes', {
                state: { returnTo: `${location.pathname}${location.search}` },
              })
            }}
            onCopy={copy}
            exportState={exportState}
          />
          <div className="reading-viewport animate-fade-in min-h-0 flex-1 overflow-y-auto">
            <style dangerouslySetInnerHTML={{ __html: previewCss }} />
            {/* html 已在提取或快照读取时经白名单净化 */}
            <div
              ref={articleBodyRef}
              className="article-body"
              dangerouslySetInnerHTML={{ __html: state.previewHtml }}
            />
          </div>
        </>
      )}
    </>
  )
}

PreviewContent.displayName = 'PreviewContent'

/** Preview 路由入口：没有目标地址时回到 `/` */
const Preview = () => {
  const [params] = useSearchParams()
  const url = params.get('url') ?? ''
  const snapshotHash = params.get('hash') ?? ''
  if (!url && !/^[a-f0-9]{32}$/.test(snapshotHash)) return <Navigate to="/" replace />
  return <PreviewContent url={url} snapshotHash={snapshotHash} />
}

Preview.displayName = 'Preview'

export default Preview
