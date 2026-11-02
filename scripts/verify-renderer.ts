// 临时验证入口（渲染进程侧）：真 DOM 下验证提取、净化、图片路径映射、主题 CSS 与导出管道。
import type { Article } from '../src/shared/types'
import { extractArticle } from '../src/renderer/src/pipeline/extract'
import { sanitizeHtml } from '../src/renderer/src/pipeline/sanitize'
import { preserveSvgHeadings } from '../src/renderer/src/pipeline/svg'
import { renderPreviewHtml, updatePreviewImages } from '../src/renderer/src/pipeline/images'
import { buildExportHtml, exportHtmlToText } from '../src/renderer/src/pipeline/export'
import { exportRootStyle, buildExportCss, buildPreviewCss } from '../src/renderer/src/theme/apply'
import { highlightArticleHtml, highlightThemeCss } from '../src/renderer/src/theme/highlight'
import { BUILTIN_THEMES, DEFAULT_THEME } from '../src/renderer/src/theme/presets'
import { validateThemeToken } from '../src/renderer/src/theme/tokens'
import { BUILTIN_THEME_NAMES, headingColor } from '../src/shared/theme'
import { resolveThemeVariables, scopeCss, validateThemeCss } from '../src/shared/theme-css'

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
    clean.includes('opacity') && !/background/i.test(clean)
  )
  check('3.4 移除源码 style 与 class', !/<style/i.test(clean) && !/class="diagram-bg"/.test(clean))
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
  check(
    '3.4 内部样式已内联到图形',
    /fill:\s*url\([^)]*flowGradient[^)]*\)/i.test(article.html) &&
      /style="[^"]*opacity:\s*0\.9/i.test(article.html)
  )
  check('3.4 页面级样式同样内联', article.html.includes('fill: rgb(74, 111, 243)'))
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
  check('3.4 预览保留内联颜色', /fill:\s*url\([^)]*flowGradient[^)]*\)/i.test(preview))
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

function testTheme(): void {
  const validated = validateThemeToken(DEFAULT_THEME.token)
  check('1.1 内置预设通过校验', validated.id === 'default' && validated.name === '清简')
  check('1.1 默认主题主色跟随应用主色', validated.primary === '#5e7b6f')
  check(
    '1.1 内置主题名称与共享名称一致',
    BUILTIN_THEMES.every(
      (theme) =>
        BUILTIN_THEME_NAMES[theme.token.id as keyof typeof BUILTIN_THEME_NAMES] === theme.token.name
    )
  )
  check(
    '1.1 标题六级直接挂在 token 顶层',
    ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].every((key) => key in validated)
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
    '1.1 标题颜色缺省回退正文色',
    headingColor(DEFAULT_THEME.token, 'h2') === DEFAULT_THEME.token.text.color
  )

  const fallbackExport = buildExportCss({
    token: {
      ...DEFAULT_THEME.token,
      h2: { ...DEFAULT_THEME.token.h2, color: undefined },
    },
    css: '',
  })
  const h2Rule = /h2 \{([\s\S]*?)\}/.exec(fallbackExport)?.[1] ?? ''
  check('1.1 h2 颜色回退到正文色', h2Rule.includes('color: #333333'))

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

  const serif = BUILTIN_THEMES.find((theme) => theme.token.id === 'serif')!
  const serifPreview = buildPreviewCss(serif)
  check(
    '1.1 第二套内置主题带入自己的 theme.css',
    serifPreview.includes('Songti SC') && serifPreview.includes('.article-body h1')
  )
  check(
    '1.1 内置主题 token 全部通过校验',
    BUILTIN_THEMES.every((theme) => validateThemeToken(theme.token).id === theme.token.id)
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
  check('1.1 合法主题 CSS 通过', validateThemeCss(serif.css) === serif.css)

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
    'overflowX',
    'whiteSpace',
    'listStyleType',
    'borderCollapse',
    'textDecorationLine',
    'verticalAlign',
  ]

  const sample = `<p>正文 <strong>强调</strong> <em>斜体</em> <a href="#">链接</a></p><h1>一级</h1><h2>二级</h2><h3>三级</h3><h4>四级</h4><h5>五级</h5><h6>六级</h6><ul><li>列表</li></ul><ol><li>有序</li></ol><blockquote><p>引用</p></blockquote><pre><code>const a = 1</code></pre><table><thead><tr><th>表头</th></tr></thead><tbody><tr><td>值</td></tr></tbody></table><figure><img src="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=" alt="图"><figcaption>图注</figcaption></figure><hr>`

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
    'th',
    'td',
    'img',
    'figcaption',
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
  check('3.1 高亮样式已内联', /hljs-keyword/.test(html))
  check(
    '3.3 导出不附加来源行',
    !html.includes('原文：https://example.com/post') && !html.includes('作者：示例作者')
  )
  check('3.3 纯文本兜底不含来源行', !exportHtmlToText(html).includes('原文：'))
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
