import { realpath } from 'node:fs/promises'
import { test, expect } from './fixtures'

test.describe('应用启动', () => {
  test('窗口打开且 preload API 完整', async ({ page, app }) => {
    await expect(page.locator('body')).toBeVisible()

    const methods = await page.evaluate(() => Object.keys(window.api).sort())
    expect(methods).toEqual(
      [
        'copyHtml',
        'createTheme',
        'deleteArticle',
        'deleteTheme',
        'downloadImages',
        'exportHtml',
        'exportThemePackage',
        'fetchArticle',
        'getArticle',
        'getPreference',
        'importThemePackage',
        'listArticles',
        'listThemes',
        'replaceArticleImages',
        'saveArticle',
        'setArticleTheme',
        'setPreference',
        'touchArticle',
        'updateTheme',
      ].sort()
    )

    const platform = await app.evaluate(() => process.platform)
    expect(['darwin', 'linux', 'win32']).toContain(platform)
  })

  test('渲染进程处于沙箱隔离状态', async ({ page }) => {
    expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
      'undefined'
    )
  })

  test('窗口尺寸被工作区钳制', async ({ app, page }) => {
    await page.getByRole('textbox', { name: '文章链接' }).waitFor()
    const { size, area } = await app.evaluate(({ BrowserWindow, screen }) => ({
      size: BrowserWindow.getAllWindows()[0]?.getSize(),
      area: screen.getPrimaryDisplay().workAreaSize,
    }))
    expect(size).toEqual([Math.min(1200, area.width), Math.min(800, area.height)])
  })

  test('用户数据目录被测试参数隔离', async ({ app, userData }) => {
    const resolved = await app.evaluate(({ app: electronApp }) => electronApp.getPath('userData'))
    expect(resolved).toBe(await realpath(userData))
  })

  test('启动不产生控制台错误', async ({ page, consoleErrors }) => {
    await expect(page.getByRole('textbox', { name: '文章链接' })).toBeVisible()
    await page.waitForTimeout(300)
    expect(consoleErrors).toEqual([])
  })
})
