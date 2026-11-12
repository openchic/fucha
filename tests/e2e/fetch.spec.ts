import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { PNG, startFixtureServer, type FixtureServer } from './support/server'

const HASH = 'd'.repeat(32)

let server: FixtureServer

test.beforeEach(async () => {
  server = await startFixtureServer()
})

test.afterEach(async () => {
  await server.close()
})

test.describe('抓取分类', () => {
  test('404 归类为目标拒绝并保留状态码', async ({ page }) => {
    const result = await page.evaluate((url) => window.api.fetchArticle(url), `${server.url}/404`)
    expect(result).toMatchObject({
      ok: false,
      error: { kind: 'rejected', status: 404 },
    })
    expect(result.ok === false && result.error.message).toContain('HTTP 404')
  })

  test('非 HTML 内容归类为目标拒绝', async ({ page }) => {
    const result = await page.evaluate(
      (url) => window.api.fetchArticle(url),
      `${server.url}/data.json`
    )
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.error.message).toContain('链接不是网页')
  })

  test('非 http 协议被拒绝', async ({ page }) => {
    const result = await page.evaluate(() => window.api.fetchArticle('ftp://example.com/a'))
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } })
    expect(result.ok === false && result.error.message).toBe('仅支持 http 与 https 链接')
  })

  test('非法链接格式被拒绝', async ({ page }) => {
    const result = await page.evaluate(() => window.api.fetchArticle('not a url'))
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } })
    expect(result.ok === false && result.error.message).toBe('链接格式不正确')
  })

  test('连接被拒归类为网络不可达', async ({ page }) => {
    const result = await page.evaluate(() => window.api.fetchArticle('http://127.0.0.1:1/nothing'))
    expect(result).toMatchObject({ ok: false, error: { kind: 'network' } })
    expect(result.ok === false && result.error.message).toMatch(/网络/)
  })

  test('成功抓取并跟随重定向', async ({ page }) => {
    const result = await page.evaluate(
      (url) => window.api.fetchArticle(url),
      `${server.url}/redirect`
    )
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.finalUrl.endsWith('/article')).toBe(true)
    expect(result.html).toContain('示例文章')
  })
})

test.describe('图片下载', () => {
  test('下载成功落盘并返回文件名', async ({ page, userData }) => {
    const [result] = await page.evaluate(
      ({ hash, url }) =>
        window.api.downloadImages({
          articleHash: hash,
          images: [{ id: 'img-1', originalUrl: `${url}/image.png` }],
        }),
      { hash: HASH, url: server.url }
    )
    expect(result?.status).toBe('done')
    expect(result?.file).toMatch(/\.png$/)
    const info = await stat(join(userData, 'article-cache', HASH, result!.file!))
    expect(info.size).toBeGreaterThan(0)
  })

  test('SVG 保留矢量扩展名', async ({ page, app }) => {
    const [result] = await page.evaluate(
      ({ hash, url }) =>
        window.api.downloadImages({
          articleHash: hash,
          images: [{ id: 'svg', originalUrl: `${url}/image.svg` }],
        }),
      { hash: HASH, url: server.url }
    )
    expect(result?.file?.endsWith('.svg')).toBe(true)

    const type = await app.evaluate(async ({ net }, url) => {
      const response = await net.fetch(url)
      return response.headers.get('content-type')
    }, `app://img/${HASH}/${result?.file}`)
    expect(type).toBe('image/svg+xml')
  })

  test('内容类型缺失时按 URL 识别扩展名', async ({ page }) => {
    const [result] = await page.evaluate(
      ({ hash, url }) =>
        window.api.downloadImages({
          articleHash: hash,
          images: [{ id: 'png', originalUrl: `${url}/image-as.png` }],
        }),
      { hash: HASH, url: server.url }
    )
    expect(result?.file?.endsWith('.png')).toBe(true)
  })

  test('失败图片标记 failed 且不阻断其余图片', async ({ page }) => {
    const results = await page.evaluate(
      ({ hash, url }) =>
        window.api.downloadImages({
          articleHash: hash,
          images: [
            { id: 'ok', originalUrl: `${url}/image.png` },
            { id: 'bad', originalUrl: `${url}/broken.png` },
          ],
        }),
      { hash: HASH, url: server.url }
    )
    expect(results.find((item) => item.id === 'ok')?.status).toBe('done')
    expect(results.find((item) => item.id === 'bad')?.status).toBe('failed')
  })

  test('二次下载复用缓存且不重复请求', async ({ page }) => {
    const download = () =>
      page.evaluate(
        ({ hash, url }) =>
          window.api.downloadImages({
            articleHash: hash,
            images: [{ id: 'img-1', originalUrl: `${url}/image.png` }],
          }),
        { hash: HASH, url: server.url }
      )
    const [first] = await download()
    const [second] = await download()
    expect(second?.file).toBe(first?.file)
    expect(server.hits.get('/image.png')).toBe(1)
  })
})

test.describe('app:// 图片协议', () => {
  test('可取回缓存图片并带图片类型', async ({ page, app }) => {
    const [result] = await page.evaluate(
      ({ hash, url }) =>
        window.api.downloadImages({
          articleHash: hash,
          images: [{ id: 'img-1', originalUrl: `${url}/image.png` }],
        }),
      { hash: HASH, url: server.url }
    )

    const response = await app.evaluate(async ({ net }, url) => {
      const res = await net.fetch(url)
      return {
        status: res.status,
        type: res.headers.get('content-type'),
        size: (await res.arrayBuffer()).byteLength,
      }
    }, `app://img/${HASH}/${result!.file!}`)

    expect(response.status).toBe(200)
    expect(response.type).toMatch(/^image\//)
    expect(response.size).toBeGreaterThan(0)

    const width = await page.evaluate(
      (url) =>
        new Promise<number>((resolve) => {
          const image = new Image()
          image.onload = () => resolve(image.naturalWidth)
          image.onerror = () => resolve(0)
          image.src = url
        }),
      `app://img/${HASH}/${result!.file!}`
    )
    expect(width).toBe(1)
  })

  test('拒绝路径穿越', async ({ page }) => {
    const loaded = await page.evaluate(
      (url) =>
        new Promise<boolean>((resolve) => {
          const image = new Image()
          image.onload = () => resolve(true)
          image.onerror = () => resolve(false)
          image.src = url
        }),
      'app://img/%2e%2e%2f%2e%2e%2fapp.db'
    )
    expect(loaded).toBe(false)
  })
})

test.describe('导出与剪贴板', () => {
  test('已下载图片内联，缺失与超限图片降级占位', async ({ page }) => {
    const { files } = await page.evaluate(
      ({ hash, url }) =>
        window.api
          .downloadImages({
            articleHash: hash,
            images: [
              { id: 'normal', originalUrl: `${url}/image.png` },
              { id: 'huge', originalUrl: `${url}/huge.png` },
            ],
          })
          .then((list) => ({
            files: {
              normal: list.find((item) => item.id === 'normal')?.file,
              huge: list.find((item) => item.id === 'huge')?.file,
            },
          })),
      { hash: HASH, url: server.url }
    )
    expect(files.normal).toBeTruthy()
    expect(files.huge).toBeTruthy()

    const html = [
      `<img src="${server.url}/image.png">`,
      `<img src="${server.url}/missing.png">`,
      `<img src="${server.url}/huge.png">`,
      '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw=">',
    ].join('')

    const exported = await page.evaluate(
      ({ hash, html }) => window.api.exportHtml({ articleHash: hash, html }),
      { hash: HASH, html }
    )

    expect(exported).toContain(`data:image/png;base64,${PNG.toString('base64')}`)
    expect(exported).not.toContain(`${server.url}/missing.png`)
    expect(exported).toContain('data:image/gif;base64,R0lGODlhAQABAAAAACw=')
    expect(exported.match(/src="data:image\/png/g)?.length).toBe(3)
  })

  test('写剪贴板时同时提供 HTML 与纯文本', async ({ page, app }) => {
    await page.evaluate(() =>
      window.api.copyHtml({ html: '<p><strong>加粗</strong></p>', text: '加粗' })
    )
    const clipboard = await app.evaluate(({ clipboard }) => ({
      html: clipboard.readHTML(),
      text: clipboard.readText(),
    }))
    expect(clipboard.html).toContain('加粗')
    expect(clipboard.text).toBe('加粗')
  })
})
