## Why

macOS 上关闭主窗口后应用仍在运行，但除了 Dock 没有任何可见入口；菜单栏也没有常驻图标，用户无法快速找回窗口或就地退出。补一个菜单栏图标，把「关窗后应用还活着」这件事变得可见、可操作。

## What Changes

- macOS 菜单栏新增常驻 template 图标，浅色与深色菜单栏自动适配，不随窗口开关动态增删。
- 点击图标弹出托盘菜单：「打开」分组、「关于」与带 ⌘Q 提示的「退出」分组，中间以分隔线隔开；菜单项只用动作词，不重复品牌名。
- 「打开」：无窗口时新建主窗口；已有窗口时恢复最小化、显示并聚焦。「关于」打开应用内关于窗口，展示品牌图标、名称与版本。「退出」调用 `app.quit()`。
- 托盘图标只在 macOS 创建；Windows/Linux 的窗口与退出行为完全不变，不做「关窗进托盘」改造。
- 新增菜单栏图标素材：去底色的纯黑 18pt template 图，以单个 36px `@2x` 文件提供，非 Retina 屏由系统按需缩放。
- e2e 的 `--hidden-window` 模式不创建托盘图标，避免测试期间菜单栏反复闪烁。
- 不隐藏 Dock、不改 macOS 应用文字菜单、不新增 IPC/preload 通道、不做「新建任务」「设置」「最近文章」等快捷项。

## Capabilities

### New Capabilities

- `menu-bar-tray`: macOS 菜单栏常驻图标的创建与适配、极简菜单内容、窗口召回行为和平台/测试模式下的创建边界。

### Modified Capabilities

无。现有 spec 描述文章抓取、预览、主题、历史与导出行为，本变更只新增菜单栏入口，不改变任何既有用户可见行为。

## Impact

- 代码：`src/main/index.ts` 提取「显示或新建主窗口」逻辑；新增 `src/main/tray.ts`；新增 `resources/trayTemplate.png` 与 `resources/trayTemplate@2x.png`。
- 打包：主进程通过 electron-vite 的 `?asset` 导入图标；`electron-builder.yml` 已包含 `resources/**` 与 `asarUnpack`，无需改打包配置。
- 测试：e2e 的隐藏窗口模式跳过托盘创建；无单测新增面。
- 无依赖、无 IPC、preload、数据库与渲染层变更。
