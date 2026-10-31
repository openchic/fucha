import type { Article } from '@shared/types'
import type { ExportState } from '../../hooks/useArticleExport'
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
  onEditTheme: () => void
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
    onEditTheme,
    onManageThemes,
    onCopy,
    exportState,
  } = props
  const source = new URL(article.sourceUrl).hostname.replace(/^www\./, '')
  const exporting = exportState.action !== null

  return (
    <section
      aria-labelledby="article-title"
      className="flex-none border-b border-line bg-white pt-15 pb-3">
      <div className="content-column">
        <h1
          id="article-title"
          className="text-[26px] font-semibold leading-[1.4] tracking-[-0.025em] [overflow-wrap:anywhere]">
          {article.title}
        </h1>
        <div className="mt-2 flex items-start gap-4">
          <dl className="flex min-w-0 flex-1 flex-wrap items-center gap-x-[18px] gap-y-2 text-secondary leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">
            <div className="flex min-w-0 items-center gap-[7px]">
              <span
                aria-hidden="true"
                className="h-[5px] w-[5px] flex-none rounded-full bg-primary"
              />
              <dt className="sr-only">来源</dt>
              <dd>
                <a
                  href={article.sourceUrl}
                  target="_blank"
                  rel="noreferrer"
                  title={article.sourceUrl}
                  className="text-ink no-underline!">
                  {source}
                </a>
              </dd>
            </div>
            <div className="group relative flex min-w-0 items-center">
              <dt className="sr-only">重新提取</dt>
              <dd>
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
              </dd>
              <span
                id="refresh-tooltip"
                role="tooltip"
                className="pointer-events-none absolute left-1/2 top-full z-10 mt-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-xs leading-5 text-white opacity-0 transition-opacity duration-100 group-hover:opacity-100 group-focus-within:opacity-100">
                {refreshing ? '正在重新提取' : '重新提取'}
              </span>
            </div>
            {(refreshing || refreshError) && (
              <div className="min-w-0">
                <dt className="sr-only">刷新状态</dt>
                <dd role="status" className={refreshError ? 'text-danger' : 'sr-only'}>
                  {refreshing ? '正在重新提取文章' : '重新提取失败，已保留当前文章'}
                </dd>
              </div>
            )}
            {article.publishedAt && (
              <div className="min-w-0">
                <dt className="sr-only">发布时间</dt>
                <dd>{article.publishedAt}</dd>
              </div>
            )}
            {(exportState.notice || exportState.error) && (
              <div className="min-w-0">
                <dt className="sr-only">导出状态</dt>
                <dd role="status" className={exportState.error ? 'text-danger' : undefined}>
                  {exportState.error ?? exportState.notice}
                </dd>
              </div>
            )}
          </dl>
          <div className="flex flex-none items-center gap-2">
            <Dropdown
              label="主题"
              value={themeId}
              options={themes.map((theme) => ({ value: theme.id, label: theme.name }))}
              actions={[
                { label: '编辑当前主题', onSelect: onEditTheme },
                { label: '管理自定义主题', onSelect: onManageThemes },
              ]}
              onChange={onThemeChange}
            />
            <button
              type="button"
              onClick={onCopy}
              disabled={exporting}
              className="button button-primary h-7 px-3">
              <Icon name="copy" className="h-3.5 w-3.5 flex-none" />
              {exportState.action === 'copy' ? '复制中' : '复制'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}

ArticleMeta.displayName = 'ArticleMeta'
