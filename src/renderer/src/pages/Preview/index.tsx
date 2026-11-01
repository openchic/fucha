import type { Article } from '@shared/types'
import type { ArticleSummary, StoredImageInput } from '@shared/store-types'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useLocation, useNavigate, useSearchParams } from 'react-router'
import {
  ArticleMeta,
  ErrorPanel,
  Sidebar,
  Icon,
  LoadingPanel,
  ThemeManager,
  ThemePanel,
} from '../../components'
import {
  useArticleExport,
  useArticleHistory,
  useArticlePreview,
  useArticleTheme,
  useThemeLibrary,
} from '../../hooks'
import { updatePreviewImages } from '../../pipeline/images'
import { buildPreviewCss } from '../../theme/apply'
import NewArticlePanel from './components/NewArticlePanel'

function toStoredImages(article: Article): StoredImageInput[] {
  return article.images.map(({ id, originalUrl, status, width, height }) => ({
    id,
    originalUrl,
    status,
    width,
    height,
  }))
}

/** 预览工作台：左侧历史栏固定，右侧按路由展示新建输入页或文章 */
const Preview = () => {
  const [params] = useSearchParams()
  const location = useLocation()
  const navigate = useNavigate()
  const isNew = location.pathname === '/new'
  const url = params.get('url') ?? ''
  const snapshotHash = params.get('hash') ?? ''
  const targetUrl = isNew ? '' : url
  const targetHash = isNew ? '' : snapshotHash
  const hasTarget = Boolean(targetUrl || /^[a-f0-9]{32}$/.test(targetHash))
  const { state, retry, refresh } = useArticlePreview(targetUrl, { snapshotHash: targetHash })
  const history = useArticleHistory()
  const refreshHistory = history.refresh
  const articleBodyRef = useRef<HTMLDivElement>(null)
  const savedHashRef = useRef('')
  const savedSnapshotRef = useRef('')
  const visitedSnapshotRef = useRef('')
  const persistedImagesRef = useRef('')
  const [managerOpen, setManagerOpen] = useState(false)
  const library = useThemeLibrary()
  const article = !isNew && state.view === 'preview' ? state.article : null
  const articleHash = !isNew && state.view === 'preview' ? state.articleHash : null
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
    if (isNew || state.view !== 'preview') return
    updatePreviewImages(articleBodyRef.current, state.article, state.articleHash)
  }, [isNew, state])

  useEffect(() => {
    if (isNew || state.view !== 'preview' || !state.fromSnapshot) return
    savedHashRef.current = state.articleHash
    const snapshotKey = `${state.articleHash}:${state.loadedAt}`
    if (visitedSnapshotRef.current === snapshotKey) return
    visitedSnapshotRef.current = snapshotKey
    void window.fucha.touchArticle(state.articleHash).catch(() => {})
  }, [isNew, state])

  useEffect(() => {
    if (isNew || state.view !== 'preview' || state.fromSnapshot || !articleTheme.themeReady) {
      return
    }
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
  }, [isNew, state, articleTheme.themeReady, articleTheme.activeTheme.id, refreshHistory])

  useEffect(() => {
    if (isNew || state.view !== 'preview' || savedHashRef.current !== state.articleHash) return
    const images = toStoredImages(state.article)
    const signature = JSON.stringify(images)
    if (persistedImagesRef.current === signature) return
    persistedImagesRef.current = signature
    void window.fucha.replaceArticleImages(state.articleHash, images).catch(() => {})
  }, [isNew, state])

  const openNew = (): void => {
    void (async () => {
      if (!(await articleTheme.confirmLeave())) return
      articleTheme.discardDraft()
      navigate('/new')
    })()
  }

  const cancel = (): void => {
    void (async () => {
      if (!(await articleTheme.confirmLeave())) return
      articleTheme.discardDraft()
      navigate(`/new?url=${encodeURIComponent(url)}`)
    })()
  }

  const openHistory = (item: ArticleSummary): void => {
    void (async () => {
      if (!(await articleTheme.confirmLeave())) return
      articleTheme.discardDraft()
      navigate(`/preview?url=${encodeURIComponent(item.finalUrl)}&hash=${item.hash}`)
    })()
  }

  const deleteHistory = async (item: ArticleSummary): Promise<void> => {
    if (item.hash === articleHash && !(await articleTheme.confirmLeave())) return
    await window.fucha.deleteArticle(item.hash)
    if (item.hash === articleHash) {
      articleTheme.discardDraft()
      navigate('/')
    }
    refreshHistory()
  }

  return (
    <main className="flex h-full overflow-hidden bg-white">
      <Sidebar
        items={history.items}
        ready={history.ready}
        error={history.error}
        activeHash={articleHash ?? undefined}
        onNew={openNew}
        onOpen={openHistory}
        onDelete={deleteHistory}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
        {isNew && <NewArticlePanel />}
        {!isNew && !hasTarget && (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center">
            <Icon name="sail" className="h-10 w-10 flex-none text-primary [stroke-width:1.35]" />
            <h1 className="mt-4 text-[22px] font-semibold text-ink">浮槎</h1>
            <p className="mt-2 text-secondary text-ink-soft">
              从左侧选择一篇历史文章，或新建一篇文章
            </p>
            <button type="button" onClick={openNew} className="button button-primary mt-5 h-8 px-4">
              <Icon name="plus" className="h-4 w-4 flex-none" />
              新建文章
            </button>
          </div>
        )}
        {!isNew && hasTarget && state.view === 'loading' && !state.quiet && (
          <LoadingPanel stage={state.stage} onCancel={cancel} />
        )}
        {!isNew && hasTarget && state.view === 'error' && (
          <ErrorPanel error={state.error} onRetry={retry} />
        )}
        {!isNew && hasTarget && state.view === 'preview' && (
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
                onRefresh={refresh}
                refreshing={state.refreshing}
                refreshError={state.refreshError}
                themes={library.themes}
                themeId={articleTheme.activeTheme.id}
                onThemeChange={(id) => {
                  void articleTheme.selectTheme(id)
                }}
                onEditTheme={articleTheme.beginEdit}
                onManageThemes={() => setManagerOpen(true)}
                onCopy={copy}
                exportState={exportState}
              />
            )}
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
      </div>
      {managerOpen && (
        <ThemeManager
          themes={library.themes}
          activeThemeId={articleTheme.activeTheme.id}
          onClose={() => setManagerOpen(false)}
          onChanged={library.refresh}
          onApply={(id) => {
            void articleTheme.selectTheme(id).then((applied) => {
              if (applied) setManagerOpen(false)
            })
          }}
        />
      )}
    </main>
  )
}

Preview.displayName = 'Preview'

export default Preview
