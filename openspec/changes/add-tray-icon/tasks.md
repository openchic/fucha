## 1. 图标素材

- [x] 1.1 从 `build/macos-icon.svg` 的筏与双波纹图形生成去底片、纯黑带 alpha 的 `resources/trayTemplate@2x.png`（36×36，原比例，18pt），用 `rsvg-convert` 生成并打开确认构图与品牌一致
- [x] 1.2 用 `sips` 核对 `trayTemplate@2x.png` 为 36×36、`app-icon.png` 为 512×512 且均带 alpha，并确认 `electron-builder.yml` 的 `files` / `asarUnpack` 已覆盖 `resources/**`，无需改打包配置
- [x] 1.3 生成 `resources/app-icon.png`（512×512 全彩品牌图）供关于窗口与开发版 Dock 使用，`sips` 核对尺寸与 alpha

## 2. 主进程实现

- [x] 2.1 在 `src/main/index.ts` 提取 `showOrCreateMainWindow()`：无窗口时建窗，有窗口时恢复最小化、显示、聚焦；`activate` 回调改用它，`pnpm typecheck` 通过且 `pnpm test` 无回归
- [x] 2.2 新增 `src/main/tray.ts`：接收 `showMainWindow` 回调，创建 `Tray`，加载 template 图标并 `setTemplateImage(true)`，设置 tooltip「浮槎」与「打开」/ 分隔线 /「关于」/「退出 ⌘Q」的原生菜单；`pnpm typecheck` 与 `pnpm lint` 通过
- [x] 2.3 在 `app.whenReady()` 后接入托盘创建，守卫为 `process.platform === 'darwin'` 且非 `--hidden-window`；用 `pnpm dev` 确认图标出现、`--hidden-window` 启动不出现
- [x] 2.4 真机验证菜单动作：「打开」在无窗口时新建、最小化时恢复、后台时前置；「关于」打开应用内关于窗口（品牌图标、名称、版本）；「退出」完全退出且图标消失
- [x] 2.5 开发版 Dock 图标使用品牌图，顶部应用菜单的「关于」指向同一关于窗口；`pnpm dev` 验证 Dock、托盘关于与应用菜单关于显示一致

## 3. 集成与文档

- [x] 3.1 `pnpm build:unpack` 后启动打包产物，确认 `?asset` 路径下图标正常显示，记录结果
- [x] 3.2 运行 `pnpm test:e2e`，确认 `--hidden-window` 模式下没有托盘图标且既有用例全部通过
- [x] 3.3 在 `docs/design.md` 应用壳部分补一句 macOS 菜单栏常驻图标与召回/退出入口，`pnpm format` 后检查无多余改动

## 4. 应用菜单

- [x] 4.1 在 macOS 精简应用菜单为「浮槎」与「窗口」：关于/隐藏/退出与最小化/缩放/切换全屏，去掉文件、编辑、显示；`pnpm typecheck` 与 `pnpm lint` 通过
- [x] 4.2 真机核对菜单结构；验证复制/剪切/粘贴/撤销/全选仍可用，修复切换全屏角色导致的重复项，记录 ⌘W 失效与系统注入「退出并保留窗口」
