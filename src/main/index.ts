import { join } from 'path'
import { app, shell, BrowserWindow, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initLocalStore } from './db'
import { registerAppProtocol, registerIpcHandlers, serveAppProtocol } from './ipc'
import { fitWindowSize } from './window-size'

registerAppProtocol()

const IS_DEVELOPMENT = is.dev || process.env.APP_CHANNEL === 'development'
const APP_NAME = IS_DEVELOPMENT ? '浮槎 Debug' : '浮槎'
const APP_ID = IS_DEVELOPMENT ? 'com.ls63cc.fucha.dev' : 'com.ls63cc.fucha'
const USER_DATA_DIR = join(app.getPath('appData'), IS_DEVELOPMENT ? 'fucha-dev' : 'fucha')
// 集成测试连续拉起多个实例；隐藏窗口避免抢占焦点与反复闪窗
const HIDDEN_WINDOW = process.argv.includes('--hidden-window')

app.setName(APP_NAME)
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', USER_DATA_DIR)

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
    if (!HIDDEN_WINDOW) mainWindow.show()
    if (is.dev && process.env['OPEN_DEVTOOLS'] !== '0' && !HIDDEN_WINDOW) {
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
  electronApp.setAppUserModelId(APP_ID)
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
