## Why

M1 的主题是内置预设，用户只能整体换不能调。用户的目标是"更换或基于现有主题自定义"，本 change 对应里程碑 M2：把 token 从静态预设变成可编辑、可持久化、可自动生成的活数据。

## What Changes

- 新增主题编辑面板：逐项调 token（色值取色器、数值滑杆），实时反映到预览。
- 新增自定义主题持久化：另存为自定义主题落 userData，支持重命名、删除、导出 JSON、导入。
- 新增偏好持久化：记住上次使用的主题。
- 新增 token 自动生成（deriveToken）：从文章提取主色（og:image、favicon）并按内容特征自动选预设，作为可见可改的微调建议，对比度校验不达标降级默认色。
- 预览态界面接入面板入口。

不在本 change 范围：多预设库、主题分享市场、从源站学整套排版（明确不做）。

## Capabilities

### New Capabilities

- `theme-panel`: 主题切换与逐项编辑面板，改动实时反映到预览。
- `theme-persistence`: 自定义主题与偏好的持久化（存、改名、删、导入导出）。
- `theme-derivation`: 基于文章内容的 token 自动生成（取主色、自动选预设、对比度校验）。

### Modified Capabilities

（无——面板是对预览态的叠加能力，theme-tokens 的结构、themed-preview 的渲染行为、wechat-export 的导出行为均不变）

## Impact

- 代码：`src/renderer/src/components/ThemePanel.tsx`、`src/renderer/src/theme/derive.ts`、`src/renderer/src/theme/store.ts`、`src/preload`（store 读写 IPC）、`src/main/ipc.ts`（userData 读写）。
- 依赖 change 2 的 ThemeToken 契约与主题渲染管线。
- 无新第三方依赖（取色用 canvas，聚类自实现）。
