// 把渲染侧断言打进真实页面：产物由 Playwright 在应用窗口内执行，CSP 不拦截 Runtime.evaluate
import { execFileSync } from 'child_process'
import { readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function findEsbuild() {
  const base = join(root, 'node_modules/.pnpm')
  const dir = readdirSync(base)
    .filter((name) => name.startsWith('esbuild@'))
    .sort()
    .pop()
  return join(base, dir, 'node_modules/esbuild/bin/esbuild')
}

execFileSync(
  findEsbuild(),
  [
    '--bundle',
    '--platform=browser',
    '--format=iife',
    '--alias:@shared=./src/shared',
    '--alias:@renderer=./src/renderer/src',
    '--log-level=warning',
    'tests/e2e/support/checks-entry.ts',
    '--outfile=out/e2e-checks.js'
  ],
  { cwd: root, stdio: 'inherit' }
)
console.log('已生成 out/e2e-checks.js')
