import { useMemo } from 'react'
import { PhonePreview } from '../../../components'
import { highlightArticleHtml } from '../../../theme/highlight'

const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="640" height="360" fill="#f3f4f6"/><g fill="none" stroke="#c7cbd1" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"><rect x="240" y="100" width="160" height="160" rx="20"/><circle cx="352" cy="144" r="14"/><path d="M248 232l44-48 32 32 22-22 46 38"/></g></svg>`
)}`

const SAMPLE_ARTICLE = `
<h1>把长文读得舒服</h1>
<p>这是一段用于预览主题的正文。字号、行高、字距、段落间距和颜色都会随右侧配置实时变化，方便在保存前确认阅读节奏。</p>
<h2>为什么排版值得调整</h2>
<p>同一篇文章在不同主题下会有不同的语气。较紧的段落适合信息密度高的技术长文，较松的段落更适合需要慢读的叙事文章。</p>
<ul>
  <li>正文层级清楚，长文更容易扫读；</li>
  <li>标题和引用有稳定的小面积强调；</li>
  <li>代码、表格与图片保持可辨认的边界。</li>
</ul>
<blockquote><p>排版不替读者理解内容，但会决定读者愿不愿意读下去。</p></blockquote>
<h3>引用与列表</h3>
<p>引用使用主题色边条，列表保留清晰的缩进和行距。下面的代码块与表格用于检查等宽字体、背景和边框。</p>
<p>行内代码写作 <code>const theme</code>，上下标如 H<sub>2</sub>O 与 x<sup>2</sup>。</p>
<pre><code class="language-typescript">const theme = createTheme({
  primary: '#5e7b6f',
  lineHeight: 1.75,
})</code></pre>
<table>
  <thead><tr><th>项目</th><th>用途</th><th>状态</th></tr></thead>
  <tbody>
    <tr><td>字号</td><td>正文阅读节奏</td><td>可调</td></tr>
    <tr><td>行高</td><td>段落密度</td><td>可调</td></tr>
    <tr><td>圆角</td><td>块级元素边界</td><td>可调</td></tr>
  </tbody>
</table>
<h4>图片与分隔线</h4>
<p>图片的上下间距由主题 token 控制，分割线采用当前的主题色。</p>
<figure>
  <img src="${SAMPLE_IMAGE}" alt="示例插图" />
  <figcaption>图注：示例插图，用于检查图片边距与图注文字样式。</figcaption>
</figure>
<hr />
<h5>更小的标题</h5>
<p>这一行用于确认 h5 与正文之间的层次关系。</p>
<h6>最小标题</h6>
<p>示例到此结束，保存后回到文章即可看到同一主题在真实内容上的效果。</p>
`

type SamplePreviewProps = {
  styleCss: string
  variables: Record<string, string>
}

/** 主题配置页左侧：固定示例文章，使用当前草稿实时渲染 */
export const SamplePreview = ({ styleCss, variables }: SamplePreviewProps) => {
  const sampleHtml = useMemo(() => highlightArticleHtml(SAMPLE_ARTICLE), [])

  return (
    <PhonePreview
      title="示例文章"
      ariaLabel="主题预览"
      styleCss={styleCss}
      variables={variables}
      html={sampleHtml}
      className="border-r border-divider"
    />
  )
}

SamplePreview.displayName = 'SamplePreview'
