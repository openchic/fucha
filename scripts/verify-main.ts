// 临时验证入口（主进程侧）：真跑 Electron 运行时，验证抓取分类、图片下载与 fucha:// 协议。
import type { Article, ThemeToken } from '../src/shared/types'
import type { StoredImageInput } from '../src/shared/store-types'
import { promises as fs } from 'fs'
import { createServer } from 'http'
import { DatabaseSync } from 'node:sqlite'
import { join } from 'path'
import { app, clipboard, net } from 'electron'
import {
  articleCacheDir,
  copyHtml,
  downloadImages,
  exportHtml,
  fetchArticle,
  registerFuchaProtocol,
  serveFuchaProtocol,
} from '../src/main/ipc'
import { closeLocalStore, getDb, getLocalStoreStatus, initLocalStore } from '../src/main/db'
import {
  clearHistory,
  createTheme,
  deleteArticle,
  deleteTheme,
  getArticle,
  getPreference,
  getTheme,
  listArticles,
  listThemes,
  replaceArticleImages,
  setArticleTheme,
  setPreference,
  touchArticle,
  updateTheme,
  upsertArticle,
} from '../src/main/store'
import { buildThemePackage, parseThemePackage } from '../src/main/theme-package'
import { createZip, readZip } from '../src/main/zip'
import defaultTheme from '../src/renderer/src/theme/presets/default.json'
import { looksLikeCaptcha, matchProfile } from '../src/shared/profiles'
import { validateThemeToken } from '../src/shared/theme'

registerFuchaProtocol()

const results: string[] = []
function check(name: string, pass: boolean, detail = ''): void {
  results.push(`${pass ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
}

async function main(): Promise<void> {
  serveFuchaProtocol()

  let imageRequests = 0
  const server = createServer((request, response) => {
    if (request.url === '/404') {
      response.writeHead(404).end('not found')
    } else if (request.url === '/article') {
      response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      response.end('<html><body><article><p>本地文章</p></article></body></html>')
    } else if (request.url === '/image.png') {
      imageRequests += 1
      response.writeHead(200, { 'content-type': 'image/png' })
      response.end(
        Buffer.from(
          'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
          'base64'
        )
      )
    } else if (request.url === '/image.svg') {
      imageRequests += 1
      response.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8' })
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><rect width="16" height="16" fill="#8fae96"/></svg>'
      )
    } else if (request.url?.startsWith('/fallback.svg')) {
      imageRequests += 1
      response.writeHead(200, { 'content-type': 'text/plain' })
      response.end(
        '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16"><circle cx="8" cy="8" r="8" fill="#8fae96"/></svg>'
      )
    } else {
      response.writeHead(404).end('not found')
    }
  })
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('本地验证服务器启动失败')
  const base = `http://127.0.0.1:${address.port}`

  // 2.1 错误分类
  const notFound = await fetchArticle(`${base}/404`)
  check(
    '2.1 目标拒绝分类',
    !notFound.ok && notFound.error.kind === 'rejected',
    notFound.ok ? 'unexpected ok' : `${notFound.error.kind} / ${notFound.error.message}`
  )

  const unreachable = await fetchArticle('https://this-host-does-not-exist-fucha.invalid/a')
  check(
    '2.1 网络不可达分类',
    !unreachable.ok && unreachable.error.kind === 'network',
    unreachable.ok ? 'unexpected ok' : unreachable.error.kind
  )

  const badProtocol = await fetchArticle('ftp://example.com/a')
  check('2.1 非 http 协议拒绝', !badProtocol.ok && badProtocol.error.kind === 'network')

  // 2.2 站点适配表
  const wechatProfile = matchProfile('https://mp.weixin.qq.com/s/abc')
  check(
    '2.2 微信适配命中',
    wechatProfile?.imageSourceAttr === 'data-src' && !!wechatProfile.imageHeaders?.Referer
  )
  check('2.2 非微信站点不套用', matchProfile('https://example.com/post') === undefined)
  check(
    '2.2 微信正文容器解除隐藏',
    wechatProfile?.revealSelectors?.includes('#js_content') === true
  )
  check(
    '2.2 微信图片域名带 Referer',
    matchProfile('https://mmbiz.qpic.cn/sz_mmbiz_png/a/640')?.imageHeaders?.Referer ===
      'https://mp.weixin.qq.com/'
  )

  // 2.3 验证码特征
  check(
    '2.3 验证码特征命中',
    looksLikeCaptcha(
      '<div>当前环境异常，完成验证后即可继续访问</div>',
      'https://mp.weixin.qq.com/s/x'
    )
  )
  check(
    '2.3 正常文章不误伤',
    !looksLikeCaptcha('<article><p>正常正文内容</p></article>', 'https://mp.weixin.qq.com/s/x')
  )

  // 2.1 + 3.1 页面抓取
  const real = await fetchArticle(`${base}/article`)
  check(
    '2.1 真实页面抓取',
    real.ok,
    real.ok ? `${real.html.length} 字节` : `${real.error.kind} / ${real.error.message}`
  )

  // 4.1 / 4.2 图片下载与复用
  const articleHash = '0123456789abcdef0123456789abcdef'
  const dir = join(articleCacheDir(), articleHash)
  await fs.rm(dir, { recursive: true, force: true })
  const images = [
    { id: 'ok-1', originalUrl: `${base}/image.png` },
    { id: 'svg-1', originalUrl: `${base}/image.svg` },
    { id: 'svg-fallback', originalUrl: `${base}/fallback.svg?from=url` },
    { id: 'bad-1', originalUrl: `${base}/missing.png` },
  ]
  const first = await downloadImages({ articleHash, images })
  const okDone = first.find((r) => r.id === 'ok-1')
  const svgDone = first.find((r) => r.id === 'svg-1')
  const svgFallback = first.find((r) => r.id === 'svg-fallback')
  const badFailed = first.find((r) => r.id === 'bad-1')
  check('4.1 有效图片 done 且落盘', okDone?.status === 'done' && !!okDone.file, okDone?.file)
  check('4.4 SVG 保留矢量扩展名', svgDone?.file?.endsWith('.svg') === true, svgDone?.file)
  check(
    '4.4 类型缺失时按 URL 识别 SVG',
    svgFallback?.file?.endsWith('.svg') === true,
    svgFallback?.file
  )
  check('4.1 失效图片 failed 不阻断', badFailed?.status === 'failed')

  const second = await downloadImages({ articleHash, images: [images[0]] })
  check(
    '4.2 二次提交复用缓存且无重复请求',
    second[0]?.status === 'done' && second[0].file === okDone?.file && imageRequests === 3,
    `${imageRequests} 次图片请求`
  )

  // 3.2 导出图片内联：成功、缺失与超限
  const largeName = 'ffffffffffffffffffffffffffffffffffffffff.bin'
  await fs.writeFile(join(dir, largeName), Buffer.alloc(5 * 1024 * 1024 + 1))
  const indexFile = join(dir, 'index.json')
  const index = JSON.parse(await fs.readFile(indexFile, 'utf-8')) as Record<string, string>
  index['http://example.com/large.png'] = largeName
  await fs.writeFile(indexFile, JSON.stringify(index, null, 2))
  const exported = await exportHtml({
    articleHash,
    html: `<p>导出</p><img src="${images[0]!.originalUrl}" alt="成功"><img src="http://127.0.0.1:${address.port}/missing.png" alt="缺失"><img src="http://example.com/large.png" alt="超限"><img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==" alt="data-uri">`,
  })
  const dataUris = exported.match(/data:image\/[a-z+]+;base64,[^"]+/g) ?? []
  const embeddedImages = dataUris.filter(
    (uri) => uri.startsWith('data:image/png') && !uri.includes('iVBORw0KGgoAAAANSUhEUgAAAoAAAA')
  )
  check('3.2 已下载图片转 base64', embeddedImages.length === 1, `${embeddedImages.length} 张内联`)
  const placeholders = (exported.match(/iVBORw0KGgoAAAANSUhEUgAAAoAAAA/g) ?? []).length
  check('3.2 缺失与超限图片降级占位', placeholders === 2, `${placeholders} 张占位`)
  check('3.2 非缓存地址不内联原地址', !exported.includes('http://example.com/large.png'))
  check('3.2 已是 data URI 的图片保持原样', exported.includes('data:image/gif;base64,R0lGOD'))

  // 3.4 剪贴板写 HTML 与纯文本
  copyHtml({ html: '<p style="color: #333;">剪贴板</p>', text: '剪贴板' })
  check(
    '3.4 剪贴板写入 HTML 与文本',
    clipboard.readText() === '剪贴板' && clipboard.readHTML().includes('剪贴板')
  )

  // 1.5 fucha:// 协议服务本地图片
  if (okDone?.file) {
    const url = `fucha://img/${articleHash}/${okDone.file}`
    const res = await net.fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    check('1.5 fucha:// 协议可取图', res.ok && buf.length > 0, `${res.status} ${buf.length} 字节`)
    check('1.5 内容类型为图片', (res.headers.get('content-type') ?? '').startsWith('image/'))
  }
  if (svgDone?.file) {
    const svgResponse = await net.fetch(`fucha://img/${articleHash}/${svgDone.file}`)
    check(
      '4.4 SVG 以矢量内容类型返回',
      svgResponse.headers.get('content-type') === 'image/svg+xml',
      svgResponse.headers.get('content-type') ?? ''
    )
  }
  const traversal = await net.fetch(`fucha://img/${articleHash}/../../package.json`)
  check(
    '1.5 路径穿越被拒',
    traversal.status === 403 || traversal.status === 404,
    String(traversal.status)
  )

  // ---------- local-store ----------
  const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms))
  const throws = (fn: () => void): boolean => {
    try {
      fn()
      return false
    } catch {
      return true
    }
  }

  const storeDir = await fs.mkdtemp(join(app.getPath('temp'), 'fucha-store-'))
  const storePath = join(storeDir, 'fucha.db')
  const storeStatus = initLocalStore(storePath)
  check('1.1 首次初始化数据库', storeStatus.available && getLocalStoreStatus().available)
  check(
    '1.1 数据库文件已生成',
    await fs
      .stat(storePath)
      .then(() => true)
      .catch(() => false)
  )
  const versionRow = getDb().prepare('PRAGMA user_version').get() as { user_version: number }
  check('1.2 迁移到最新 schema', versionRow.user_version === 5, String(versionRow.user_version))
  const articleIndexes = getDb().prepare("PRAGMA index_list('articles')").all() as {
    name: string
  }[]
  check(
    '1.2 历史排序索引已切换',
    articleIndexes.some((item) => item.name === 'articles_updated_idx') &&
      !articleIndexes.some((item) => item.name === 'articles_activity_idx')
  )

  setPreference('theme.active', 'default')
  const reopened = initLocalStore(storePath)
  check('1.2 重复初始化保留数据', reopened.available && getPreference('theme.active') === 'default')

  const higherPath = join(storeDir, 'higher.db')
  const higher = new DatabaseSync(higherPath)
  higher.exec('PRAGMA user_version = 6')
  higher.close()
  check('1.1 版本高于代码时降级', initLocalStore(higherPath).available === false)
  initLocalStore(storePath)

  check('2.2 缺失偏好返回 undefined', getPreference('missing.key') === undefined)
  setPreference('theme.active', 'custom')
  const prefRow = getDb()
    .prepare('SELECT COUNT(*) AS count FROM preferences WHERE key = ?')
    .get('theme.active') as { count: number }
  check('2.2 重复写入只保留一条', prefRow.count === 1 && getPreference('theme.active') === 'custom')

  const customTheme = validateThemeToken({
    ...defaultTheme,
    id: 'custom-test',
    name: '自定义主题',
    builtin: false,
  })
  const customCss = 'h2 {\n  letter-spacing: 0.05em;\n}'
  const createdTheme = createTheme({
    token: customTheme,
    css: customCss,
    sourceThemeId: 'default',
  })
  check(
    '2.3 保存自定义主题',
    listThemes().some((theme) => theme.id === 'custom-test') &&
      createdTheme.sourceThemeId === 'default'
  )
  check(
    '2.3 读取 theme.css 与 token 版本',
    getTheme('custom-test')?.css === customCss && getTheme('custom-test')?.tokenVersion === 1
  )
  check(
    '2.3 同一 id 不能覆盖快照',
    throws(() => createTheme({ token: customTheme, css: '' }))
  )
  const updatedTheme = updateTheme({
    id: 'custom-test',
    token: { ...customTheme, name: '更新后的主题', text: { ...customTheme.text, fontSize: 17 } },
    css: 'h2 {\n  letter-spacing: 0.1em;\n}',
  })
  check(
    '2.3 原地更新主题内容',
    updatedTheme.id === 'custom-test' &&
      updatedTheme.name === '更新后的主题' &&
      updatedTheme.token.text.fontSize === 17 &&
      updatedTheme.css.includes('0.1em')
  )
  check(
    '2.3 更新内置主题被拒',
    throws(() =>
      updateTheme({
        id: 'default',
        token: { ...customTheme, id: 'default', builtin: true },
        css: '',
      })
    )
  )
  check(
    '2.3 更新不存在的主题被拒',
    throws(() =>
      updateTheme({ id: 'missing-theme', token: { ...customTheme, id: 'missing-theme' }, css: '' })
    )
  )
  check(
    '2.3 非法主题被拒',
    throws(() =>
      createTheme({
        token: validateThemeToken({
          ...customTheme,
          id: 'bad-token',
          text: { ...customTheme.text, fontSize: 10 },
        }),
        css: '',
      })
    )
  )
  check(
    '2.3 非法主题 CSS 被拒',
    throws(() =>
      createTheme({ token: { ...customTheme, id: 'bad-css' }, css: 'h1 { position: fixed; }' })
    )
  )
  check(
    '2.3 内置主题 id 不能被自定义主题占用',
    throws(() => createTheme({ token: { ...customTheme, id: 'default' }, css: '' }))
  )

  const tempTheme = createTheme({
    token: { ...customTheme, id: 'temp-theme', name: '临时主题' },
    css: '',
  })
  check('2.3 可删除未被引用的主题', tempTheme.id === 'temp-theme')
  check(
    '2.3 主题名称不能重复',
    throws(() =>
      createTheme({ token: { ...customTheme, id: 'duplicate-name', name: '临时主题' }, css: '' })
    )
  )
  check(
    '2.3 自定义主题不能与内置主题重名',
    throws(() =>
      createTheme({ token: { ...customTheme, id: 'builtin-name', name: '清简' }, css: '' })
    )
  )
  check(
    '2.3 改名不能与其他主题重名',
    throws(() =>
      updateTheme({ id: 'custom-test', token: { ...customTheme, name: '临时主题' }, css: '' })
    )
  )
  deleteTheme('temp-theme')
  check('2.3 删除自定义主题', !listThemes().some((theme) => theme.id === 'temp-theme'))

  const hash1 = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
  const hash2 = 'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb'
  const imageSet: StoredImageInput[] = [
    {
      id: 'img-1',
      originalUrl: 'https://example.com/a.png',
      status: 'done',
      width: 640,
      height: 360,
    },
    { id: 'img-2', originalUrl: 'https://example.com/b.png', status: 'pending' },
  ]
  const snapshotArticle: Article = {
    title: '快照文章',
    author: '作者',
    sourceUrl: 'https://example.com/a',
    html: '<p>快照正文</p>',
    images: [],
  }
  upsertArticle({
    hash: hash1,
    finalUrl: 'https://example.com/a',
    article: snapshotArticle,
    images: imageSet,
  })
  check(
    '2.4 保存文章快照',
    getArticle(hash1)?.html === '<p>快照正文</p>' && getArticle(hash1)?.images.length === 2
  )
  check('2.4 默认主题写入文章', getArticle(hash1)?.themeId === 'default')
  await wait(5)
  upsertArticle({
    hash: hash2,
    finalUrl: 'https://example.com/b',
    article: { ...snapshotArticle, title: '第二篇', sourceUrl: 'https://example.com/b' },
    images: [],
    themeId: 'custom-test',
  })
  check('2.4 文章级主题写入', getArticle(hash2)?.themeId === 'custom-test')
  check('2.4 新建文章排到顶部', listArticles()[0]?.hash === hash2)

  await wait(5)
  upsertArticle({
    hash: hash1,
    finalUrl: 'https://example.com/a',
    article: { ...snapshotArticle, html: '<p>更新后的正文</p>' },
    images: imageSet,
    themeId: 'other-theme',
  })
  check('2.4 重新提取保留文章主题', getArticle(hash1)?.themeId === 'default')
  check(
    '2.4 文章主题跟随 id 更新',
    setArticleTheme(hash1, 'custom-test') && getArticle(hash1)?.themeId === 'custom-test'
  )
  check(
    '2.4 历史摘要携带主题',
    listArticles().find((item) => item.hash === hash2)?.themeId === 'custom-test'
  )
  check(
    '2.3 被文章引用的主题不能删除',
    throws(() => deleteTheme('custom-test'))
  )

  await wait(5)
  upsertArticle({
    hash: hash1,
    finalUrl: 'https://example.com/a',
    article: { ...snapshotArticle, html: '<p>更新后的正文</p>' },
    images: imageSet,
  })
  check('2.4 重新提取回到顶部', listArticles()[0]?.hash === hash1 && listArticles().length === 2)
  await wait(5)
  check('2.4 touch 不改变历史排序', touchArticle(hash2) && listArticles()[0]?.hash === hash1)
  check('2.4 访问次数递增', getArticle(hash2)?.visitCount === 1)

  const beforeReplace = getArticle(hash1)!
  await wait(5)
  replaceArticleImages(hash1, [imageSet[0]!])
  const afterReplace = getArticle(hash1)!
  check(
    '2.5 图片集合整体替换',
    afterReplace.images.length === 1 && afterReplace.images[0]?.id === 'img-1'
  )
  check('2.5 图片更新不改文章字段', afterReplace.updatedAt === beforeReplace.updatedAt)
  check(
    '2.5 非法图片状态被拒',
    throws(() =>
      replaceArticleImages(hash1, [
        { id: 'bad', originalUrl: 'https://example.com/bad.png', status: 'invalid' } as never,
      ])
    )
  )

  const cacheDir = join(articleCacheDir(), hash1)
  await fs.mkdir(cacheDir, { recursive: true })
  check('2.6 删除文章行', deleteArticle(hash1) && getArticle(hash1) === undefined)
  check(
    '2.6 缓存目录不在删除范围',
    await fs
      .stat(cacheDir)
      .then(() => true)
      .catch(() => false)
  )
  await fs.rm(cacheDir, { recursive: true, force: true })
  clearHistory()
  check('2.6 清空历史', listArticles().length === 0)

  deleteTheme('custom-test')
  check('2.3 无引用后可删除主题', !listThemes().some((theme) => theme.id === 'custom-test'))

  const zip = createZip([
    { name: 'theme.json', data: Buffer.from('{"a":1}', 'utf8') },
    { name: 'theme.css', data: Buffer.from('h1 { color: #000; }', 'utf8') },
  ])
  const zipEntries = readZip(zip)
  check(
    '2.8 主题包 zip 往返',
    zipEntries.get('theme.json')?.toString('utf8') === '{"a":1}' &&
      zipEntries.get('theme.css')?.toString('utf8') === 'h1 { color: #000; }'
  )
  check(
    '2.8 主题包拒绝路径穿越',
    throws(() => readZip(createZip([{ name: '../evil', data: Buffer.from('x') }])))
  )
  const tampered = Buffer.from(zip)
  const dataIndex = tampered.indexOf(Buffer.from('{"a":1}'))
  tampered[dataIndex] ^= 0xff
  check(
    '2.8 主题包校验损坏数据',
    throws(() => readZip(tampered))
  )

  const packageBuffer = buildThemePackage({ token: customTheme, css: customCss })
  const parsedPackage = parseThemePackage(packageBuffer)
  check(
    '2.8 主题包往返保持一致',
    parsedPackage.token.id === 'custom-test' &&
      parsedPackage.css === customCss &&
      parsedPackage.tokenVersion === 1 &&
      parsedPackage.token.builtin === false
  )
  const builtinPackage = parseThemePackage(
    buildThemePackage({ token: defaultTheme as unknown as ThemeToken, css: '' })
  )
  check('2.8 内置主题导出后变为自定义主题', builtinPackage.token.builtin === false)

  const packageParts = readZip(packageBuffer)
  check(
    '2.8 主题包拒绝多余文件',
    throws(() =>
      parseThemePackage(
        createZip([
          ...[...packageParts].map(([name, data]) => ({ name, data })),
          { name: 'notes.txt', data: Buffer.from('x') },
        ])
      )
    )
  )
  check(
    '2.8 主题包缺少 theme.css 被拒',
    throws(() =>
      parseThemePackage(createZip([{ name: 'theme.json', data: packageParts.get('theme.json')! }]))
    )
  )
  check(
    '2.8 主题包拒绝内置主题 token',
    throws(() =>
      parseThemePackage(
        createZip([
          {
            name: 'theme.json',
            data: Buffer.from(
              JSON.stringify({
                id: 'pkg-builtin',
                name: 'pkg-builtin',
                version: '1.0.0',
                tokenVersion: 1,
                token: { ...defaultTheme, id: 'pkg-builtin', name: 'pkg-builtin', builtin: true },
              })
            ),
          },
          { name: 'theme.css', data: Buffer.from('') },
        ])
      )
    )
  )
  check(
    '2.8 主题包非法 JSON 被拒',
    throws(() =>
      parseThemePackage(
        createZip([
          { name: 'theme.json', data: Buffer.from('{}') },
          { name: 'theme.css', data: Buffer.from('') },
        ])
      )
    )
  )

  const corruptPath = join(storeDir, 'corrupt.db')
  await fs.writeFile(corruptPath, 'not a sqlite database')
  check('1.3 损坏数据库降级', initLocalStore(corruptPath).available === false)
  check('1.3 存储失败不阻断抓取', (await fetchArticle(`${base}/article`)).ok)
  initLocalStore(storePath)

  closeLocalStore()
  await fs.rm(storeDir, { recursive: true, force: true })

  await fs.rm(dir, { recursive: true, force: true })
  console.log('\n===== 主进程验证结果 =====')
  for (const line of results) console.log(line)
  const failed = results.filter((r) => r.startsWith('FAIL')).length
  console.log(`合计 ${results.length} 项，失败 ${failed} 项`)
  server.close()
  app.exit(failed === 0 ? 0 : 1)
}

app.whenReady().then(() =>
  main().catch((error) => {
    console.error('harness error', error)
    app.exit(1)
  })
)
