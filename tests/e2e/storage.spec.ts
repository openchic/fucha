import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { _electron as electron, expect, test } from '@playwright/test'
import { startFixtureServer } from './support/server'

test('数据库损坏时降级，但抓取与预览仍可用', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'fucha-e2e-'))
  await writeFile(join(userData, 'app.db'), 'not a sqlite database')
  const server = await startFixtureServer()
  const app = await electron.launch({
    args: ['.', `--user-data-dir=${userData}`, '--hidden-window'],
    env: { ...process.env, OPEN_DEVTOOLS: '0' },
  })

  try {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    await expect(page.getByRole('textbox', { name: '文章链接' })).toBeVisible()

    const result = await page.evaluate(
      (url) => window.api.fetchArticle(url),
      `${server.url}/article`
    )
    expect(result.ok).toBe(true)

    await expect(page.evaluate(() => window.api.listArticles())).rejects.toThrow('本地数据库不可用')
  } finally {
    await app.close()
    await server.close()
    await rm(userData, { recursive: true, force: true })
  }
})
