import type { Article } from '@shared/types'
import type { ExportState } from '../../hooks'
import type { AvailableTheme } from '../../theme/library'
import { Dropdown } from '../Dropdown'
import { Icon } from '../Icon'

type ArticleMetaProps = {
  article: Article
  onRefresh: () => void
  refreshing: boolean
  refreshError?: string
  themes: AvailableTheme[]
  themeId: string
  onThemeChange: (id: string) => void
  onManageThemes: () => void
  onCopy: () => void
  exportState: ExportState
}

export const ArticleMeta = (props: ArticleMetaProps) => {
  const {
    article,
    onRefresh,
    refreshing,
    refreshError,
    themes,
    themeId,
    onThemeChange,
    onManageThemes,
    onCopy,
    exportState,
  } = props
  const exporting = exportState.action !== null

  return (
    <section
      aria-labelledby="article-title"
      className="drag-region relative z-30 flex h-11 flex-none items-center gap-4 bg-white px-6">
      <div className="flex min-w-0 max-w-[55%] items-center gap-1.5">
        <h1
          id="article-title"
          title={article.title}
          className="min-w-0 truncate text-body text-ink">
          {article.title}
        </h1>
        <span className="sr-only">来源</span>
        <a
          href={article.sourceUrl}
          target="_blank"
          rel="noreferrer"
          aria-label={`打开原文：${article.sourceUrl}`}
          title={`打开原文：${article.sourceUrl}`}
          className="no-drag flex h-6 w-6 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink">
          <Icon name="external-link" className="h-3.5 w-3.5 flex-none" />
        </a>
      </div>
      <div className="no-drag ml-auto flex min-w-0 max-w-[300px] items-center gap-3 text-description text-ink-soft">
        {article.publishedAt && (
          <>
            <span className="sr-only">发布时间</span>
            <span
              className="hidden min-w-0 max-w-[120px] truncate min-[1100px]:inline"
              title={article.publishedAt}>
              {article.publishedAt}
            </span>
          </>
        )}
        {(refreshing || refreshError) && (
          <span
            role="status"
            className={`min-w-0 truncate ${refreshError ? 'text-danger' : 'sr-only'}`}>
            {refreshing ? '正在重新提取文章' : '重新提取失败，已保留当前文章'}
          </span>
        )}
        {(exportState.notice || exportState.error) && (
          <span
            role="status"
            className={`min-w-0 truncate ${exportState.error ? 'text-danger' : undefined}`}>
            {exportState.error ?? exportState.notice}
          </span>
        )}
      </div>
      <div className="no-drag flex flex-none items-center gap-2">
        <div className="group relative flex items-center">
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="重新提取"
            aria-busy={refreshing}
            aria-describedby="refresh-tooltip"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink active:scale-95">
            <Icon
              name="refresh"
              className={`h-4 w-4 flex-none ${refreshing ? 'animate-spin' : ''}`}
            />
          </button>
          <span
            id="refresh-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-description leading-5 text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
            重新提取
          </span>
        </div>
        <div className="group relative flex items-center">
          <button
            type="button"
            onClick={onCopy}
            disabled={exporting}
            aria-label={exporting ? '复制中' : '复制'}
            aria-busy={exporting}
            aria-describedby="copy-tooltip"
            className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-soft transition-colors hover:bg-raised hover:text-ink active:scale-95 disabled:opacity-40">
            <Icon
              name={exporting ? 'refresh' : 'copy'}
              className={`h-4 w-4 flex-none ${exporting ? 'animate-spin' : ''}`}
            />
          </button>
          <span
            id="copy-tooltip"
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-description leading-5 text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
            复制
          </span>
        </div>
        <Dropdown
          label="主题"
          value={themeId}
          options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
          actions={[{ label: '主题管理', onSelect: onManageThemes }]}
          onChange={onThemeChange}
        />
      </div>
    </section>
  )
}

ArticleMeta.displayName = 'ArticleMeta'
