## Why

M1 的主题是只读内置预设，用户只能整体切换，不能基于现有主题调整，也没有地方保存自己的主题。M2 要把主题变成可编辑、可保存、可交换的数据：内置主题只读；自定义主题可在独立设置页原地编辑，所有引用文章同步更新；也可以另存为或从默认 token 完全自定义新建；配置页用固定示例文章实时预览。

本 change 同时完成主题系统从「单一 token 生成器」到「token + theme.css 两层模型」的结构迁移，因为面板、主题包和文章绑定都依赖这套契约。

## What Changes

- ThemeToken v1：h1–h6 移到顶层，每级有 `fontSize / fontWeight / lineHeight / textAlign / decoration / marginTop / marginBottom`；字段名对齐 CSS 属性（`quote.backgroundColor`、`borderColor`、`headingColor`、`table.headerBackgroundColor`、`table.padding`、`image.marginTop/marginBottom`、`code.inlineBackgroundColor`、`divider.borderTopStyle`、`divider.borderTopColor`、`divider.marginTop/marginBottom`）。
- 内置主题改为「token 默认值 + theme.css」，提供 `default`、`shujuan` 与 `qingci` 三套。内置主题只读，发布后的视觉升级新增 id 并保留旧 id。
- 公众号文章标题单独设置。内置主题的正文标题分两层：一级与二级标题使用同一套样式，三级至六级标题使用同一套子标题样式；两层之间以字号、字重或装饰区分。收紧页首留白，正文分割线改用细实线。
- 雾紫保留 14px 正文，缩小两侧内距以增加手机可用行宽。正文一级、二级标题同样式，三级至六级标题统一为 16px 子标题样式，表格线框调轻。代码块以底色划分区域，文件名下方用更淡的细线分隔。
- 将丹霞改造为「青瓷」，id 改为 `qingci`，并通过 schema v9 迁移已有文章的主题引用。以 `#8fae96` 竖条标出主节，搭配无衬线字形和中性墨文字层（正文 `#2f2f2f`、标题 `#262626`、次级 `#666666`）。三级至六级标题统一为无装饰子标题。引用、代码块、行内代码与表头共用浅苔底色，边框与线条使用同族浅绿。
- 标题内的粗体沿用标题字重和颜色。带图注的图片将段后留白放在图注下方，让图注贴近图片。
- 新增应用级 `base.css`（正文排版、引用、代码、表格、图片、分割线；行内代码与表格字号按正文 0.875 倍，代码块与引用字号独立可调，其余只引用 token 变量）与每主题 `theme.css`；预览与导出共用同一份 CSS，导出时解析 `var()` 后再 juice 内联。
- 新增主题 CSS 契约与 fail-closed 校验：只允许元素/类/后代选择器与微信安全属性，禁止伪类、`@` 规则、`!important`、外部资源与契约外变量，错误带行号。
- 新增设置页与主题管理。`/settings` 左侧是设置导航，右侧是主题列表与配置页。配置页以「示例」为预览标题，用《滕王阁序》节选与读序札记展示样式。配图以两侧山势、暖黄江天和薄云表现秋日落霞，淡淡的霞光映入江面。右侧提供 token 控件。
- 新增自定义主题原地保存：`updateTheme` 更新 token/css，所有引用文章同步换样；另存为生成新主题并记录来源，新建从默认 token 起、无来源。
- 内置主题只读，只能另存为；文章页主题下拉只负责选择与打开管理，历史栏右下角设置图标同入口。
- 新增应用级 `base.css`（正文排版、引用、代码、表格、图片、分割线；行内代码与表格字号按正文 0.875 倍，代码块与引用字号独立可调，其余只引用 token 变量）与每主题 `theme.css`；预览与导出共用同一份 CSS，导出时解析 `var()` 后再 juice 内联。
- 新增主题 CSS 契约与 fail-closed 校验：只允许元素/类/后代选择器与微信安全属性，禁止伪类、`@` 规则、`!important`、外部资源与契约外变量，错误带行号。
- 新增主题配置控件：按颜色、排版、代码分组，排版包含正文、标题、引用、表格、图片、分割线；颜色用取色器、数值用输入与步进，示例预览实时反映；`次级字号` 只控制图注与上下标，行内代码与表格按正文 0.875 倍缩放。
- 代码块与引用新增字号：`code.fontSize` 初始统一 13px，`quote.fontSize` 初始等于正文字号；代码 tab 与排版引用组各加字号控件。
- 页面 tab 新增可选页面背景色 `page.backgroundColor`：未设置时透明/跟随页面，设置后预览铺满阅读区、导出写入外层 section；`theme.css` 的 `&` 仍可覆盖。
- 排版的引用组提供「装饰」下拉，通过 `quote.decoration` 切换「无」和「左条」。青瓷通过该字段关闭左条。
- 各内置主题单独设置文件名分隔线的默认色。代码设置通过「样式」与「颜色」调整文件名分隔线，对应 `code.captionDivider`。示例代码块带文件名并实时显示变化。
- 单字段重置：控件偏离打开时的保存值时显示重置图标，只恢复该字段；预览样张补行内代码与上下标，分别验证块底色与次级字号。
- 颜色精确输入与对比度提示：点击色块打开取色弹层（`@uiw/react-color` 的 Sketch，关闭 alpha），Hex/RGB 字段可输入或粘贴；正文色/次级文字色与相关底色的对比度低于 4.5:1 时行内提示但不阻止保存；说明通过 `aria-describedby` 关联输入。
- 块底色与表头背景色拆开：新增 `table.headerBackgroundColor`，颜色 tab 单独配置。
- 引用与行内代码背景色拆开：颜色 tab 的「块底色」拆为「引用背景色」与「行内代码背景色」；引用背景存于 `quote.backgroundColor`，行内代码背景独立存储为 `code.inlineBackgroundColor`。
- 新增 `divider.borderTopColor`，在颜色 tab 单独配置分割线色。书卷的表格使用浅暖灰边框，代码块用浅纸色底并去掉外框。
- 新增自定义主题管理：设置页列表支持导入、导出、删除，改名在配置页随保存提交；主题名称全局唯一，重名的新建、导入与改名被拒绝；被文章引用的主题拒绝删除。
- 新增 `.article-theme` 主题包（`theme.json` + `theme.css`）导入导出；导入校验 token、CSS、zip 结构与文件完整性，id 冲突或内置 id 拒绝。
- 本地存储 schema v9 不新增表或字段：v9 迁移把内置主题 id 从 `danxia` 统一为 `qingci`，同步文章 `theme_id`、`themes.source_theme_id` 与 `theme.active`。`themes` 已有 `css`、`token_version`、`source_theme_id`；自定义主题可更新 token/css，另存为与新建创建新行。
- 文章快照写入本地存储，切换主题只更新 `articles.theme_id`，并记住 `theme.active` 作为新文章默认主题；编辑当前主题会让引用它的文章同步换样。

不在本 change 范围：token 自动生成（取主色/自动选预设）、历史侧栏界面、应用内 CSS 编辑器、批量把文章迁移到新主题。

## Capabilities

### New Capabilities

- `theme-panel`: 主题选择、设置页主题列表、示例预览与 token 配置、编辑/另存为/完全自定义新建。
- `theme-persistence`: 可编辑的自定义主题、文章主题绑定、默认主题偏好与内置主题保护。
- `theme-packages`: `.article-theme` 主题包导入导出与 fail-closed 校验。

### Modified Capabilities

（无——`theme-tokens`、`themed-preview`、`wechat-export` 的结构调整直接在尚未归档的 `theme-export` change 中同步更新，避免同一能力出现两份 delta。）

## Impact

- 代码：`src/shared/theme.ts`、`src/shared/theme-css.ts`、`src/shared/types.ts`、`src/shared/store-types.ts`、`src/main/db.ts`、`src/main/store.ts`、`src/main/theme-package.ts`、`src/main/zip.ts`、`src/main/ipc.ts`、`src/preload/index.ts`、`src/renderer/src/theme/*`、`src/renderer/src/hooks/useThemeLibrary.ts`、`src/renderer/src/hooks/useArticleTheme.ts`、`src/renderer/src/components/ThemePanel`、`src/renderer/src/components/Sidebar`、`src/renderer/src/pages/Settings`、`src/renderer/src/pages/Preview`；移除 `ThemeManager` 弹窗。
- 依赖：无新增第三方依赖；主题包 zip 读写由主进程内置模块实现。
- 存储：schema v9 只做主题 id 迁移，不新增表或字段；新增 `updateTheme` IPC。
