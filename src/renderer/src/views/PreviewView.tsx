import type { Article } from '@shared/types'
import { UrlForm } from './ComposeView'

interface PreviewViewProps {
  url: string
  disabled?: boolean
  onUrlChange: (url: string) => void
  onSubmit: (url: string) => void
}

export default function PreviewView(props: PreviewViewProps) {
  return <UrlForm {...props} id="preview-url" compact />
}

export function ArticleMeta({ article }: { article: Article }) {
  const done = article.images.filter((image) => image.status === 'done').length
  const source = new URL(article.sourceUrl).hostname.replace(/^www\./, '')

  return (
    <section
      aria-labelledby="article-title"
      className="shrink-0 border-line border-b bg-white px-6">
      <div className="mx-auto w-full max-w-[52rem] py-5">
        <h1
          id="article-title"
          className="break-words text-[1.125rem] leading-relaxed font-medium text-ink">
          {article.title}
        </h1>
        <dl className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-secondary">
          <div className="flex items-center gap-2">
            <dt className="text-ink-soft">来源</dt>
            <dd>
              <a
                href={article.sourceUrl}
                target="_blank"
                rel="noreferrer"
                title={article.sourceUrl}
                className="text-ink underline decoration-line underline-offset-4 transition-colors duration-200 hover:decoration-ink">
                {source}
              </a>
            </dd>
          </div>
          {article.author && (
            <div className="flex items-center gap-2">
              <dt className="text-ink-soft">作者</dt>
              <dd className="text-ink">{article.author}</dd>
            </div>
          )}
          {article.publishedAt && (
            <div className="flex items-center gap-2">
              <dt className="text-ink-soft">发布时间</dt>
              <dd className="text-ink">{article.publishedAt}</dd>
            </div>
          )}
          <div className="flex items-center gap-2">
            <dt className="text-ink-soft">图片</dt>
            <dd className="text-ink">
              {article.images.length === 0
                ? '无'
                : done === article.images.length
                  ? `${done} / ${article.images.length} 已下载`
                  : `正在下载图片（${done} / ${article.images.length}）`}
            </dd>
          </div>
        </dl>
      </div>
    </section>
  )
}
