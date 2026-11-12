import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  _electron as electron,
  expect,
  test as base,
  type ElectronApplication,
  type Page,
} from '@playwright/test'

type CheckResult = { name: string; pass: boolean; detail?: string }
type CheckRunner = { run: (groups: string[]) => Promise<CheckResult[]> }

type FuchaFixtures = {
  userData: string
  app: ElectronApplication
  page: Page
  consoleErrors: string[]
  checks: CheckRunner
}

export const test = base.extend<FuchaFixtures>({
  userData: async ({}, use) => {
    const dir = await mkdtemp(join(tmpdir(), 'fucha-e2e-'))
    await use(dir)
    await rm(dir, { recursive: true, force: true })
  },

  app: async ({ userData }, use) => {
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${userData}`, '--hidden-window'],
      env: { ...process.env, OPEN_DEVTOOLS: '0' },
    })
    await use(app)
    await app.close()
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow()
    await page.waitForLoadState('domcontentloaded')
    // 等 app:// 协议处理器就绪，避免个别用例在注册完成前访问
    await app.evaluate(async ({ net }) => {
      for (let attempt = 0; attempt < 50; attempt += 1) {
        try {
          await net.fetch('app://img/__ready__')
          return
        } catch {
          await new Promise((resolve) => setTimeout(resolve, 20))
        }
      }
    })
    await use(page)
  },

  consoleErrors: async ({ page }, use) => {
    const errors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') errors.push(message.text())
    })
    page.on('pageerror', (error) => errors.push(error.message))
    await use(errors)
  },

  checks: async ({ page }, use) => {
    const bundlePath = join(process.cwd(), 'out/e2e-checks.js')
    const code = await readFile(bundlePath, 'utf8').catch(() => {
      throw new Error('缺少 out/e2e-checks.js，请用 pnpm verify 运行集成测试（会先构建断言包）')
    })
    await page.evaluate(code)
    await use({
      run: (groups) =>
        page.evaluate((selected) => window.__fuchaChecks.run(selected as never), groups) as Promise<
          CheckResult[]
        >,
    })
  },
})

/** 断言分组结果全部通过；失败时一次列出所有失败项 */
export function expectPassing(results: CheckResult[]): void {
  expect(results.length).toBeGreaterThan(0)
  const failures = results
    .filter((result) => !result.pass)
    .map((result) => `${result.name}${result.detail ? ` — ${result.detail}` : ''}`)
  expect(failures).toEqual([])
}

export { expect }
