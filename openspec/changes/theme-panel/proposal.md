## Why

M1 的主题是只读内置预设，用户只能整体切换，不能基于现有主题调整，也没有地方保存自己的主题。M2 要把主题变成可编辑、可保存、可交换的数据：主题是不可变快照，界面只改内存草稿，保存生成新主题，历史文章不被静默改版。

本 change 同时完成主题系统从「单一 token 生成器」到「token + theme.css 两层模型」的结构迁移，因为面板、主题包和文章绑定都依赖这套契约。

## What Changes

- ThemeToken v1：h1–h6 移到顶层，每级有 `fontSize / color? / textAlign / decoration / marginTop / marginBottom`；字段名对齐 CSS 属性（`backgroundColor`、`borderColor`、`table.padding`、`image.marginTop/marginBottom`、`divider.borderTopStyle`）。
- 内置主题改为「token 默认值 + theme.css」，提供 `default` 与 `serif` 两套；内置主题只读，升级视觉时新增 id，旧 id 保留。
- 新增应用级 `base.css`（正文排版、引用、代码、表格、图片、分割线，只引用 token 变量）与每主题 `theme.css`；预览与导出共用同一份 CSS，导出时解析 `var()` 后再 juice 内联。
- 新增主题 CSS 契约与 fail-closed 校验：只允许元素/类/后代选择器与微信安全属性，禁止伪类、`@` 规则、`!important`、外部资源与契约外变量，错误带行号。
- 新增主题编辑面板：按颜色、正文、标题、组件分组，颜色用取色器、数值用滑杆，改动实时反映到预览。
- 新增编辑草稿与另存为：草稿只在内存，保存生成新主题 id 并只切换当前文章；未保存切换或离开时提示。
- 新增自定义主题管理：列出自定义主题，支持应用、导出、重命名、删除；被文章引用的主题拒绝删除。
- 新增 `.fucha-theme` 主题包（`theme.json` + `theme.css`）导入导出；导入校验 token、CSS、zip 结构与文件完整性，id 冲突或内置 id 拒绝。
- 本地存储升级到 schema v4：`themes` 增加 `css`、`token_version`、`source_theme_id`；保存不再覆盖旧行。
- 文章快照写入本地存储，切换主题只更新 `articles.theme_id`，并记住 `theme.active` 作为新文章默认主题。

不在本 change 范围：token 自动生成（取主色/自动选预设）、历史侧栏界面、应用内 CSS 编辑器、批量把文章迁移到新主题。

## Capabilities

### New Capabilities

- `theme-panel`: 主题切换、分组编辑面板、会话草稿与另存为。
- `theme-persistence`: 不可变主题快照、文章主题绑定、默认主题偏好与内置主题保护。
- `theme-packages`: `.fucha-theme` 主题包导入导出与 fail-closed 校验。

### Modified Capabilities

（无——`theme-tokens`、`themed-preview`、`wechat-export` 的结构调整直接在尚未归档的 `theme-export` change 中同步更新，避免同一能力出现两份 delta。）

## Impact

- 代码：`src/shared/theme.ts`、`src/shared/theme-css.ts`、`src/shared/types.ts`、`src/shared/store-types.ts`、`src/main/db.ts`、`src/main/store.ts`、`src/main/theme-package.ts`、`src/main/zip.ts`、`src/main/ipc.ts`、`src/preload/index.ts`、`src/renderer/src/theme/*`、`src/renderer/src/hooks/useThemeLibrary.ts`、`src/renderer/src/hooks/useArticleTheme.ts`、`src/renderer/src/components/ThemePanel`、`src/renderer/src/components/ThemeManager`、`src/renderer/src/pages/Preview`。
- 依赖：无新增第三方依赖；主题包 zip 读写由主进程内置模块实现。
- 存储：schema v3 → v4，迁移为增量加列，不破坏已有文章与偏好。
