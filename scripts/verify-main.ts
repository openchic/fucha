// 临时验证入口（主进程侧）：真跑 Electron 运行时，验证抓取分类、图片下载与 fucha:// 协议。
import { promises as fs } from 'fs'
import { createServer } from 'http'
import { join } from 'path'
import { app, net } from 'electron'
import {
  articleCacheDir,
  downloadImages,
  fetchArticle,
  registerFuchaProtocol,
  serveFuchaProtocol,
} from '../src/main/ipc'
import { looksLikeCaptcha, matchProfile } from '../src/shared/profiles'

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
  const articleHash = 'verify-harness'
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
