import { join } from 'path'
import { app, shell, BrowserWindow, Menu, nativeImage, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { showAboutWindow } from './about'
import { initLocalStore } from './db'
import { registerAppProtocol, registerIpcHandlers, serveAppProtocol } from './ipc'
import { createTray } from './tray'
import { fitWindowSize } from './window-size'
import appIconPath from '../../resources/app-icon.png?asset'

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

function showOrCreateMainWindow(): void {
  const [mainWindow] = BrowserWindow.getAllWindows()
  if (!mainWindow) {
    createWindow()
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
  app.focus({ steal: true })
}

function installApplicationMenu(): void {
  Menu.setApplicationMenu(
    Menu.buildFromTemplate([
      {
        label: app.name,
        submenu: [
          { label: '关于浮槎', click: showAboutWindow },
          { type: 'separator' },
          { role: 'services' },
          { type: 'separator' },
          { role: 'hide' },
          { role: 'hideOthers' },
          { role: 'unhide' },
          { type: 'separator' },
          { role: 'quit' },
        ],
      },
      { role: 'fileMenu' },
      { role: 'editMenu' },
      { role: 'viewMenu' },
      { role: 'windowMenu' },
    ])
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_ID)
  if (process.platform === 'darwin') {
    if (IS_DEVELOPMENT) {
      const icon = nativeImage.createFromPath(appIconPath)
      if (!icon.isEmpty()) app.dock?.setIcon(icon)
    }
    installApplicationMenu()
  }
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
  if (process.platform === 'darwin' && !HIDDEN_WINDOW) createTray(showOrCreateMainWindow)

  app.on('activate', () => {
    showOrCreateMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
