import { join } from 'path'
import { app, shell, BrowserWindow, Menu, nativeImage, screen } from 'electron'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initLocalStore } from './db'
import { registerAppProtocol, registerIpcHandlers, serveAppProtocol } from './ipc'
import { createTray } from './tray'
import { fitWindowSize } from './window-size'
import appIconPath from '../../resources/app-icon.png?asset'

registerAppProtocol()

const IS_DEVELOPMENT = is.dev || process.env.APP_CHANNEL === 'development'
const APP_DISPLAY_NAME = IS_DEVELOPMENT ? '浮槎 Dev' : '浮槎'
const APP_ID = IS_DEVELOPMENT ? 'com.ls63cc.fucha.dev' : 'com.ls63cc.fucha'
const USER_DATA_DIR = join(app.getPath('appData'), IS_DEVELOPMENT ? 'fucha-dev' : 'fucha')
// 集成测试连续拉起多个实例；隐藏窗口避免抢占焦点与反复闪窗
const HIDDEN_WINDOW = process.argv.includes('--hidden-window')

app.setName(APP_DISPLAY_NAME)
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
    title: APP_DISPLAY_NAME,
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

  mainWindow.webContents.on('page-title-updated', (event) => {
    event.preventDefault()
  })

  mainWindow.webContents.on('did-finish-load', () => {
    void mainWindow.webContents.executeJavaScript(
      `document.title = ${JSON.stringify(APP_DISPLAY_NAME)}`
    )
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
        label: APP_DISPLAY_NAME,
        submenu: [
          { role: 'hide', label: '隐藏' },
          { type: 'separator' },
          { role: 'minimize', label: '最小化' },
          { role: 'zoom', label: '缩放' },
          {
            label: '切换全屏',
            accelerator: 'Control+Command+F',
            click: () => {
              const window = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0]
              if (window) window.setFullScreen(!window.isFullScreen())
            },
          },
          { type: 'separator' },
          { role: 'quit', label: '退出' },
        ],
      },
      {
        label: '编辑',
        submenu: [
          { role: 'undo', label: '撤销' },
          { role: 'redo', label: '重做' },
          { type: 'separator' },
          { role: 'cut', label: '剪切' },
          { role: 'copy', label: '复制' },
          { role: 'paste', label: '粘贴' },
          { role: 'pasteAndMatchStyle', label: '粘贴并匹配样式' },
          { role: 'delete', label: '删除' },
          { role: 'selectAll', label: '全选' },
          { type: 'separator' },
          {
            label: '替换',
            submenu: [
              { role: 'showSubstitutions', label: '显示替换' },
              { role: 'toggleSmartQuotes', label: '智能引号' },
              { role: 'toggleSmartDashes', label: '智能破折号' },
              { role: 'toggleTextReplacement', label: '文本替换' },
            ],
          },
          {
            label: '朗读',
            submenu: [
              { role: 'startSpeaking', label: '开始朗读' },
              { role: 'stopSpeaking', label: '停止朗读' },
            ],
          },
        ],
      },
    ])
  )
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId(APP_ID)
  if (process.platform === 'darwin') {
    app.setAboutPanelOptions({
      applicationName: APP_DISPLAY_NAME,
      applicationVersion: app.getVersion(),
      version: '',
    })
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
  if (process.platform === 'darwin' && !HIDDEN_WINDOW) {
    createTray(showOrCreateMainWindow, APP_DISPLAY_NAME)
  }

  app.on('activate', () => {
    showOrCreateMainWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
