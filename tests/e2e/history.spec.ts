import { stat } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from './fixtures'
import { startFixtureServer, type FixtureServer } from './support/server'

const HASH = 'e'.repeat(32)
let server: FixtureServer

test.beforeEach(async () => {
  server = await startFixtureServer()
})

test.afterEach(async () => {
  await server.close()
})

test('删除历史文章不会清理图片缓存目录', async ({ page, userData }) => {
  const [image] = await page.evaluate(
    ({ hash, url }) =>
      window.api.downloadImages({
        articleHash: hash,
        images: [{ id: 'img-1', originalUrl: `${url}/image.png` }],
      }),
    { hash: HASH, url: server.url }
  )
  expect(image?.status).toBe('done')

  const cacheFile = join(userData, 'article-cache', HASH, image!.file!)
  expect((await stat(cacheFile)).size).toBeGreaterThan(0)

  await page.evaluate(
    ({ hash, url }) =>
      window.api.saveArticle({
        hash,
        finalUrl: `${url}/article`,
        article: {
          title: '待删除文章',
          sourceUrl: `${url}/article`,
          html: '<p>正文</p>',
          images: [],
        },
        images: [{ id: 'img-1', originalUrl: `${url}/image.png`, status: 'done' }],
      }),
    { hash: HASH, url: server.url }
  )

  expect(await page.evaluate((hash) => window.api.deleteArticle(hash), HASH)).toBe(true)
  expect(await page.evaluate((hash) => window.api.getArticle(hash), HASH)).toBeNull()
  expect((await stat(cacheFile)).size).toBeGreaterThan(0)
})
