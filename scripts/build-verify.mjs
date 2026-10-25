// 临时验证打包脚本：把 harness 入口用 esbuild 打成 Electron 可直接运行的形式。
// 用法：node scripts/build-verify.mjs && npx electron out/verify-main.cjs
import { execFileSync } from 'child_process'
import { copyFileSync, mkdirSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const out = join(root, 'out')
mkdirSync(out, { recursive: true })

function findEsbuild() {
  const base = join(root, 'node_modules/.pnpm')
  const dir = readdirSync(base)
    .filter((d) => d.startsWith('esbuild@'))
    .sort()
    .pop()
  return join(base, dir, 'node_modules/esbuild/bin/esbuild')
}

const esbuild = findEsbuild()

const common = ['--bundle', '--alias:@shared=./src/shared', '--log-level=warning']

execFileSync(
  esbuild,
  [
    ...common,
    '--platform=node',
    '--format=cjs',
    '--external:electron',
    'scripts/verify-main.ts',
    '--outfile=out/verify-main.cjs',
  ],
  { cwd: root, stdio: 'inherit' }
)

execFileSync(
  esbuild,
  [
    ...common,
    '--platform=node',
    '--format=cjs',
    '--external:electron',
    'scripts/verify-runtime.ts',
    '--outfile=out/verify-runtime.cjs',
  ],
  { cwd: root, stdio: 'inherit' }
)

execFileSync(
  esbuild,
  [
    ...common,
    '--platform=browser',
    '--format=iife',
    'scripts/verify-renderer.ts',
    '--outfile=out/verify-renderer.js',
  ],
  { cwd: root, stdio: 'inherit' }
)

copyFileSync(join(root, 'scripts/verify-renderer.html'), join(out, 'verify-renderer.html'))
console.log(
  'harness 打包完成：out/verify-main.cjs、out/verify-runtime.cjs、out/verify-renderer.{js,html}'
)
