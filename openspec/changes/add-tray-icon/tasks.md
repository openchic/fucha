## 1. 图标素材

- [x] 1.1 从 `build/macos-icon.svg` 的筏与双波纹图形生成去底片、纯黑带 alpha 的 `resources/trayTemplate@2x.png`（36×36，原比例，18pt），用 `rsvg-convert` 生成并打开确认构图与品牌一致
- [x] 1.2 用 `sips` 核对 `trayTemplate@2x.png` 为 36×36、`app-icon.png` 为 512×512 且均带 alpha，并确认 `electron-builder.yml` 的 `files` / `asarUnpack` 已覆盖 `resources/**`，无需改打包配置
- [x] 1.3 生成 `resources/app-icon.png`（512×512 全彩品牌图）供开发版 Dock 使用，`sips` 核对尺寸与 alpha

## 2. 主进程实现

- [x] 2.1 在 `src/main/index.ts` 提取 `showOrCreateMainWindow()`：无窗口时建窗，有窗口时恢复最小化、显示、聚焦；`activate` 回调改用它，`pnpm typecheck` 通过且 `pnpm test` 无回归
- [x] 2.2 新增 `src/main/tray.ts`：接收 `showMainWindow` 回调，创建 `Tray`，加载 template 图标并 `setTemplateImage(true)`，tooltip 使用正式版「浮槎」或开发版「浮槎 Dev」，并提供「打开」/ 分隔线 /「关于」/「退出 ⌘Q」原生菜单；`pnpm typecheck` 与 `pnpm lint` 通过
- [x] 2.3 在 `app.whenReady()` 后接入托盘创建，守卫为 `process.platform === 'darwin'` 且非 `--hidden-window`；用 `pnpm dev` 确认图标出现、`--hidden-window` 启动不出现
- [x] 2.4 真机验证菜单动作：「打开」在无窗口时新建、最小化时恢复、后台时前置；「关于」打开原生 About 面板（应用名称、版本和应用包图标）；「退出」完全退出且图标消失
- [x] 2.5 开发版 Dock 图标使用品牌图，托盘「关于」打开原生 About 面板；应用菜单不重复提供「关于」入口

## 3. 集成与文档

- [x] 3.1 `pnpm build:unpack` 后启动打包产物，确认 `?asset` 路径下图标正常显示，记录结果
- [x] 3.2 运行 `pnpm test:e2e`，确认 `--hidden-window` 模式下没有托盘图标且既有用例全部通过
- [x] 3.3 在 `docs/design.md` 应用壳部分补一句 macOS 菜单栏常驻图标与召回/退出入口，`pnpm format` 后检查无多余改动

## 4. 应用菜单

- [x] 4.1 在 macOS 顶部只保留应用名称菜单：正式版为「浮槎」、开发版为「浮槎 Dev」；合并隐藏/退出/最小化/缩放/切换全屏，关于入口由托盘提供，去掉独立窗口、文件、编辑、显示菜单
- [x] 4.2 真机核对菜单结构；验证复制/剪切/粘贴/撤销/全选仍可用，修复切换全屏角色导致的重复项，记录 ⌘W 失效与系统注入「退出并保留窗口」
- [x] 4.3 在真实开发窗口确认菜单顺序为隐藏、分隔线、最小化/缩放/切换全屏、分隔线、退出；「关于」仅在托盘菜单中

## 5. 应用文件名与显示名

- [x] 5.1 正式版与开发版的包名、主可执行文件统一为 `fucha`；正式版显示「浮槎」、开发版显示「浮槎 Dev」，保留不同 Bundle ID 与数据目录
- [x] 5.2 macOS 基础 `CFBundleDisplayName` 匹配 `fucha.app`，保持 `CFBundleName` 与产品名一致；同步更新各版本本地化名称、菜单/关于/托盘文案、名称断言与设计文档
- [x] 5.3 重建正式版与开发版 macOS 包，核对 `.app` 目录和主可执行文件均为 `fucha`，检查两版的 Bundle ID、基础及本地化显示名称；检查 Windows / Linux 配置中的应用显示名、可执行文件名与安装包名
- [x] 5.4 本地开发窗口、原生 About 面板和托盘提示使用「浮槎 Dev」；`pnpm dev` 保持普通 electron-vite 启动，不复制或重签 Electron.app
- [x] 5.5 在普通 `pnpm dev` 真实窗口确认窗口与 About 名称为「浮槎 Dev」；About 图标、macOS 系统应用名保留 Electron，并保持开发进程运行

## 6. 原生 About 面板

- [x] 6.1 托盘「关于」调用 `app.showAboutPanel()`，通过 `app.setAboutPanelOptions()` 设置名称与版本；删除自绘 About 窗口，并在真实开发窗口确认「浮槎 Dev」与 Electron 图标
- [x] 6.2 将独立 macOS 开发包配置、构建模式、命令和输出目录统一改为 `dev`，同步 README、发布说明、数据目录文档与主规格
