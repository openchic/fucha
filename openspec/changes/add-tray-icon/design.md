## Context

主进程当前只在 `src/main/index.ts` 里建窗：`createWindow()` 是局部函数，macOS 关闭窗口后应用继续运行，`activate` 回调用同一函数重建窗口。整个仓库没有使用 `Tray`、`Menu`、`app.dock` 等系统界面 API，也没有单实例锁。

渲染层不需要参与本变更：菜单只有「打开浮槎」「退出浮槎」，都不涉及路由跳转或 IPC，因此 preload 与 `window.api` 契约保持不变。

素材侧，`resources/` 目前为空；`electron-builder.yml` 的 `files` 已包含 `resources/**` 且 `asarUnpack` 覆盖它。品牌图形在 `build/macos-icon.svg`：白色圆角底片内是旋转的筏形与左右对称的双层波纹。菜单栏需要的是去掉底片、纯黑带 alpha 的模板图，尺寸为 16×16pt。

e2e 以 `--hidden-window` 参数连续拉起多个实例（`tests/e2e/fixtures.ts`），实例会真实进入 macOS 图形环境。

## Goals / Non-Goals

**Goals:**

- macOS 运行期常驻一个自适应明暗的模板图标。
- 图标菜单只有「打开浮槎」「退出浮槎」，不引入 IPC 与路由联动。
- 召回窗口的行为与 Dock 激活一致，复用同一段建窗/前置逻辑。
- 图标素材可复现生成、随包分发，不增加运行时依赖。

**Non-Goals:**

- Windows/Linux 托盘，以及随之而来的「关窗进托盘」语义改造。
- 隐藏 Dock 图标或改为 LSUIElement 纯菜单栏应用。
- 自定义 macOS 顶部应用文字菜单。
- 单实例锁、菜单栏角标、快捷动作（新建/最近/设置）。

## Decisions

### 1. 用 Electron `Tray` + 原生菜单，独立成 `src/main/tray.ts`

菜单栏状态项用 `Tray` 创建，菜单用 `Menu.buildFromTemplate`，点击图标即展开（macOS 设置 context menu 后的默认行为）。托盘模块只接收一个 `showMainWindow` 回调，不直接 import 窗口创建逻辑，避免 `index.ts` 与 `tray.ts` 循环依赖。

替代方案：在应用文字菜单里加一项——位置不对，也满足不了「菜单栏有图标」；直接调 NSStatusItem 原生模块——多一个依赖，能力没有增加。

### 2. 仅 macOS 创建，且 `--hidden-window` 下跳过

入口处用 `process.platform === 'darwin'` 与 `!HIDDEN_WINDOW` 双重守卫。Win/Linux 现有「关闭最后一个窗口即退出」的行为不动。

替代方案：三平台统一创建托盘——需要把 Win/Linux 的关窗行为改成隐藏到托盘，属于独立的行为变更，本次不做。测试模式跳过的代价是 e2e 覆盖不到托盘，用真机检查清单补足。

### 3. 图标走 template image，只保留一个 `@2x` 文件

- 只提供 `resources/trayTemplate@2x.png`（36×36，纯黑带 alpha），加载后 `setTemplateImage(true)`，由系统在浅色/深色菜单栏自动反色，不准备彩色版本。
- 单文件可行性已验证：`nativeImage.createFromPath` 加载仅有的 `@2x` 文件时返回 18×18pt、scale `[2]`，Retina 菜单栏按 18pt 渲染；非 Retina 屏由 AppKit 把 36px 代表图缩到 18pt，代价是轻微软化，不再维护手绘 1x 版本。
- 菜单栏实测邻近图标墨迹高 14.5–17pt，原 16pt 文件只有 12pt 墨迹，偏小两成左右；改用 18pt 逻辑尺寸并收紧 viewBox 留白后，墨迹约 14.5pt。
- 保留源文件「筏 + 双波纹」构图，与 `build/macos-icon.svg` 的几何逐字一致，只去掉白色圆角底片并收紧留白。
- 素材用本机 `rsvg-convert` 从 `build/tray-icon.svg` 一次性生成并提交 PNG，不在构建链里引入 sharp 等光栅化依赖。
- 主进程用 electron-vite 的 `?asset` 导入取路径。替代方案是按 `app.isPackaged` 手拼 `process.resourcesPath` / 源码相对路径，要处理 asar 与 asarUnpack 的路径分支，`?asset` 由构建工具统一处理更稳。

### 4. 召回窗口提取为共用函数

在 `index.ts` 中把「无窗口则建、有窗口则恢复并前置」提取为 `showOrCreateMainWindow()`：先取 `BrowserWindow.getAllWindows()[0]`；不存在则 `createWindow()`；存在则 `isMinimized() && restore()`、`show()`、`focus()`，最后 `app.focus({ steal: true })` 确保从其他应用切换过来时成为前台。`activate` 回调与托盘菜单共用它。

替代方案：托盘模块自己再写一份建窗逻辑——窗口尺寸、最小尺寸、标题栏样式等参数会漂移。

### 5. 菜单结构与文案固定品牌名

菜单采用原生 NSMenu 并按参考版式分组：「打开」一组，分隔线后为「关于」「退出 ⌘Q」。退出项显式设置 `Command+Q` accelerator 显示快捷键提示。菜单项只用动作词，不重复品牌名；tooltip 固定为「浮槎」，不拼接开发版 `浮槎 Debug`。

关于项不再使用系统面板：macOS 原生关于面板的图标只取自应用包，`iconPath` 仅支持 Linux/Windows，`app.dock.setIcon` 也不影响面板，因此改为自绘关于窗口（284×196，品牌图标 + 名称 + 版本，沙箱渲染，data URL）。开发版同时用 `app.dock.setIcon` 换成品牌图标；顶部应用菜单在 macOS 重建为中文精简菜单（见决策 7）。

底色与宽度不由应用设置：原生菜单底色跟随系统外观（参考图的深色即系统深色菜单材质），宽度由最长菜单项决定。不为了凑宽加入本应用没有的入口；若要固定宽度或自定义底色，只能换成自绘 HTML 菜单，代价是失去原生键盘导航、辅助功能与系统材质，本次不做。

### 6. 托盘实例用模块级引用持有，退出交给 `app.quit()`

`Tray` 必须被强引用，否则可能被 GC 后图标消失。不拦截窗口 `close`，也不需要 `isQuitting` 标志：macOS 关窗本来就不退出，退出动作只来自菜单与系统菜单的 `app.quit()`。

### 7. 应用菜单精简为两组

顶部应用菜单在 macOS 重建为两个菜单：应用菜单（关于、隐藏、退出）与窗口（最小化、缩放、切换全屏）。文件、编辑、显示整组删除，连同服务、替换、Speech、重载、开发者工具与角色注入项一起消失。切换全屏使用显式菜单项（⌃⌘F，`setFullScreen` 切换）而不是 `togglefullscreen` 角色：角色会让 macOS 再注入一个 fn F 的同名项，实测改为自定义项后窗口菜单只保留一项。编辑快捷键（⌘Z/⇧⌘Z/⌘X/⌘C/⌘V/⌘A）仍由 Chromium 在输入控件内处理，不依赖编辑菜单；⌘W 因没有关闭菜单项不再生效，窗口用红绿灯关闭。macOS 仍注入「退出并保留窗口」，应用不控制。菜单栏应用菜单标题由应用包决定：开发运行时显示 Electron，打包版显示浮槎，与 Dock 名称属于同一平台边界。

## Risks / Trade-offs

- [非 Retina 屏由系统缩放 36px 图，可能轻微软化] → 只影响非 Retina 屏；若实机观感差，再补一版 1x 手绘图，不改调用侧。
- [`?asset` 在打包后路径失效] → 用 `pnpm build:unpack` 打包后启动一次，确认图标从 asar 内正常加载；若异常，退回 `process.resourcesPath` 分支。
- [菜单比参考图窄] → 原生菜单宽度由内容决定；接受差异，不硬加不可用入口；要固定宽度需改自绘菜单，本次不做。
- [精简后仍出现系统注入项] → 「退出并保留窗口」由 macOS 注入；不为此改自绘菜单，真机记录后接受。
- [切换全屏出现两项] → `togglefullscreen` 角色会附带系统全屏项；改为显式菜单项 + `setFullScreen` 后实测只剩一项。
- [删除文件菜单后 ⌘W 失效] → 实测窗口不再被 ⌘W 关闭；需要时把「关闭窗口」并入窗口菜单，当前先接受。
- [托盘逻辑没有自动化测试] → e2e 明确跳过创建；用真机清单覆盖：启动可见、关窗仍在、最小化恢复、后台前置、退出、明暗切换。
- [多实例会各加一个图标] → 现状本就允许多实例与多个 Dock 图标，本次不引入单实例锁，保持边界。
- [菜单栏空间焦虑] → 图标常驻是已确认的取舍；不做动态增删，避免图标出现/消失造成误判。

## Migration Plan

不涉及数据或配置迁移。随下个版本发布，回滚只需移除托盘创建调用与素材，窗口行为不受影响。
