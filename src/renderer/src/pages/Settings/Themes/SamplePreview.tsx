const SAMPLE_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="260"><rect width="640" height="260" fill="#e6ece8"/><circle cx="320" cy="130" r="46" fill="#5e7b6f"/><path d="M238 188h164" stroke="#5e7b6f" stroke-width="6" stroke-linecap="round"/></svg>`
)}`

const SAMPLE_ARTICLE = `
<h1>示例文章：把长文读得舒服</h1>
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
<pre><code>const theme = createTheme({
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
<img src="${SAMPLE_IMAGE}" alt="示例插图" />
<hr />
<h5>更小的标题</h5>
<p>这一行用于确认 h5 与正文之间的层次关系。</p>
<h6>最小标题</h6>
<p>示例到此结束，保存后回到文章即可看到同一主题在真实内容上的效果。</p>
`

type SamplePreviewProps = {
  css: string
}

/** 主题配置页左侧：固定示例文章，使用当前草稿实时渲染 */
export const SamplePreview = ({ css }: SamplePreviewProps) => (
  <section
    aria-label="主题预览"
    className="flex h-full min-h-0 flex-none flex-col border-r border-line bg-raised"
    style={{ width: '38%', minWidth: '300px' }}>
    <div className="flex h-11 flex-none items-center border-b border-line px-6">
      <h2 className="text-secondary font-medium text-ink">示例预览</h2>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-6">
      <div className="mx-auto max-w-[440px] rounded-xl border border-line bg-white p-6">
        <style dangerouslySetInnerHTML={{ __html: css }} />
        <div className="article-body" dangerouslySetInnerHTML={{ __html: SAMPLE_ARTICLE }} />
      </div>
    </div>
  </section>
)

SamplePreview.displayName = 'SamplePreview'
