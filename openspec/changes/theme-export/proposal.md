## Why

M0 打通了"链接进、预览出"，但预览只是样式基线，产出物无法直接进公众号：微信编辑器剥离 style 标签与 class 样式，只认元素 style 属性上的内联样式，且外链图片会裂图。本 change 对应里程碑 M1：让"复制粘贴进公众号后台不改格式"成立，这也是产品的价值验收点。

## What Changes

- 新增主题 token 体系（ThemeToken 固定结构、单位约定）与首套内置预设（面向技术长文）。
- 新增 CSS 生成函数：token 产出预览用 CSS 变量集与导出用具体值样式表，预览与导出共用同一份生成逻辑。
- 新增导出管道：highlight.js 高亮、juice 内联、图片转 base64（单图上限 5MB）、微信白名单降级、来源行附加。
- 新增一键复制到剪贴板（内联样式 HTML）与保存 HTML 文件。
- 原预览态接入主题渲染：预览即公众号所见效果。
- 建微信兼容性检查清单，作为回归基线。

不在本 change 范围：主题编辑面板、自定义主题持久化、token 自动生成（change 3）。

## Capabilities

### New Capabilities

- `theme-tokens`: 主题 token 的固定结构、单位约定与内置预设。
- `themed-preview`: 预览按主题 token 渲染，主题切换即时生效。
- `wechat-export`: 内联样式导出（高亮、内联、base64 图片、白名单降级、来源行）与一键复制/保存。

### Modified Capabilities

（无——preview-ui 的预览态接入主题渲染属新能力叠加，原"只读预览、来源固定可见、失败可重试"等要求不变）

## Impact

- 新依赖：`highlight.js`、`juice`。
- 代码：`src/renderer/src/theme/`（tokens、apply、presets）、`src/renderer/src/pipeline/export.ts`、`src/renderer/src/views/PreviewView.tsx`（主题渲染接入）、`src/shared/types.ts`（ThemeToken 契约）。
- 依赖 change 1 产出的 Article 契约与预览态宿主。
