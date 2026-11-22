import { app, Menu, nativeImage, Tray } from 'electron'
// 单文件 @2x：Electron 识别为 18pt / scale 2，非 Retina 屏由系统缩放
import trayIconPath from '../../resources/trayTemplate@2x.png?asset'
import { showAboutWindow } from './about'

let tray: Tray | null = null

/** macOS 菜单栏常驻图标。菜单项只用动作词，不重复品牌名。 */
export function createTray(showMainWindow: () => void): void {
  if (tray) return

  const icon = nativeImage.createFromPath(trayIconPath)
  icon.setTemplateImage(true)

  tray = new Tray(icon)
  tray.setToolTip('浮槎')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: '打开', click: showMainWindow },
      { type: 'separator' },
      { label: '关于', click: showAboutWindow },
      { label: '退出', accelerator: 'Command+Q', click: () => app.quit() },
    ])
  )
}
