import { join } from 'path'
import { app, shell, BrowserWindow, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initLocalStore } from './db'
import { registerAppProtocol, registerIpcHandlers, serveAppProtocol } from './ipc'
import { fitWindowSize } from './window-size'

registerAppProtocol()

const USER_DATA_OVERRIDDEN = process.argv.some((arg) => arg.startsWith('--user-data-dir'))
// 显示名是中文，数据目录固定用 ASCII 名；测试实例以 --user-data-dir 覆盖时保持覆盖
const USER_DATA_DIR = join(app.getPath('appData'), 'fucha')

app.setName('浮槎')
if (!USER_DATA_OVERRIDDEN) app.setPath('userData', USER_DATA_DIR)

const EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:'])

function openExternal(url: string): void {
  try {
    if (!EXTERNAL_PROTOCOLS.has(new URL(url).protocol)) return
  } catch {
    return
  }
  void shell.openExternal(url)
}

function createWindow(): void {
  const windowSize = fitWindowSize(screen.getPrimaryDisplay().workAreaSize)
  const mainWindow = new BrowserWindow({
    ...windowSize,
    minWidth: 1000,
    minHeight: 700,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'darwin'
      ? {
          titleBarStyle: 'hiddenInset' as const,
          trafficLightPosition: { x: 18, y: 24 },
          // 未激活时第一次点击直接作用于控件，避免点侧栏按钮只激活窗口
          acceptFirstMouse: true,
        }
      : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
    },
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
    if (is.dev && process.env['OPEN_DEVTOOLS'] !== '0') {
      mainWindow.webContents.openDevTools({ mode: 'detach' })
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === mainWindow.webContents.getURL()) return
    event.preventDefault()
    openExternal(url)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.fucha.app')
  const localStore = initLocalStore()
  if (!localStore.available) {
    console.error(`[local-store] ${localStore.error ?? '数据库不可用'}`)
  }
  serveAppProtocol()
  registerIpcHandlers()

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
