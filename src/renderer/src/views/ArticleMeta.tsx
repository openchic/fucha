import type { Article } from '@shared/types'
import { Icon } from '../components'

interface ArticleMetaProps {
  article: Article
  onGoHome: () => void
}

export const ArticleMeta = (props: ArticleMetaProps) => {
  const { article, onGoHome } = props
  const source = new URL(article.sourceUrl).hostname.replace(/^www\./, '')

  return (
    <section aria-labelledby="article-title" className="article-header drag-region">
      <div className="content-column">
        <div className="article-toolbar">
          <button type="button" onClick={onGoHome} className="button button-back">
            <Icon name="arrow-left" />
            首页
          </button>
        </div>
        <div className="article-heading-slot">
          <h1 id="article-title">{article.title}</h1>
        </div>
        <dl className="article-meta no-drag">
          <div className="meta-source">
            <span aria-hidden="true" className="source-dot" />
            <dt className="sr-only">来源</dt>
            <dd>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={article.sourceUrl}
                className="source-link">
                {source}
              </a>
            </dd>
          </div>
          {article.author && (
            <div>
              <dt className="sr-only">作者</dt>
              <dd>{article.author}</dd>
            </div>
          )}
          {article.publishedAt && (
            <div>
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
