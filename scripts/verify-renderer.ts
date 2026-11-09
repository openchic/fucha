// 临时验证入口（渲染进程侧）：真 DOM 下验证提取、净化、图片路径映射、主题 CSS 与导出管道。
import type { Article } from '../src/shared/types'
import { extractArticle } from '../src/renderer/src/pipeline/extract'
import { sanitizeHtml } from '../src/renderer/src/pipeline/sanitize'
import { preserveSvgHeadings } from '../src/renderer/src/pipeline/svg'
import { renderPreviewHtml, updatePreviewImages } from '../src/renderer/src/pipeline/images'
import { buildExportHtml, exportHtmlToText } from '../src/renderer/src/pipeline/export'
import {
  exportRootStyle,
  buildExportCss,
  buildExportRootStyle,
  buildPreviewCss,
  tokenVariables,
} from '../src/renderer/src/theme/apply'
import { highlightArticleHtml, highlightThemeCss } from '../src/renderer/src/theme/highlight'
import { BUILTIN_THEMES, DEFAULT_THEME } from '../src/renderer/src/theme/presets'
import { BUILTIN_THEME_CONTRACT } from '../src/shared/builtin-themes'
import { THEME_RANGES, validateThemeToken } from '../src/renderer/src/theme/tokens'
import {
  resolveThemeVariables,
  scopeCss,
  themeRootDeclarations,
  validateThemeCss,
} from '../src/shared/theme-css'

const results: string[] = []
function check(name: string, pass: boolean, detail = ''): void {
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

const SAMPLE_ARTICLE = `<!doctype html><html><head>
<title>示例文章标题</title>
<meta name="author" content="示例作者">
<meta property="og:image" content="https://example.com/cover.png">
<meta property="article:published_time" content="2026-01-02T03:04:05Z">
</head><body><article>
<h1>示例文章标题</h1>
<p>${'这是一段足够长的正文内容，用于让 Readability 判定为文章主体。'.repeat(8)}</p>
<pre><code>const a = 1</code></pre>
<table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table>
<blockquote><p>引用内容</p></blockquote>
<img src="https://example.com/a.png" alt="图">
<a href="javascript:alert(1)">危险链接</a>
<script>window.__pwned = true</script>
<iframe src="https://evil.example"></iframe>
<p onclick="alert(2)" style="color:red">带内联事件的段落</p>
</article></body></html>`

const INLINE_SVG = `<svg viewBox="0 0 120 40" width="120" height="40" role="img" aria-label="流程图" class="diagram">
<title>流程图</title>
<style>
.diagram-bg { fill: url(#flowGradient); stroke: #dfe4de; }
.diagram-evil { fill: url(https://evil.example/paint.svg#p); animation: pulse 1s infinite; }
.diagram-text { fill: #fff; font-weight: 700; }
@import url(https://evil.example/theme.css);
@keyframes pulse { from { opacity: 0 } to { opacity: 1 } }
body { display: none }
</style>
<defs><linearGradient id="flowGradient" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="#8fae96"/><stop offset="100%" stop-color="#242a25"/></linearGradient><linearGradient id="externalRef" href="https://evil.example/gradient.svg#g"/></defs>
<rect class="diagram-bg" x="1" y="1" width="118" height="38" rx="6" stroke="#dfe4de" stroke-width="1" style="opacity:0.9;background:url(https://evil.example/x)"/>
<circle cx="10" cy="20" r="4" fill="url(#flowGradient)"/>
<ellipse cx="90" cy="20" rx="6" ry="4" class="page-fill"/>
<path d="M12 20h24" stroke="#ffffff" stroke-width="2" stroke-linecap="round" fill="none"/>
<text class="diagram-text" x="60" y="25" text-anchor="middle" font-size="12" style="font-weight:600;fill:#fff;background-image:url(https://evil.example/x)">流程</text>
<foreignObject width="100" height="40"><div xmlns="http://www.w3.org/1999/xhtml">foreign-payload</div></foreignObject>
<image href="https://evil.example/pixel.svg" width="10" height="10"/>
<use href="https://evil.example/icons.svg#x"/>
<animate attributeName="opacity" values="0;1"/>
<a href="javascript:alert(1)"><text>危险</text></a>
<rect x="0" y="0" width="10" height="10" onload="alert(1)" fill="url(https://evil.example/paint.svg#p)"/>
<script>alert(1)</script>
</svg>`

function testInlineSvg(): void {
  const clean = sanitizeHtml(INLINE_SVG)
  const localGradient = /url\(["']?#flowGradient["']?\)/
  check('3.4 保留内嵌 SVG 根与图形', /<svg/i.test(clean) && /<path/i.test(clean))
  check('3.4 保留 viewBox 与渐变', /\bviewbox=/i.test(clean) && /<lineargradient/i.test(clean))
  check('3.4 保留本地渐变引用', localGradient.test(clean))
  check('3.4 保留 SVG 文本与无障碍信息', /<text/i.test(clean) && clean.includes('流程图'))
  check(
    '3.4 只保留安全的 presentation 样式',
    clean.includes('opacity="0.9"') && !/background/i.test(clean)
  )
  check(
    '3.4 移除源码 style 与 class',
    !/<style/i.test(clean) && !/style=/i.test(clean) && !/class="diagram-bg"/.test(clean)
  )
  const svgDoc = new DOMParser().parseFromString(clean, 'text/html')
  const svgRect = svgDoc.querySelector('svg rect')
  const svgText = svgDoc.querySelector('svg text')
  check(
    '3.4 SVG 样式提升为表现属性',
    svgRect?.getAttribute('stroke') === '#dfe4de' &&
      svgRect.getAttribute('opacity') === '0.9' &&
      svgText?.getAttribute('fill') === '#fff' &&
      svgText.getAttribute('font-weight') === '600',
    `${svgRect?.outerHTML ?? 'missing'} | ${svgText?.outerHTML ?? 'missing'}`
  )
  check(
    '3.4 移除脚本、事件、外链资源与 foreignObject',
    !/<script/i.test(clean) &&
      !/onload=/i.test(clean) &&
      !/<foreignobject/i.test(clean) &&
      !clean.includes('foreign-payload') &&
      !/<image[\s>]/i.test(clean) &&
      !/<use[\s>]/i.test(clean) &&
      !/<animate[\s>]/i.test(clean) &&
      !clean.includes('gradient.svg') &&
      !/javascript:/i.test(clean)
  )

  const article = extractArticle(
    `<html><head><title>矢量文章</title><style>.page-fill { fill: #4a6ff3; }</style></head><body><article><h1>矢量文章</h1><p>${'包含内嵌矢量图的正文。'.repeat(30)}</p>${INLINE_SVG}</article></body></html>`,
    'https://example.com/svg'
  )
  check('3.4 正文提取保留内嵌 SVG', /<svg/i.test(article.html))
  const articleDoc = new DOMParser().parseFromString(article.html, 'text/html')
  const articleRect = articleDoc.querySelector('svg rect')
  const articleRectFill = (articleRect?.getAttribute('fill') ?? '').replace(/["']/g, '')
  check(
    '3.4 内部样式提升为表现属性',
    articleRectFill === 'url(#flowGradient)' &&
      articleRect?.getAttribute('opacity') === '0.9' &&
      !/style=/i.test(article.html),
    articleRect?.outerHTML ?? 'missing'
  )
  check('3.4 页面级样式同样提升为表现属性', article.html.includes('fill="rgb(74, 111, 243)"'))
  check(
    '3.4 危险 CSS 未进入正文',
    !/@import/i.test(article.html) &&
      !/@keyframes/i.test(article.html) &&
      !/animation:/i.test(article.html) &&
      !article.html.includes('evil.example') &&
      !article.html.includes('theme.css')
  )
  const preview = renderPreviewHtml(article, 'svg-preview', [])
  check('3.4 预览保留内嵌 SVG', /<svg/i.test(preview) && /<path/i.test(preview))
  check('3.4 预览保留内联颜色', /fill="url\(#flowGradient\)"/i.test(preview))
  const legacySvgArticle = {
    ...article,
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10" width="10" height="10"><rect width="10" height="10" style="fill:#123456;stroke:#000;stroke-dasharray:4 2"></rect><text x="5" y="5" style="fill:#fff;font-weight:600">旧</text></svg>',
  }
  const legacyExport = new DOMParser().parseFromString(
    buildExportHtml(legacySvgArticle, DEFAULT_THEME),
    'text/html'
  )
  const legacyRect = legacyExport.querySelector('svg rect')
  check(
    '3.4 导出提升旧快照的 SVG 样式',
    legacyRect?.getAttribute('fill') === '#123456' &&
      legacyRect.getAttribute('stroke-dasharray') === '4 2' &&
      legacyExport.querySelector('svg [style]') === null
  )
  const maskedSvgArticle = {
    ...article,
    html: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><mask id="m"><rect width="100" height="100" fill="white"></rect><rect x="20" y="20" width="40" height="10" fill="black"></rect></mask></defs><path d="M0 25H100" fill="none" stroke="#333" stroke-width="1" mask="url(#m)"></path><text x="40" y="27" text-anchor="middle" font-size="8" fill="#333">标签</text></svg>',
  }
  const maskedExport = new DOMParser().parseFromString(
    buildExportHtml(maskedSvgArticle, DEFAULT_THEME),
    'text/html'
  )
  const maskedSvg = maskedExport.querySelector('svg')
  const maskedText = maskedExport.querySelector('svg text')
  const maskedCover = maskedText?.previousElementSibling
  check(
    '3.4 导出烘平 SVG mask 并补尺寸',
    maskedSvg?.getAttribute('width') === '100' &&
      maskedSvg.getAttribute('height') === '100' &&
      !maskedSvg.querySelector('mask') &&
      maskedExport.querySelector('svg path')?.hasAttribute('mask') === false &&
      maskedCover?.localName === 'rect' &&
      maskedCover.getAttribute('fill') === '#ffffff' &&
      maskedCover.getAttribute('x') === '20' &&
      maskedCover.getAttribute('y') === '20'
  )
}

function testSvgHeadingLine(): void {
  const doc = new DOMParser().parseFromString(
    `<html><body><svg class="d2"><style>
.d2 .md { --color-border-muted: #333; }
.d2 .md h1 { padding-bottom: 0.3em; border-bottom: 1px solid var(--color-border-muted); }
</style><foreignObject x="10" y="0" width="200" height="40"><div xmlns="http://www.w3.org/1999/xhtml" class="md"><h1>标题</h1></div></foreignObject></svg></body></html>`,
    'text/html'
  )
  preserveSvgHeadings(doc)
  const line = doc.querySelector('svg line')
  const text = doc.querySelector('svg text')
  check(
    '3.4 SVG 标题下划线沿用来源变量颜色',
    text?.textContent === '标题' &&
      ['#333', 'rgb(51, 51, 51)', 'rgb(51,51,51)'].includes(line?.getAttribute('stroke') ?? '') &&
      line.getAttribute('x1') === '10' &&
      line.getAttribute('x2') === '210',
    line?.outerHTML ?? 'missing'
  )

  const plainDoc = new DOMParser().parseFromString(
    `<html><body><svg><foreignObject x="0" y="0" width="100" height="40"><div xmlns="http://www.w3.org/1999/xhtml"><h1>无边框标题</h1></div></foreignObject></svg></body></html>`,
    'text/html'
  )
  preserveSvgHeadings(plainDoc)
  check(
    '3.4 无来源标题线不补画',
    plainDoc.querySelector('svg text')?.textContent === '无边框标题' &&
      plainDoc.querySelector('svg line') === null
  )
}

function testSanitize(): void {
  const clean = sanitizeHtml(SAMPLE_ARTICLE)
  check('3.2 移除 script', !/<script/i.test(clean))
  check('3.2 移除 iframe', !/<iframe/i.test(clean))
  check('3.2 移除内联事件', !/onclick=/i.test(clean))
  check('3.2 移除危险协议', !/javascript:/i.test(clean))
  check('3.2 移除 style 属性', !/style=/i.test(clean))
  check('3.2 保留段落与标题', /<p/i.test(clean) && /<h1/i.test(clean))
  check('3.2 保留代码块', /<pre/i.test(clean) && /<code/i.test(clean))
  check('3.2 保留表格', /<table/i.test(clean) && /<th/i.test(clean))
  check('3.2 保留引用', /<blockquote/i.test(clean))
  check('3.2 保留图片', /<img/i.test(clean))
  check('3.2 危险链接已降级', !/javascript:alert/i.test(clean))
}

function testExtract(): void {
  check('3.3 净化未执行脚本', (window as unknown as { __pwned?: boolean }).__pwned === undefined)

  const article = extractArticle(SAMPLE_ARTICLE, 'https://example.com/post')
  check('3.1 提取标题', article.title === '示例文章标题', article.title)
  check('3.3 提取作者', article.author === '示例作者', article.author)
  check('3.3 提取发布时间', article.publishedAt === '2026-01-02T03:04:05Z', article.publishedAt)
  check('3.3 提取封面', article.cover === 'https://example.com/cover.png', article.cover)
  check('3.3 保留来源 URL', article.sourceUrl === 'https://example.com/post')
  check('3.3 图片清单已收集', article.images.length === 1, String(article.images.length))
  check('3.3 图片初始为 pending', article.images[0]?.status === 'pending')

  // 非文章页：正文过短
  let shortFailed = false
  try {
    extractArticle('<html><body><div>hi</div></body></html>', 'https://example.com/')
  } catch {
    shortFailed = true
  }
  check('3.1 非文章页判失败', shortFailed)

  const withoutMeta = extractArticle(
    SAMPLE_ARTICLE.replace(/<meta[^>]+>/g, ''),
    'https://example.com/no-meta'
  )
  check('3.3 缺失元信息留空', !withoutMeta.author && !withoutMeta.publishedAt && !withoutMeta.cover)

  const wechat = extractArticle(
    `<html><head><title>微信图片样例</title></head><body><article><p>${'微信正文内容'.repeat(60)}</p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-src="https://mmbiz.qpic.cn/real.png"></article></body></html>`,
    'https://mp.weixin.qq.com/s/sample'
  )
  check(
    '2.2 微信 data-src 映射为真实图片',
    wechat.images[0]?.originalUrl === 'https://mmbiz.qpic.cn/real.png'
  )

  const hiddenWechat = extractArticle(
    `<html><head><title>隐藏正文样例</title></head><body><div id="js_content" style="visibility: hidden; opacity: 0;"><p>${'微信隐藏容器正文。'.repeat(40)}</p><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" data-src="https://mmbiz.qpic.cn/hidden.png"></div></body></html>`,
    'https://mp.weixin.qq.com/s/hidden'
  )
  check('3.7 微信隐藏正文容器可被提取', hiddenWechat.html.includes('微信隐藏容器正文'))
  check(
    '3.7 隐藏容器内图片仍取 data-src',
    hiddenWechat.images[0]?.originalUrl === 'https://mmbiz.qpic.cn/hidden.png'
  )

  const relative = extractArticle(
    `<html><head><title>相对地址</title></head><body><article><p>${'相对地址正文。'.repeat(60)}</p><img src="/assets/a.png"><a href="/post/2">链接</a></article></body></html>`,
    'https://example.com/blog/post'
  )
  check(
    '3.1 相对图片按来源地址解析',
    relative.images[0]?.originalUrl === 'https://example.com/assets/a.png',
    relative.images[0]?.originalUrl
  )
  check('3.1 相对链接按来源地址解析', relative.html.includes('href="https://example.com/post/2"'))

  const mdnChrome = extractArticle(
    `<html><head><title>文档样例</title></head><body><article><h1>文档样例</h1><details class="baseline-indicator"><summary>基线</summary><p>广泛可用</p></details><p>${'文档正文内容。'.repeat(50)}</p></article></body></html>`,
    'https://developer.mozilla.org/zh-CN/docs/Web/API/Document'
  )
  check(
    '3.9 MDN 基线条清理',
    !mdnChrome.html.includes('广泛可用') && mdnChrome.html.includes('文档正文内容')
  )

  const nodeChrome = extractArticle(
    `<html><head><title>代码样例</title></head><body><article><h1>代码样例</h1><pre><code>const a = 1</code><div class="code-toolbar"><span class="code-language">javascript</span><button>copy</button></div></pre><p>${'代码正文内容。'.repeat(50)}</p></article></body></html>`,
    'https://nodejs.org/api/fs.html'
  )
  check(
    '3.9 Node 代码工具栏清理',
    !nodeChrome.html.includes('javascript') && nodeChrome.html.includes('const a = 1')
  )
}

function testRspressCodeBlocks(): void {
  const filler = `<p>${'用于让 Readability 判定正文的填充段落。'.repeat(20)}</p>`
  const titled = `<div class="rp-codeblock language-tsx"><div class="rp-codeblock__title">app/article/[id]/page.tsx</div><div class="rp-codeblock__content"><pre class="shiki" data-lang="tsx" data-title="app/article/[id]/page.tsx"><code>export default async function ArticlePage() {}</code></pre></div></div>`
  const plain = `<div class="rp-codeblock language-html"><div class="rp-codeblock__content"><pre data-lang="html"><code>&lt;p&gt;hi&lt;/p&gt;</code></pre></div></div>`
  const article = extractArticle(
    `<html><head><title>Rspress 代码块</title></head><body><article><h1>Rspress 代码块</h1>${filler}${titled}${plain}<pre><code>const a = 1</code></pre>${filler}</article></body></html>`,
    'https://example.com/rspress'
  )
  check(
    '5.1 带标题代码块归一为通用结构',
    article.html.includes(
      '<figure class="code-block"><figcaption>app/article/[id]/page.tsx</figcaption>'
    ) &&
      /class="language-tsx"/.test(article.html) &&
      !/<p>app\/article\/\[id\]\/page\.tsx<\/p>/.test(article.html)
  )
  check(
    '5.1 无标题代码块不生成标题',
    !/<figcaption[^>]*><\/figcaption>/.test(article.html) &&
      /class="language-html"/.test(article.html)
  )
  check('5.1 普通代码块不变', article.html.includes('<pre><code>const a = 1</code></pre>'))

  const highlighted = highlightArticleHtml(
    '<pre><code class="language-tsx">const a: number = 1</code></pre>'
  )
  check(
    '5.3 tsx 映射到 typescript 高亮',
    /hljs-keyword/.test(highlighted) && highlighted.includes('language-typescript')
  )
}

function testTheme(): void {
  const validated = validateThemeToken(DEFAULT_THEME.token)
  check('1.1 内置预设通过校验', validated.id === 'default' && validated.name === '雾紫')
  check('1.1 雾紫代码主题为 GitHub', validated.code.hljsTheme === 'github')
  check('1.1 默认主题主色为 #a8b9f0', validated.primary === '#a8b9f0')
  check(
    '1.1 引用背景色位于 quote',
    validated.quote.backgroundColor === '#f7f8fe' && !('backgroundColor' in validated)
  )
  check(
    '1.1 引用背景使用 quote 变量',
    tokenVariables(DEFAULT_THEME.token)['quote-background-color'] ===
      DEFAULT_THEME.token.quote.backgroundColor
  )
  check(
    '1.1 引用字号默认等于正文',
    BUILTIN_THEMES.every((theme) => theme.token.quote.fontSize === theme.token.text.fontSize)
  )
  const legacyQuoteToken = validateThemeToken({
    ...validated,
    quote: { ...validated.quote, decoration: undefined },
  })
  check('1.1 旧主题缺少引用装饰时沿用左条', legacyQuoteToken.quote.decoration === 'bar')
  let rejectedQuoteDecoration = ''
  try {
    validateThemeToken({ ...validated, quote: { ...validated.quote, decoration: 'underline' } })
  } catch (error) {
    rejectedQuoteDecoration = String(error)
  }
  check('1.1 引用拒绝标题专用装饰', rejectedQuoteDecoration.includes('theme.quote.decoration'))
  const legacyCaptionToken = validateThemeToken({
    ...validated,
    code: { ...validated.code, captionDivider: undefined },
  })
  check(
    '1.1 旧主题文件名分隔线默认使用边框色实线',
    legacyCaptionToken.code.captionDivider.borderBottomStyle === 'solid' &&
      tokenVariables(legacyCaptionToken)['code-caption-border-bottom-color'] ===
        validated.borderColor
  )
  const pageBackgroundToken = validateThemeToken({
    ...validated,
    page: { ...validated.page, backgroundColor: '#faf7f2' },
  })
  check('1.1 页面背景色通过校验', pageBackgroundToken.page.backgroundColor === '#faf7f2')
  let rejectedPageBackground = ''
  try {
    validateThemeToken({
      ...validated,
      page: { ...validated.page, backgroundColor: 'rgba(0, 0, 0, 0.5)' },
    })
  } catch (error) {
    rejectedPageBackground = String(error)
  }
  check(
    '1.1 页面背景拒绝非 hex 颜色',
    rejectedPageBackground.includes('theme.page.backgroundColor')
  )
  const legacyPageBackground = validateThemeToken({
    ...validated,
    page: { ...validated.page, backgroundColor: undefined },
  })
  check(
    '1.1 旧主题缺少页面背景时按透明读取',
    legacyPageBackground.page.backgroundColor === undefined
  )
  const pageBackgroundTheme = {
    ...DEFAULT_THEME,
    token: {
      ...DEFAULT_THEME.token,
      page: { ...DEFAULT_THEME.token.page, backgroundColor: '#faf7f2' },
    },
  }
  const pageBackgroundPreview = buildPreviewCss(pageBackgroundTheme)
  check(
    '1.1 预览应用页面背景',
    pageBackgroundPreview.includes('--fucha-page-background-color: #faf7f2;') &&
      pageBackgroundPreview.includes('background-color: var(--fucha-page-background-color);') &&
      pageBackgroundPreview.includes('min-height: 100%;')
  )
  check(
    '1.1 未设置页面背景时预览透明且导出不写背景',
    buildPreviewCss(DEFAULT_THEME).includes('--fucha-page-background-color: transparent;') &&
      !buildExportRootStyle(DEFAULT_THEME).includes('background-color')
  )
  check(
    '1.1 设置页面背景时导出写入外层',
    buildExportRootStyle(pageBackgroundTheme).includes('background-color: #faf7f2')
  )
  const pageBackgroundOverride = buildExportRootStyle({
    ...pageBackgroundTheme,
    css: '& { background-color: #123456; }',
  })
  check(
    '1.1 页面背景可被 & 覆盖',
    pageBackgroundOverride.indexOf('background-color: #faf7f2') >= 0 &&
      pageBackgroundOverride.lastIndexOf('background-color: #123456') >
        pageBackgroundOverride.indexOf('background-color: #faf7f2')
  )
  check(
    '1.1 代码块字号统一为 13px',
    BUILTIN_THEMES.every((theme) => theme.token.code.fontSize === 13)
  )
  let rejectedCodeSize = ''
  try {
    validateThemeToken({
      ...DEFAULT_THEME.token,
      code: { ...DEFAULT_THEME.token.code, fontSize: 17 },
    })
  } catch (error) {
    rejectedCodeSize = String(error)
  }
  check('1.1 代码块字号上限为 16px', rejectedCodeSize.includes('theme.code.fontSize'))
  check('1.1 代码块字号步长为 0.5', THEME_RANGES.codeFontSize.step === 0.5)
  check(
    '1.1 引用与代码块字号与来源字段解耦',
    BUILTIN_THEMES.every(({ token }) => {
      const variables = tokenVariables({
        ...token,
        text: { ...token.text, fontSize: 18 },
        code: { ...token.code, hljsTheme: 'xcode' },
      })
      return (
        variables['quote-font-size'] === `${token.quote.fontSize}px` &&
        variables['code-font-size'] === `${token.code.fontSize}px`
      )
    })
  )
  const qingci = BUILTIN_THEMES.find((theme) => theme.token.id === 'qingci')!
  check(
    '1.1 青瓷使用 qingci 标识，仅在正文 H1 和 H2 使用苔绿色竖条',
    qingci.token.name === '青瓷' &&
      qingci.token.primary === '#8fae96' &&
      qingci.token.text.color === '#2f2f2f' &&
      qingci.token.headingColor === '#262626' &&
      qingci.token.text.secondaryColor === '#666666' &&
      qingci.token.h1.decoration === 'bar' &&
      qingci.token.h2.decoration === 'bar' &&
      qingci.token.h3.decoration === 'none'
  )
  check(
    '1.1 青瓷正文行高与字距对齐雾紫',
    qingci.token.text.lineHeight === 1.8 && qingci.token.text.letterSpacing === 0.02
  )
  check(
    '1.1 内置主题的页面内距和标题字号符合预设',
    BUILTIN_THEMES.every(({ token }) => {
      const isShujuan = token.id === 'shujuan'
      const inlinePadding = isShujuan ? 24 : 18
      return (
        token.page.paddingTop === (isShujuan ? 32 : 40) &&
        token.page.paddingRight === inlinePadding &&
        token.page.paddingBottom === 40 &&
        token.page.paddingLeft === inlinePadding &&
        token.h1.fontSize === 20 &&
        token.h2.fontSize === 20 &&
        token.h3.fontSize === 16 &&
        token.h4.fontSize === 16 &&
        token.h5.fontSize === 16 &&
        token.h6.fontSize === 16
      )
    })
  )
  check(
    '1.1 内置主题保持两层标题：h1 与 h2 同款，h3 至 h6 同款',
    BUILTIN_THEMES.every(({ token }) => {
      const sameHeading = (left: typeof token.h1, right: typeof token.h1): boolean =>
        (
          [
            'fontSize',
            'fontWeight',
            'lineHeight',
            'textAlign',
            'decoration',
            'marginTop',
            'marginBottom',
          ] as const
        ).every((key) => left[key] === right[key])
      return (
        sameHeading(token.h1, token.h2) &&
        sameHeading(token.h3, token.h4) &&
        sameHeading(token.h3, token.h5) &&
        sameHeading(token.h3, token.h6)
      )
    })
  )
  check(
    '1.1 内置主题显式设置代码块背景',
    BUILTIN_THEMES.every(({ token }) => typeof token.code.backgroundColor === 'string')
  )
  check(
    '1.1 标题六级直接挂在 token 顶层',
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every((key) => key in validated)
  )

  let invalidBorder = ''
  try {
    validateThemeToken({
      ...DEFAULT_THEME.token,
      code: { ...DEFAULT_THEME.token.code, borderStyle: 'double' },
    })
  } catch (error) {
    invalidBorder = String(error)
  }
  check('1.1 非法代码边框样式被拒', invalidBorder.includes('theme.code.borderStyle'))
  check(
    '1.1 代码边框支持虚线',
    validateThemeToken({
      ...DEFAULT_THEME.token,
      code: { ...DEFAULT_THEME.token.code, borderStyle: 'dashed' },
    }).code.borderStyle === 'dashed'
  )

  const noBorderExport = buildExportCss({
    token: {
      ...DEFAULT_THEME.token,
      code: { ...DEFAULT_THEME.token.code, borderStyle: 'none' },
    },
    css: '',
  })
  check(
    '1.1 代码边框样式可关闭',
    /pre \{([\s\S]*?)\}/.exec(noBorderExport)?.[1]?.includes('none') === true
  )

  let rejected = ''
  try {
    validateThemeToken({
      ...DEFAULT_THEME.token,
      text: { ...DEFAULT_THEME.token.text, fontSize: 10 },
    })
  } catch (error) {
    rejected = String(error)
  }
  check('1.1 越界字号被拒', rejected.includes('theme.text.fontSize'), rejected)

  let missingHeading = ''
  try {
    const withoutH6 = { ...DEFAULT_THEME.token } as Record<string, unknown>
    delete withoutH6.h6
    validateThemeToken(withoutH6)
  } catch (error) {
    missingHeading = String(error)
  }
  check('1.1 缺少 h6 被拒', missingHeading.includes('theme.h6'), missingHeading)

  check(
    '1.1 标题颜色统一使用 headingColor',
    /h2 \{([\s\S]*?)\}/
      .exec(buildExportCss(DEFAULT_THEME))?.[1]
      ?.includes(`color: ${DEFAULT_THEME.token.headingColor}`) === true
  )

  const previewCss = buildPreviewCss(DEFAULT_THEME)
  const exportCss = buildExportCss(DEFAULT_THEME)
  check(
    '1.1 预览常量不进入导出',
    !exportCss.includes('max-width: 724px') && !exportCss.includes('padding: 40px 24px')
  )
  check('1.1 导出 CSS 不含变量', !exportCss.includes('var('))
  check(
    '1.1 预览 CSS 使用作用域变量',
    previewCss.includes('.article-body') && previewCss.includes('--fucha-primary')
  )
  check(
    '1.1 预览注入 quote 背景变量',
    previewCss.includes('--fucha-quote-background-color') &&
      !previewCss.includes('--fucha-background-color')
  )
  let legacyQuoteVariable = ''
  try {
    validateThemeCss('blockquote { background-color: var(--fucha-background-color); }')
  } catch (error) {
    legacyQuoteVariable = String(error)
  }
  check('1.1 旧引用背景变量被拒', legacyQuoteVariable.includes('background-color'))
  check(
    '1.1 新引用背景变量可用',
    validateThemeCss(
      'blockquote { background-color: var(--fucha-quote-background-color); }'
    ).includes('quote-background-color')
  )

  const shujuan = BUILTIN_THEMES.find((theme) => theme.token.id === 'shujuan')!
  check(
    '1.1 书卷正文字号对齐雾紫',
    shujuan.token.text.fontSize === 14 && shujuan.token.text.secondaryFontSize === 12
  )
  check('1.1 书卷主题色为柔化暖棕', shujuan.token.primary === '#ad6849')
  check(
    '1.1 书卷文字色偏墨且保持暖棕',
    shujuan.token.text.color === '#221e1b' &&
      shujuan.token.headingColor === '#1e1a18' &&
      shujuan.token.text.secondaryColor === '#5f564e'
  )
  const shujuanPreview = buildPreviewCss(shujuan)
  check(
    '1.1 书卷衬线字族由 theme.css 根规则进入预览与导出',
    shujuan.css.includes('& {') &&
      shujuanPreview.includes("font-family: 'Songti SC'") &&
      !shujuanPreview.includes('.article-body &') &&
      buildExportRootStyle(shujuan).includes("'SimSun'") &&
      !buildExportRootStyle(shujuan).includes('var(')
  )
  check(
    '1.1 第二套内置主题带入自己的 theme.css',
    shujuanPreview.includes('.article-body blockquote') &&
      shujuanPreview.includes('border-left-width: 2px') &&
      shujuanPreview.includes('letter-spacing: 0.04em')
  )
  check(
    '1.1 内置主题 token 全部通过校验',
    BUILTIN_THEMES.every((theme) => validateThemeToken(theme.token).id === theme.token.id)
  )
  check(
    '1.1 内置主题与主进程契约一致',
    BUILTIN_THEMES.length === BUILTIN_THEME_CONTRACT.length &&
      BUILTIN_THEMES.every(
        ({ token }, index) =>
          BUILTIN_THEME_CONTRACT[index]?.id === token.id &&
          BUILTIN_THEME_CONTRACT[index]?.name === token.name
      )
  )

  const cssRejections: { name: string; css: string; expected: string }[] = [
    { name: '伪元素', css: 'h1::before { content: "x"; }', expected: '选择器' },
    { name: '@ 规则', css: '@media (min-width: 1px) { h1 { color: #000; } }', expected: '@' },
    { name: '不支持属性', css: 'h1 { position: relative; }', expected: 'position' },
    { name: '未知变量', css: 'h1 { color: var(--fucha-nope); }', expected: 'nope' },
    { name: '!important', css: 'h1 { color: #000 !important; }', expected: '!important' },
    {
      name: '外部资源',
      css: 'h1 { color: red; } p { background-color: url(http://x); }',
      expected: 'url',
    },
    { name: '脚本注入', css: 'h1 { color: red; } </style><script>', expected: '<' },
  ]
  for (const item of cssRejections) {
    let message = ''
    try {
      validateThemeCss(item.css)
    } catch (error) {
      message = String(error)
    }
    check(`1.1 主题 CSS 拒绝${item.name}`, message.includes(item.expected), message)
  }
  check('1.1 合法主题 CSS 通过', validateThemeCss(shujuan.css) === shujuan.css)
  check('1.1 theme.css 支持 & 根规则', validateThemeCss('& { font-family: serif; }') !== '')
  let rootSelectorError = ''
  try {
    validateThemeCss('& h1 { color: #000; }')
  } catch (error) {
    rootSelectorError = String(error)
  }
  check('1.1 & 不允许与其他选择器组合', rootSelectorError.includes('只能单独使用'))

  const multiRootTheme = {
    token: shujuan.token,
    css: validateThemeCss('& { color: red }\n& { background-color: blue }'),
  }
  check(
    '1.1 多段根规则补齐声明分隔',
    themeRootDeclarations(multiRootTheme.css) === 'color: red;\nbackground-color: blue;'
  )
  check(
    '1.1 多段根规则进入预览与导出',
    buildPreviewCss(multiRootTheme).includes('color: red;\nbackground-color: blue;') &&
      buildExportRootStyle(multiRootTheme).includes('color: red;\nbackground-color: blue')
  )
  check(
    '1.1 纯 pre 代码块保持等宽',
    /(?:^|\n)pre \{([\s\S]*?)\}/
      .exec(buildExportCss(DEFAULT_THEME))?.[1]
      ?.includes('ui-monospace') === true
  )

  const quotedTheme = {
    token: shujuan.token,
    css: validateThemeCss('& { font-family: "Songti SC", serif; }'),
  }
  const quotedExport = buildExportHtml(
    {
      title: '根规则转义',
      sourceUrl: 'https://example.com/escape',
      html: '<p>正文</p>',
      images: [],
    },
    quotedTheme
  )
  const quotedSection = new DOMParser()
    .parseFromString(quotedExport, 'text/html')
    .querySelector('section')
  check(
    '1.1 根规则双引号在导出中转义',
    quotedExport.includes('&quot;Songti SC&quot;') &&
      quotedSection?.getAttribute('style')?.includes('"Songti SC"') === true
  )

  const injectedTheme = {
    token: shujuan.token,
    css: validateThemeCss('& { font-family: "x" onmouseover="alert(1)"; }'),
  }
  const injectedSection = new DOMParser()
    .parseFromString(
      buildExportHtml(
        {
          title: '根规则注入',
          sourceUrl: 'https://example.com/inject',
          html: '<p>正文</p>',
          images: [],
        },
        injectedTheme
      ),
      'text/html'
    )
    .querySelector('section')
  check(
    '1.1 根规则不能逃逸 style 属性',
    !injectedSection?.hasAttribute('onmouseover') &&
      injectedSection?.getAttribute('style')?.includes('onmouseover') === true
  )

  let lineMessage = ''
  try {
    validateThemeCss('h1 {\n  color: #000;\n}\nh2 {\n  position: absolute;\n}')
  } catch (error) {
    lineMessage = String(error)
  }
  check('1.1 CSS 错误带行号', lineMessage.includes('第 4 行'), lineMessage)

  let unresolved = ''
  try {
    resolveThemeVariables('h1 { color: var(--fucha-missing); }', {})
  } catch (error) {
    unresolved = String(error)
  }
  check('1.1 未定义变量解析失败', unresolved.includes('missing'), unresolved)

  const properties = [
    'fontFamily',
    'fontSize',
    'fontWeight',
    'lineHeight',
    'letterSpacing',
    'color',
    'textAlign',
    'marginTop',
    'marginRight',
    'marginBottom',
    'marginLeft',
    'paddingTop',
    'paddingRight',
    'paddingBottom',
    'paddingLeft',
    'backgroundColor',
    'borderTopWidth',
    'borderTopStyle',
    'borderTopColor',
    'borderRightWidth',
    'borderRightStyle',
    'borderRightColor',
    'borderBottomWidth',
    'borderBottomStyle',
    'borderBottomColor',
    'borderLeftWidth',
    'borderLeftStyle',
    'borderLeftColor',
    'borderRadius',
    'display',
    'maxWidth',
    'minWidth',
    'overflowX',
    'whiteSpace',
    'listStyleType',
    'borderCollapse',
    'textDecorationLine',
    'verticalAlign',
  ]

  const sample = `<p>正文 <strong>强调</strong> <em>斜体</em> <a href="#">链接</a></p><h1>一级</h1><h2>二级</h2><h3>三级</h3><h4>四级</h4><h5>五级</h5><h6>六级</h6><ul><li>列表</li></ul><ol><li>有序</li></ol><blockquote><p>引用</p></blockquote><pre><code>const a = 1</code></pre><figure class="code-block"><figcaption>app/page.tsx</figcaption><pre><code>const b = 2</code></pre></figure><figure class="table-scroll"><table><thead><tr><th>表头</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table></figure><figure><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="图"><figcaption>图注</figcaption></figure><hr>`

  const preview = document.createElement('div')
  preview.className = 'article-body'
  preview.style.width = '676px'
  preview.innerHTML = sample
  const exported = document.createElement('div')
  exported.className = 'export-preview'
  exported.style.cssText = `${exportRootStyle(DEFAULT_THEME.token)}; width: 676px`
  exported.innerHTML = sample

  const exportSheet = document.createElement('style')
  exportSheet.textContent = scopeCss(buildExportCss(DEFAULT_THEME), '.export-preview')
  document.head.append(preview, exported, exportSheet)
  const previewSheet = document.createElement('style')
  previewSheet.textContent = previewCss
  document.head.append(previewSheet)

  const selectors = [
    'p',
    'strong',
    'em',
    'a',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'li',
    'blockquote',
    'pre',
    'pre code',
    'code',
    'table',
    'figure.table-scroll',
    'figure.table-scroll table',
    'th',
    'td',
    'img',
    'figcaption',
    'figure.code-block',
    'figure.code-block figcaption',
    'figure.code-block pre',
    'hr',
  ]
  const mismatches: string[] = []
  for (const selector of selectors) {
    const left = preview.querySelector(selector)
    const right = exported.querySelector(selector)
    if (!left || !right) {
      mismatches.push(`${selector}: 元素缺失`)
      continue
    }
    const leftStyle = getComputedStyle(left)
    const rightStyle = getComputedStyle(right)
    for (const property of properties) {
      const a = leftStyle[property as keyof CSSStyleDeclaration]
      const b = rightStyle[property as keyof CSSStyleDeclaration]
      if (String(a) !== String(b)) {
        mismatches.push(`${selector}.${property}: ${String(a)} != ${String(b)}`)
      }
    }
  }

  const plainPre = preview.querySelector('pre')
  const blockFigure = preview.querySelector('figure.code-block')
  const blockPre = blockFigure?.querySelector('pre')
  check(
    '5.6 无标题与带标题代码块外框一致',
    !!plainPre &&
      !!blockFigure &&
      !!blockPre &&
      getComputedStyle(plainPre).borderTopWidth === getComputedStyle(blockFigure).borderTopWidth &&
      getComputedStyle(plainPre).borderTopColor === getComputedStyle(blockFigure).borderTopColor &&
      getComputedStyle(plainPre).borderTopLeftRadius ===
        getComputedStyle(blockFigure).borderTopLeftRadius &&
      getComputedStyle(blockPre).borderTopWidth === '0px'
  )

  const framedWrapper = preview.querySelector('figure.table-scroll')
  const framedFirstCell = preview.querySelector('figure.table-scroll th')
  check(
    '6.1 表格外框由滚动容器承担',
    !!framedWrapper &&
      !!framedFirstCell &&
      getComputedStyle(framedWrapper).borderTopWidth === '1px' &&
      getComputedStyle(framedWrapper).borderTopLeftRadius === '4px' &&
      getComputedStyle(framedFirstCell).borderTopWidth === '0px' &&
      getComputedStyle(framedFirstCell).borderLeftWidth === '0px'
  )

  preview.remove()
  exported.remove()
  previewSheet.remove()
  exportSheet.remove()
  check('2.1 预览与导出计算样式一致', mismatches.length === 0, mismatches.slice(0, 3).join('; '))
}

function testHighlightAndExport(): void {
  const highlighted = highlightArticleHtml(
    '<pre><code class="language-js">const a = 1</code></pre>'
  )
  check('2.3 代码块语法高亮', /hljs-keyword/.test(highlighted))
  check('2.3 hljs 主题不带背景', !/background(?:-color)?\s*:/.test(highlightThemeCss('github')))

  const previewCss = buildPreviewCss(DEFAULT_THEME)
  check(
    '2.3 代码块横向滚动不折行',
    /pre \{[\s\S]*overflow-x: auto[\s\S]*white-space: pre/.test(previewCss)
  )

  const article: Article = {
    title: '导出样张',
    author: '示例作者',
    sourceUrl: 'https://example.com/post',
    html: `<p>正文含 <strong>强调</strong> 与 <a href="https://external.example/x">外链</a>。</p><h2>章节</h2><ul><li>列表</li></ul><blockquote><p>引用</p></blockquote><pre><code class="language-js">const a = 1</code></pre><table><thead><tr><th>列</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table><img src="https://example.com/a.png" alt="图"><hr>`,
    images: [],
  }
  const html = buildExportHtml(article, DEFAULT_THEME)
  check('3.1 导出无 style 标签', !/<style/i.test(html))
  check('3.1 元素样式已内联', /<p style="/.test(html) && /<td[^>]*style="[^"]*border/.test(html))
  check('3.1 外链降级为文本', !/href="https?:/.test(html) && html.includes('外链'))
  check('3.1 微信不支持的属性已剔除', !/(position:|float:|display:\s*(grid|flex))/.test(html))
  check('3.1 代码块保留横向滚动', /<pre[^>]*style="[^"]*overflow-x: auto/.test(html))
  const exportDoc = new DOMParser().parseFromString(html, 'text/html')
  const exportedQuote = exportDoc.querySelector('blockquote')
  check(
    '3.1 左条引用导出为主色实线',
    exportedQuote?.style.borderLeftStyle === 'solid' &&
      exportedQuote.style.borderLeftColor === 'rgb(168, 185, 240)'
  )
  const exportedCode = exportDoc.querySelector('pre')
  check(
    '5.6 雾紫无标题代码块导出保留底色和圆角且无外框',
    !!exportedCode?.style.backgroundColor &&
      exportedCode.style.borderRadius === '4px' &&
      exportedCode.style.borderStyle === 'none'
  )
  check('3.1 高亮样式已内联', /hljs-keyword/.test(html))
  check(
    '3.3 导出不附加来源行',
    !html.includes('原文：https://example.com/post') && !html.includes('作者：示例作者')
  )
  check('3.3 纯文本兜底不含来源行', !exportHtmlToText(html).includes('原文：'))

  const titledCodeHtml =
    '<figure class="code-block"><figcaption>app/page.tsx</figcaption><pre><code class="language-ts">const a = 1</code></pre></figure>'
  const qingci = BUILTIN_THEMES.find((theme) => theme.token.id === 'qingci')!
  const qingciExport = new DOMParser().parseFromString(
    buildExportHtml({ ...article, html: article.html + titledCodeHtml }, qingci),
    'text/html'
  )
  const qingciHeading = qingciExport.querySelector('h2')
  check(
    '3.1 青瓷导出使用浅苔底色与主题线色',
    qingciHeading?.style.borderLeftColor === 'rgb(143, 174, 150)' &&
      qingciHeading?.style.color === 'rgb(38, 38, 38)' &&
      !qingciHeading.style.backgroundColor &&
      !qingciHeading.style.paddingTop &&
      qingciExport.querySelector('blockquote')?.style.borderLeftStyle === 'none' &&
      qingciExport.querySelector('blockquote')?.style.backgroundColor === 'rgb(241, 245, 242)' &&
      qingciExport.querySelector('.code-block')?.style.backgroundColor === 'rgb(241, 245, 242)' &&
      qingciExport.querySelector('th')?.style.backgroundColor === 'rgb(241, 245, 242)' &&
      qingciExport.querySelector('.code-block figcaption')?.style.color === 'rgb(102, 102, 102)' &&
      qingciExport.querySelector('figure.table-scroll')?.style.borderTopColor ===
        'rgb(212, 224, 214)' &&
      qingciExport.querySelector('.code-block figcaption')?.style.borderBottomColor ===
        'rgb(211, 224, 214)' &&
      qingciExport.querySelector('hr')?.style.borderTopColor === 'rgb(211, 224, 214)'
  )

  const titledExport = buildExportHtml({ ...article, html: titledCodeHtml }, DEFAULT_THEME)
  const figureAttrs = /<figure([^>]*)>/.exec(titledExport)?.[1] ?? ''
  const caption = new DOMParser()
    .parseFromString(titledExport, 'text/html')
    .querySelector('figcaption')
  check(
    '5.4 代码标题卡片导出样式已内联',
    figureAttrs.includes('border-radius') &&
      figureAttrs.includes('border-style: none') &&
      caption?.style.borderBottomColor === 'rgb(236, 238, 244)' &&
      caption.style.borderBottomWidth === '1px' &&
      !!caption.style.fontFamily &&
      /<pre[^>]*style="[^"]*(?:border-radius|border-bottom-left-radius)/.test(titledExport)
  )

  for (const style of ['dashed', 'none'] as const) {
    const token = {
      ...DEFAULT_THEME.token,
      code: {
        ...DEFAULT_THEME.token.code,
        borderStyle: 'solid' as const,
        captionDivider: { borderBottomStyle: style, borderBottomColor: '#56789a' },
      },
    }
    const customized = new DOMParser().parseFromString(
      buildExportHtml({ ...article, html: titledCodeHtml }, { ...DEFAULT_THEME, token }),
      'text/html'
    )
    check(
      `5.4 文件名分隔线导出 ${style} 与外框独立`,
      customized.querySelector('figure')?.style.borderTopStyle === 'solid' &&
        customized.querySelector('figcaption')?.style.borderBottomStyle === style &&
        customized.querySelector('figcaption')?.style.borderBottomColor === 'rgb(86, 120, 154)'
    )
  }
}

function testDomParity(): void {
  const article: Article = {
    title: '结构一致',
    sourceUrl: 'https://example.com/parity',
    html: '<h1>结构一致</h1><p>正文</p><blockquote><p>引用一</p><p>引用二</p></blockquote>',
    images: [],
  }
  const preview = renderPreviewHtml(article)
  const exported = buildExportHtml(article, DEFAULT_THEME)
  check(
    '6.2 预览与导出都去除重复首标题',
    !/<h1[^>]*>结构一致<\/h1>/.test(preview) && !/<h1[^>]*>结构一致<\/h1>/.test(exported)
  )

  const previewDoc = new DOMParser().parseFromString(preview, 'text/html')
  const exportDoc = new DOMParser().parseFromString(exported, 'text/html')
  const previewTail = previewDoc.querySelector('blockquote')?.lastElementChild as HTMLElement | null
  const exportTail = exportDoc.querySelector('blockquote')?.lastElementChild as HTMLElement | null
  check(
    '6.2 预览与导出引用末段间距一致',
    previewTail?.style.marginBottom === '0px' && exportTail?.style.marginBottom === '0px'
  )

  const wideHeaders = Array.from({ length: 6 }, (_, index) => `<th>列${index + 1}</th>`).join('')
  const tableArticle: Article = {
    title: '表格滚动',
    sourceUrl: 'https://example.com/table',
    html: `<p>正文</p><table><thead><tr><th>字词</th><th>读音</th><th>句中含义</th></tr></thead><tbody><tr><td>潦水</td><td>lǎo shuǐ</td><td>雨后积水</td></tr></tbody></table><table><thead><tr>${wideHeaders}</tr></thead></table>`,
    images: [],
  }
  const tablePreview = renderPreviewHtml(tableArticle)
  const tableExported = buildExportHtml(tableArticle, DEFAULT_THEME)
  check(
    '6.1 表格包横向滚动容器',
    /<figure class="table-scroll table-scroll-wide">/.test(tablePreview) &&
      /<figure class="table-scroll table-scroll-wide"/.test(tableExported)
  )
  check(
    '6.1 单元格最小宽度与滚动导出',
    /<th[^>]*style="[^"]*min-width: 5em/.test(tableExported) &&
      !/<table[^>]*style="[^"]*min-width/.test(tableExported) &&
      /overflow-x: auto/.test(tableExported) &&
      /<figure class="table-scroll[^"]*"[^>]*style="[^"]*border/.test(tableExported) &&
      /<th[^>]*style="[^"]*(?:border-top: none|border-top-width: 0)/.test(tableExported)
  )

  const tablePreviewRoot = document.createElement('div')
  tablePreviewRoot.className = 'article-body'
  tablePreviewRoot.style.cssText = 'width: 360px; box-sizing: border-box'
  tablePreviewRoot.innerHTML = tablePreview
  const tableExportRoot = document.createElement('div')
  tableExportRoot.style.width = '360px'
  tableExportRoot.innerHTML = tableExported
  const tableStyle = document.createElement('style')
  tableStyle.textContent = buildPreviewCss(DEFAULT_THEME)
  document.head.append(tableStyle)
  document.body.append(tablePreviewRoot, tableExportRoot)
  for (const [label, root] of [
    ['预览', tablePreviewRoot],
    ['导出', tableExportRoot],
  ] as const) {
    const [shortTable, wideTable] = root.querySelectorAll('figure.table-scroll')
    check(
      `6.4 360px ${label}中三列短表完整显示、六列表局部滚动`,
      !!shortTable &&
        !!wideTable &&
        shortTable.clientWidth > 0 &&
        shortTable.scrollWidth === shortTable.clientWidth &&
        wideTable.scrollWidth > wideTable.clientWidth &&
        root.scrollWidth === root.clientWidth
    )
  }
  tablePreviewRoot.remove()
  tableExportRoot.remove()
  tableStyle.remove()

  const narrowArticle: Article = {
    title: '窄表',
    sourceUrl: 'https://example.com/narrow-table',
    html: '<p>正文</p><table><thead><tr><th>列一</th><th>列二</th></tr></thead><tbody><tr><td>甲</td><td>乙</td></tr></tbody></table>',
    images: [],
  }
  const narrowPreview = renderPreviewHtml(narrowArticle)
  const narrowExported = buildExportHtml(narrowArticle, DEFAULT_THEME)
  check(
    '6.3 2 列表格不强制滚动',
    /<figure class="table-scroll">/.test(narrowPreview) &&
      /<figure class="table-scroll"/.test(narrowExported) &&
      !/table-scroll-wide/.test(narrowExported) &&
      !/min-width:/.test(narrowExported)
  )
}

function testImageMapping(): void {
  const article = extractArticle(SAMPLE_ARTICLE, 'https://example.com/post')
  const hash = 'verify-renderer'
  const pending = renderPreviewHtml(article)
  check('4.3 下载中图片显示加载占位', pending.includes('data:image/svg+xml'))

  const doneRoot = document.createElement('div')
  doneRoot.innerHTML = pending
  updatePreviewImages(
    doneRoot,
    { ...article, images: [{ ...article.images[0]!, status: 'done', localPath: 'abc123.png' }] },
    hash
  )
  check('4.3 成功图片走 fucha://', doneRoot.innerHTML.includes(`fucha://img/${hash}/abc123.png`))
  check(
    '5.3 预览去除与元信息重复的首标题',
    !/<h[12][^>]*>\s*示例文章标题\s*<\/h[12]>/i.test(doneRoot.innerHTML)
  )

  const failedRoot = document.createElement('div')
  failedRoot.innerHTML = pending
  updatePreviewImages(
    failedRoot,
    { ...article, images: [{ ...article.images[0]!, status: 'failed' }] },
    hash
  )
  check(
    '4.3 失败图片降级占位',
    failedRoot.innerHTML.includes('data:image/svg+xml') &&
      !failedRoot.innerHTML.includes('example.com/a.png')
  )
}

/** 6.1 二十链接清单：2026-10-30 逐条复核 expect；站点结构会漂移，重跑前先复验 */
const CHECKLIST: { url: string; kind: string; expect: 'ok' | 'fail' }[] = [
  { url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Document', kind: '文档', expect: 'ok' },
  { url: 'https://nodejs.org/api/fs.html', kind: '文档', expect: 'ok' },
  { url: 'https://cn.vite.dev/guide/why.html', kind: '文档', expect: 'ok' },
  { url: 'https://react.dev/learn/thinking-in-react', kind: '文档', expect: 'ok' },
  {
    url: 'https://docs.github.com/zh/get-started/start-your-journey/hello-world',
    kind: '文档',
    expect: 'ok',
  },
  {
    url: 'https://docs.github.com/zh/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax',
    kind: '文档',
    expect: 'ok',
  },
  { url: 'https://overreacted.io/on-let-vs-const/', kind: '博客', expect: 'ok' },
  { url: 'https://danluu.com/programming-blogs/', kind: '博客', expect: 'ok' },
  {
    url: 'https://www.ruanyifeng.com/blog/2024/01/weekly-issue-285.html',
    kind: '博客',
    expect: 'ok',
  },
  {
    url: 'https://www.joshwcomeau.com/css/interactive-guide-to-flexbox/',
    kind: '博客',
    expect: 'ok',
  },
  { url: 'https://simonwillison.net/2024/Sep/15/', kind: '博客', expect: 'ok' },
  { url: 'https://www.ifanr.com/app/1530197', kind: '科技媒体', expect: 'ok' },
  { url: 'https://mp.weixin.qq.com/s/X-5kbBkedQ5Oct9byUunag', kind: '公众号', expect: 'ok' },
  { url: 'https://mp.weixin.qq.com/s/Xur-QQuUy9itmiHyznR8xg', kind: '公众号', expect: 'ok' },
  { url: 'https://mp.weixin.qq.com/s/QtfAJ-I5KZfWSBmCwEam3A', kind: '公众号', expect: 'ok' },
  { url: 'https://sspai.com/post/92763', kind: '科技媒体（反爬）', expect: 'fail' },
  { url: 'https://zhuanlan.zhihu.com/p/683100237', kind: '社区（反爬）', expect: 'fail' },
  { url: 'https://juejin.cn/post/7355328681385193509', kind: '社区（404）', expect: 'fail' },
  { url: 'https://example.invalid/none', kind: '不可达域名', expect: 'fail' },
  { url: 'https://example.com/404', kind: '404', expect: 'fail' },
]

async function testChecklist(): Promise<void> {
  const rows: string[] = []
  let ok = 0
  for (const item of CHECKLIST) {
    const fetched = await window.fucha.fetchArticle(item.url)
    if (!fetched.ok) {
      rows.push(
        `  ${item.expect === 'fail' ? '·' : 'X'} [${item.kind}] ${fetched.error.kind} — ${item.url}`
      )
      if (item.expect === 'fail') ok += 1
      continue
    }
    try {
      const article: Article = extractArticle(fetched.html, fetched.finalUrl)
      rows.push(
        `  ${item.expect === 'ok' ? '✓' : 'X'} [${item.kind}] ${article.title.slice(0, 30)} (${article.images.length} 图) — ${item.url}`
      )
      if (item.expect === 'ok') ok += 1
    } catch (error) {
      rows.push(
        `  ${item.expect === 'fail' ? '·' : 'X'} [${item.kind}] 提取失败：${(error as Error).message} — ${item.url}`
      )
      if (item.expect === 'fail') ok += 1
    }
  }
  check('6.1 清单符合预期', ok === CHECKLIST.length, `${ok}/${CHECKLIST.length}`)
  results.push('--- 二十链接清单明细 ---', ...rows)
}

async function run(): Promise<void> {
  testSanitize()
  testInlineSvg()
  testSvgHeadingLine()
  testExtract()
  testRspressCodeBlocks()
  testTheme()
  testHighlightAndExport()
  testDomParity()
  testImageMapping()
  if (new URLSearchParams(window.location.search).get('checklist') === '1') await testChecklist()
  ;(window as unknown as { __verifyResults: string[] }).__verifyResults = results
}

void run().catch((error) => {
  results.push(`FAIL 验证入口异常 — ${error instanceof Error ? error.message : String(error)}`)
  ;(window as unknown as { __verifyResults: string[] }).__verifyResults = results
})
