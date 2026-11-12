import { expect, test } from './fixtures'
import { startFixtureServer } from './support/server'

test('从输入链接到复制导出的黄金路径', async ({ page, app }) => {
  const server = await startFixtureServer()
  try {
    await page.getByRole('textbox', { name: '文章链接' }).fill(`${server.url}/article`)
    await page.getByRole('button', { name: /生成预览/ }).click()

    await expect(page.getByRole('heading', { name: '示例文章' })).toBeVisible()
    await expect(page.getByRole('button', { name: '复制' })).toBeVisible()

    await page.getByRole('button', { name: '复制' }).click()
    await expect(page.getByText('已复制到剪贴板')).toBeVisible()

    const clipboard = await app.evaluate(({ clipboard }) => ({
      html: clipboard.readHTML(),
      text: clipboard.readText(),
    }))
    expect(clipboard.html).toContain('正文内容')
    expect(clipboard.text).toContain('正文内容')

    await expect
      .poll(() => page.evaluate(() => window.api.listArticles().then((items) => items.length)))
      .toBe(1)
    await expect(page.getByRole('button', { name: '示例文章' })).toBeVisible()
  } finally {
    await server.close()
  }
})
