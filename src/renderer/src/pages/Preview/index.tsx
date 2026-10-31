import type { Article } from '@shared/types'
import type { StoredImageInput } from '@shared/store-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import {
  ArticleMeta,
  ErrorPanel,
  Icon,
  LoadingPanel,
  ThemeManager,
  ThemePanel,
} from '../../components'
import { useArticleExport } from '../../hooks/useArticleExport'
import { useArticlePreview } from '../../hooks/useArticlePreview'
import { useArticleTheme } from '../../hooks/useArticleTheme'
import { useThemeLibrary } from '../../hooks/useThemeLibrary'
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

/** 预览页：对 ?url= 跑抓取流程，加载、成功与失败都在这一页内呈现 */
const Preview = () => {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const url = params.get('url') ?? ''
  const { state, retry } = useArticlePreview(url)
  const articleBodyRef = useRef<HTMLDivElement>(null)
  const savedHashRef = useRef('')
  const savedSnapshotRef = useRef('')
  const persistedImagesRef = useRef('')
  const [managerOpen, setManagerOpen] = useState(false)
  const library = useThemeLibrary()
  const article = state.view === 'preview' ? state.article : null
  const articleHash = state.view === 'preview' ? state.articleHash : null
  const articleTheme = useArticleTheme({
    articleHash,
    themes: library.themes,
    ready: library.ready,
    onThemeCreated: library.refresh,
  })
  const previewCss = useMemo(
    () => buildPreviewCss(articleTheme.visibleTheme),
    [articleTheme.visibleTheme]
  )
  const { state: exportState, copy } = useArticleExport(
    article,
    articleHash ?? '',
    articleTheme.visibleTheme
  )

  useEffect(() => {
    if (state.view !== 'preview') return
    updatePreviewImages(articleBodyRef.current, state.article, state.articleHash)
  }, [state])

  useEffect(() => {
    if (state.view !== 'preview' || !articleTheme.themeReady) return
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
      .catch(() => {})
  }, [state, articleTheme.themeReady, articleTheme.activeTheme.id])

  useEffect(() => {
    if (state.view !== 'preview' || savedHashRef.current !== state.articleHash) return
    const images = toStoredImages(state.article)
    const signature = JSON.stringify(images)
    if (persistedImagesRef.current === signature) return
    persistedImagesRef.current = signature
    void window.fucha.replaceArticleImages(state.articleHash, images).catch(() => {})
  }, [state])

  if (!url) return <Navigate to="/" replace />

  const goHome = (): void => {
    if (!articleTheme.confirmLeave()) return
    navigate('/')
  }

  const cancel = (): void => {
    if (!articleTheme.confirmLeave()) return
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
            {articleTheme.editing ? (
              <ThemePanel
                theme={articleTheme.visibleTheme}
                sourceName={articleTheme.activeTheme.name}
                dirty={articleTheme.dirty}
                onTokenChange={articleTheme.updateToken}
                onCancel={articleTheme.cancelEdit}
                onSaveAs={articleTheme.saveAs}
              />
            ) : (
              <ArticleMeta
                article={state.article}
                onRefresh={retry}
                refreshing={state.refreshing}
                refreshError={state.refreshError}
                themes={library.themes}
                themeId={articleTheme.activeTheme.id}
                onThemeChange={articleTheme.selectTheme}
                onEditTheme={articleTheme.beginEdit}
                onManageThemes={() => setManagerOpen(true)}
                onCopy={copy}
                exportState={exportState}
              />
            )}
            <div className="reading-viewport animate-fade-in min-h-0 flex-1 overflow-y-auto">
              <style dangerouslySetInnerHTML={{ __html: previewCss }} />
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
      {managerOpen && (
        <ThemeManager
          themes={library.themes}
          activeThemeId={articleTheme.activeTheme.id}
          onClose={() => setManagerOpen(false)}
          onChanged={library.refresh}
          onApply={(id) => {
            articleTheme.selectTheme(id)
            setManagerOpen(false)
          }}
        />
      )}
    </main>
  )
}

Preview.displayName = 'Preview'

export default Preview
