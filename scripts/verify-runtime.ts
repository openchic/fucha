// 临时验证入口（运行器）：在隐藏窗口里跑渲染进程验证，收集结果并退出。
import { join } from 'path'
import { app, BrowserWindow } from 'electron'
import { registerFuchaProtocol, registerIpcHandlers, serveFuchaProtocol } from '../src/main/ipc'

registerFuchaProtocol()

async function collect(win: BrowserWindow): Promise<string[] | undefined> {
  return win.webContents.executeJavaScript('window.__verifyResults')
}

app.whenReady().then(async () => {
  serveFuchaProtocol()
  registerIpcHandlers()

  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, 'preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  win.webContents.on('console-message', (_e, _level, message) => {
    if (/error|Error/.test(message)) console.error('[renderer]', message)
  })

  await win.loadFile(join(__dirname, 'verify-renderer.html'), {
    search: process.env.VERIFY_CHECKLIST === '1' ? 'checklist=1' : 'checklist=0',
  })

  const deadline = Date.now() + 480_000
  let results: string[] | undefined
  while (Date.now() < deadline) {
    results = await collect(win)
    if (results) break
    await new Promise((r) => setTimeout(r, 500))
  }

  const preloadOk = await win.webContents.executeJavaScript(
    "typeof window.fucha === 'object' && typeof window.fucha.fetchArticle === 'function'"
  )
  const isolationOk = await win.webContents.executeJavaScript('typeof process === "undefined"')

  console.log('\n===== 渲染进程验证结果 =====')
  console.log(`PASS 1.4 contextBridge 暴露 fucha 命名空间 — ${preloadOk ? 'ok' : 'missing'}`)
  console.log(`PASS 1.4 sandbox 下无 process 泄漏 — ${isolationOk ? 'ok' : 'leaked'}`)
  if (!results) {
    console.log('FAIL 渲染进程验证未在时限内完成')
    app.exit(1)
    return
  }
  for (const line of results) console.log(line)
  const failed =
    results.filter((r) => r.startsWith('FAIL')).length + (preloadOk ? 0 : 1) + (isolationOk ? 0 : 1)
  console.log(`合计 ${results.length + 2} 项，失败 ${failed} 项`)
  app.exit(failed === 0 ? 0 : 1)
})
