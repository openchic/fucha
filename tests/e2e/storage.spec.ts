import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
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

for (const { label, isPackaged, directory, otherDirectory, appName } of [
  {
    label: '开发版',
    isPackaged: false,
    directory: 'fucha-dev',
    otherDirectory: 'fucha',
    appName: '浮槎 Dev',
  },
  {
    label: '正式版',
    isPackaged: true,
    directory: 'fucha',
    otherDirectory: 'fucha-dev',
    appName: '浮槎',
  },
]) {
  test(`${label}使用约定名称与独立目录且不改动另一版本数据`, async () => {
    const appData = await mkdtemp(join(tmpdir(), 'fucha-e2e-'))

    try {
      const previousDir = join(appData, otherDirectory)
      await mkdir(previousDir)
      const previousPath = join(previousDir, 'app.db')
      const previous = new DatabaseSync(previousPath)
      try {
        previous.exec(`
          CREATE TABLE preferences (key TEXT PRIMARY KEY, value TEXT NOT NULL);
          INSERT INTO preferences VALUES ('theme.active', '"qingci"');
          PRAGMA user_version = 11;
        `)
      } finally {
        previous.close()
      }
      const backup = await readFile(previousPath)

      const entry = join(appData, 'launch.cjs')
      await writeFile(
        entry,
        `const { app } = require('electron')
app.setPath('appData', ${JSON.stringify(appData)})
Object.defineProperty(app, 'isPackaged', { value: ${isPackaged} })
require(${JSON.stringify(join(process.cwd(), 'out/main/index.js'))})
`
      )
      const app = await electron.launch({
        args: [entry, '--hidden-window'],
        env: { ...process.env, OPEN_DEVTOOLS: '0', APP_CHANNEL: 'development' },
      })
      try {
        const page = await app.firstWindow()
        await page.waitForLoadState('domcontentloaded')
        expect(await app.evaluate(({ app }) => app.getName())).toBe(appName)
        const userData = await app.evaluate(({ app }) => app.getPath('userData'))
        expect(await realpath(userData)).toBe(await realpath(join(appData, directory)))
        expect(await page.evaluate(() => window.api.listArticles())).toEqual([])
        expect(await page.evaluate(() => window.api.listThemes())).toEqual([])
        expect(await page.evaluate(() => window.api.getPreference('theme.active'))).toBeNull()
      } finally {
        await app.close()
      }

      expect(await readFile(previousPath)).toEqual(backup)

      const current = new DatabaseSync(join(appData, directory, 'app.db'), { readOnly: true })
      try {
        expect(current.prepare('PRAGMA user_version').get()).toEqual({ user_version: 1 })
      } finally {
        current.close()
      }
    } finally {
      await rm(appData, { recursive: true, force: true })
    }
  })
}
