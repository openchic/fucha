import type { Article } from '@shared/types'
import { Icon } from '../Icon'

type ArticleMetaProps = {
  article: Article
  onGoHome: () => void
}

export const ArticleMeta = (props: ArticleMetaProps) => {
  const { article, onGoHome } = props
  const source = new URL(article.sourceUrl).hostname.replace(/^www\./, '')

  return (
    <section
      aria-labelledby="article-title"
      className="flex-none border-b border-line bg-white pt-9 pb-5 drag-region">
      <div className="content-column">
        <div className="mb-4.5 flex h-8 items-center justify-between gap-4">
          <button type="button" onClick={onGoHome} className="button button-back">
            <Icon name="arrow-left" />
            首页
          </button>
        </div>
        <h1
          id="article-title"
          className="text-[26px] font-semibold leading-[1.4] tracking-[-0.025em] [overflow-wrap:anywhere]">
          {article.title}
        </h1>
        <dl className="no-drag mt-3 flex flex-wrap items-center gap-x-[18px] gap-y-2 text-secondary leading-[1.6] text-ink-soft [overflow-wrap:anywhere]">
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
                className="text-ink underline decoration-line underline-offset-[3px] transition-[text-decoration-color] duration-150 ease-out hover:decoration-ink">
                {source}
              </a>
            </dd>
          </div>
          {article.author && (
            <div className="min-w-0">
              <dt className="sr-only">作者</dt>
              <dd>{article.author}</dd>
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
