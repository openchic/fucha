# application-identity Specification

## Purpose

应用包文件名使用稳定的 ASCII 名称，用户看到的名称统一使用中文品牌名。

## Requirements

### Requirement: 应用文件名与显示名分离

正式版与单独打包的开发版 SHALL 使用 `fucha` 作为应用包名和主可执行文件名；分发文件 SHALL 使用 `fucha` 作为文件名前缀。正式版用户可见显示名 SHALL 为「浮槎」；开发版显示名 SHALL 为「浮槎 Dev」，且 `Dev` SHALL 作为开发构建标识。此命名 SHALL 一致应用于 macOS 打包应用的 Dock、Finder、安装器、应用菜单、菜单栏图标提示与 About 面板。开发版 SHALL 保留独立的 Bundle ID `com.ls63cc.fucha.dev` 和数据目录 `fucha-dev`。

macOS 应用包目录名 SHALL 为 `fucha.app`，主可执行文件 SHALL 为 `fucha`；基础 `CFBundleDisplayName` 与 `CFBundleName` SHALL 使用 electron-builder 的产品名，正式版为「浮槎」、开发版为「浮槎 Dev」。随包的每种语言 `InfoPlist.strings` SHALL 使用相同的中文显示名。现有正式包的基础 `CFBundleDisplayName` 为 `fucha`，本地化名称为「浮槎」，与 Spotlight 截图中的两个结果对应；更新后系统显示名 SHALL 统一为中文，但不改变磁盘上的文件名 `fucha.app`。

Windows 与 Linux SHALL 继续以 electron-builder 的 `productName` 显示产品名，以 `executableName` 命名主程序，并以 `fucha` 命名分发文件。Windows 快捷方式和卸载显示名、Linux 桌面入口名称 SHALL 分别跟随正式版「浮槎」与开发版「浮槎 Dev」。

#### Scenario: macOS 文件名与 Dock 显示名

- **WHEN** 用户启动 macOS 正式版或单独打包的开发版
- **THEN** 应用包目录和主可执行文件名为 `fucha`，正式版 Dock 与 Finder 显示「浮槎」、开发版显示「浮槎 Dev」

#### Scenario: electron-vite 开发窗口标识

- **WHEN** 用户通过 `pnpm dev` 启动应用
- **THEN** 应用窗口、原生 About 面板和托盘提示显示「浮槎 Dev」；本地开发的 About 图标与 macOS Dock、Finder 及原生应用菜单沿用 Electron 运行时图标与名称

#### Scenario: Spotlight 显示中文应用名

- **WHEN** 用户在 macOS Spotlight 搜索应用
- **THEN** 应用结果显示中文产品名，不同时出现 `fucha` 与中文名两个应用结果；磁盘上的应用包仍名为 `fucha.app`

#### Scenario: 开发版保持数据隔离

- **WHEN** 正式版与开发版使用相同的应用显示名
- **THEN** 两者仍通过各自的 Bundle ID 与数据目录隔离，且不互相覆盖本地数据

#### Scenario: 安装器和应用界面使用中文

- **WHEN** 用户在受支持的平台安装或打开应用
- **THEN** 正式版安装器、应用菜单与 About 面板显示「浮槎」，开发版对应位置显示「浮槎 Dev」，分发文件仍以 `fucha` 开头
