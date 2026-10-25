// 临时验证入口（渲染进程侧）：真 DOM 下验证提取、净化、图片路径映射，并跑二十链接清单。
import type { Article } from '../src/shared/types'
import { extractArticle } from '../src/renderer/src/pipeline/extract'
import { sanitizeHtml } from '../src/renderer/src/pipeline/sanitize'
import { renderPreviewHtml } from '../src/renderer/src/pipeline/images'

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
}

function testImageMapping(): void {
  const article = extractArticle(SAMPLE_ARTICLE, 'https://example.com/post')
  const hash = 'verify-renderer'
  const pending = renderPreviewHtml(article, hash, [])
  check('4.3 下载中图片显示加载占位', pending.includes('data:image/svg+xml'))
  const done = renderPreviewHtml(article, hash, [
    { id: article.images[0]!.id, status: 'done', file: 'abc123.png' },
  ])
  check('4.3 成功图片走 fucha://', done.includes(`fucha://img/${hash}/abc123.png`))

  const failed = renderPreviewHtml(article, hash, [{ id: article.images[0]!.id, status: 'failed' }])
  check(
    '4.3 失败图片降级占位',
    failed.includes('data:image/svg+xml') && !failed.includes('example.com/a.png')
  )
}

/** 6.1 二十链接清单：覆盖博客、文档站、社区与反爬站点；真实公众号链接需外部提供后补入 */
const CHECKLIST: { url: string; kind: string; expect: 'ok' | 'fail' }[] = [
  { url: 'https://zh.wikipedia.org/wiki/浮槎', kind: '百科', expect: 'ok' },
  { url: 'https://en.wikipedia.org/wiki/Raft', kind: '百科', expect: 'ok' },
  { url: 'https://developer.mozilla.org/zh-CN/docs/Web/API/Document', kind: '文档', expect: 'ok' },
  { url: 'https://nodejs.org/api/fs.html', kind: '文档', expect: 'ok' },
  { url: 'https://cn.vite.dev/guide/why.html', kind: '文档', expect: 'ok' },
  { url: 'https://react.dev/learn/thinking-in-react', kind: '文档', expect: 'ok' },
  {
    url: 'https://docs.github.com/zh/get-started/start-your-journey/hello-world',
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
    url: 'https://www.zhangxinxu.com/wordpress/2023/09/css-text-wrap-balance/',
    kind: '博客',
    expect: 'ok',
  },
  { url: 'https://blog.jim-nielsen.com/2024/some-html-attributes/', kind: '博客', expect: 'ok' },
  { url: 'https://jvns.ca/blog/2024/09/10/how-does-a-computer-work/', kind: '博客', expect: 'ok' },
  { url: 'https://simonwillison.net/2024/Sep/15/', kind: '博客', expect: 'ok' },
  { url: 'https://www.bbc.com/zhongwen/simp', kind: '新闻首页', expect: 'fail' },
  { url: 'https://sspai.com/post/92763', kind: '科技媒体', expect: 'ok' },
  { url: 'https://juejin.cn/post/7355328681385193509', kind: '社区（需 JS）', expect: 'fail' },
  { url: 'https://zhuanlan.zhihu.com/p/683100237', kind: '社区（反爬）', expect: 'fail' },
  { url: 'https://example.invalid/none', kind: '不可达域名', expect: 'fail' },
  { url: 'https://httpstat.us/404', kind: '404', expect: 'fail' },
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
  testExtract()
  testImageMapping()
  if (new URLSearchParams(window.location.search).get('checklist') === '1') await testChecklist()
  ;(window as unknown as { __verifyResults: string[] }).__verifyResults = results
}

void run().catch((error) => {
  results.push(`FAIL 验证入口异常 — ${error instanceof Error ? error.message : String(error)}`)
  ;(window as unknown as { __verifyResults: string[] }).__verifyResults = results
})
