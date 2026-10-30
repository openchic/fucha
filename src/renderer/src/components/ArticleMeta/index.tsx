import type { Article } from '@shared/types'
import { Icon } from '../Icon'

type ArticleMetaProps = {
  article: Article
  onRefresh: () => void
  refreshing: boolean
  refreshError?: string
}

export const ArticleMeta = (props: ArticleMetaProps) => {
  const { article, onRefresh, refreshing, refreshError } = props
  const source = new URL(article.sourceUrl).hostname.replace(/^www\./, '')

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
        <dl className="mt-2 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-secondary leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">
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
        </dl>
      </div>
    </section>
  )
}

ArticleMeta.displayName = 'ArticleMeta'
