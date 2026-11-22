import { readFileSync } from 'fs'
import { app, BrowserWindow } from 'electron'
import appIconPath from '../../resources/app-icon.png?asset'

let aboutWindow: BrowserWindow | null = null

function renderAboutHtml(): string {
  const icon = `data:image/png;base64,${readFileSync(appIconPath).toString('base64')}`
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<title>关于浮槎</title>
<style>
  :root { color-scheme: light dark; }
  * { box-sizing: border-box; }
  html, body { height: 100%; margin: 0; }
  body {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    font-family: -apple-system, BlinkMacSystemFont, "PingFang SC", sans-serif;
    background: #f5f5f5;
    color: #1d1d1f;
    user-select: none;
  }
  img { width: 96px; height: 96px; }
  h1 { margin: 14px 0 0; font-size: 17px; font-weight: 600; }
  p { margin: 6px 0 0; font-size: 12px; color: #6e6e73; }
  @media (prefers-color-scheme: dark) {
    body { background: #1e1e1e; color: #f5f5f5; }
    p { color: #9a9a9e; }
  }
</style>
</head>
<body>
  <img src="${icon}" alt="浮槎">
  <h1>浮槎</h1>
  <p>版本 ${app.getVersion()}</p>
</body>
</html>`
}

/** 原生关于面板在 macOS 上只读应用包图标，改用自绘窗口以统一开发版与打包版的品牌图。 */
export function showAboutWindow(): void {
  if (aboutWindow) {
    aboutWindow.show()
    aboutWindow.focus()
    return
  }

  aboutWindow = new BrowserWindow({
    width: 284,
    height: 196,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: '关于浮槎',
    titleBarStyle: 'hiddenInset',
    show: false,
    webPreferences: { sandbox: true },
  })

  aboutWindow.on('closed', () => {
    aboutWindow = null
  })

  aboutWindow.webContents.on('before-input-event', (event, input) => {
    if (input.key === 'Escape') {
      event.preventDefault()
      aboutWindow?.close()
    }
  })

  aboutWindow.once('ready-to-show', () => aboutWindow?.show())
  void aboutWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(renderAboutHtml())}`)
}
