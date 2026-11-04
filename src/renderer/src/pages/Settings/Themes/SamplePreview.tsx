import { type CSSProperties, useMemo, useState } from 'react'
import { Dropdown } from '../../../components'
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

type PreviewDevice = {
  value: string
  label: string
  hint: string
  width: number
  height: number
}

const PREVIEW_DEVICES: PreviewDevice[] = [
  { value: 'iphone-18-pro', label: 'iPhone 18 Pro', hint: '402 × 874', width: 402, height: 874 },
  { value: 'iphone-16', label: 'iPhone 16', hint: '393 × 852', width: 393, height: 852 },
  { value: 'iphone-se', label: 'iPhone SE', hint: '375 × 667', width: 375, height: 667 },
  { value: 'pixel-7', label: 'Pixel 7', hint: '412 × 915', width: 412, height: 915 },
  { value: 'galaxy-s21', label: 'Galaxy S21', hint: '360 × 800', width: 360, height: 800 },
]

type SamplePreviewProps = {
  styleCss: string
  variables: Record<string, string>
}

/** 主题配置页左侧：固定示例文章，使用当前草稿实时渲染 */
export const SamplePreview = ({ styleCss, variables }: SamplePreviewProps) => {
  const [deviceValue, setDeviceValue] = useState(PREVIEW_DEVICES[0].value)
  const device = PREVIEW_DEVICES.find((item) => item.value === deviceValue) ?? PREVIEW_DEVICES[0]
  const sampleHtml = useMemo(() => highlightArticleHtml(SAMPLE_ARTICLE), [])

  return (
    <section
      aria-label="主题预览"
      className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col border-r border-line bg-raised">
      <div className="absolute inset-x-0 top-0 z-10 flex h-11 items-center justify-between gap-3 px-6 pt-3">
        <h2 className="text-body text-ink">示例文章</h2>
        <Dropdown
          label="预览设备"
          value={deviceValue}
          options={PREVIEW_DEVICES}
          onChange={setDeviceValue}
        />
      </div>
      <div className="flex min-h-0 flex-1 items-start justify-center px-6 pb-6 pt-16">
        <div
          style={
            {
              width: `min(${device.width}px, 100%)`,
              height: `min(${device.height}px, 100%)`,
              ...variables,
            } as CSSProperties
          }
          className="flex flex-col overflow-hidden rounded-[28px] border border-line bg-white transition-[width,height] duration-200 ease-out">
          <style dangerouslySetInnerHTML={{ __html: styleCss }} />
          <div
            className="article-body min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            dangerouslySetInnerHTML={{ __html: sampleHtml }}
          />
        </div>
      </div>
    </section>
  )
}

SamplePreview.displayName = 'SamplePreview'
