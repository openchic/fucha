## Purpose

定义主题 token 的固定结构与单位约定，作为预览渲染与导出内联的共同数据源。token 是纯数据，预览、导出、持久化、生成共用同一形状。

## ADDED Requirements

### Requirement: 主题 token 固定结构

系统 SHALL 以固定结构的 ThemeToken 描述主题，按组组织：text（正文字号、次级字号、行高倍数、字距 em、段距 px、正文色、次要色）、primary、borderColor、headingColor、page（上、右、下、左页边距 px）、顶层 h1–h6（每级字号、字重、行高、对齐、装饰、上下间距）、quote（背景色、字号、装饰、上下内距、左右内距、圆角）、code（hljs 主题名、字号、行高、上下内距、左右内距、代码块圆角、行内代码圆角、行内代码背景色、边框样式、文件名分隔线）、table（表头背景色、上下内距、左右内距）、image（上下外边距、圆角）、divider（borderTopStyle、borderTopColor、上下外边距）。强调文字继承正文色，行内代码与表格按正文 0.875 倍缩放，代码块使用 code.fontSize，引用使用 quote.fontSize，图注与上下标共用 secondaryFontSize，引用背景使用 quote.backgroundColor，行内代码使用 code.inlineBackgroundColor，表头使用 table.headerBackgroundColor，表格边框使用 borderColor，分割线使用 divider.borderTopColor，标题装饰与引用边条共用 primary，图注使用 secondaryColor，不另设重复 token。字段名 SHALL 对齐 CSS 属性名。代码块边框样式只允许 solid / dashed / none；边框颜色继续使用 borderColor。分割线样式只允许 solid / dashed / none。预览画布的 contentWidth 是固定常量，不属于 token；页面四边距由 page token 控制。数值字段 SHALL 携带取值范围（控件与校验共用边界），具体范围由 THEME_RANGES 统一维护。标题颜色统一使用 headingColor。字族、页面底色等根级表现 SHALL 由 theme.css 的 `&` 根规则表达，不进入 token。

#### Scenario: 合法 token 通过校验

- **WHEN** 提供一份字段齐全、数值在约定范围内的 token
- **THEN** 校验通过，可用于渲染

#### Scenario: 引用背景色归入 quote

- **WHEN** 读取或校验 ThemeToken
- **THEN** 引用背景色位于 `quote.backgroundColor`，顶层不存在 `backgroundColor`，主题 CSS 使用 `--fucha-quote-background-color`

#### Scenario: 字号初始值不联动

- **WHEN** 主题的 `text.fontSize` 或 `code.hljsTheme` 改变
- **THEN** 已保存的 `quote.fontSize` 与 `code.fontSize` 保持不变

#### Scenario: 越界被拒

- **WHEN** fontSize 为 10
- **THEN** 校验不通过并给出可读原因

#### Scenario: 预览宽度不进 token

- **WHEN** 读取或导出 ThemeToken
- **THEN** contentWidth 不出现在 token 或导出产物中

#### Scenario: 引用装饰的取值与兼容

- **WHEN** 系统读取主题 token
- **THEN** `quote.decoration` SHALL 接受 `bar` 和 `none`。缺少字段时 SHALL 按 `bar` 读取，其他值 SHALL 被拒绝。主题保存及导入导出 SHALL 保留已设置的装饰

#### Scenario: 文件名分隔线的取值与兼容

- **WHEN** 系统读取主题 token
- **THEN** `code.captionDivider.borderBottomStyle` SHALL 接受 `solid`、`dashed` 或 `none`，缺省为 `solid`。可选的 `borderBottomColor` SHALL 校验为颜色，缺省跟随 `borderColor`。主题保存及导入导出 SHALL 保留已设置的线型和线色

### Requirement: 内置预设可用

系统 SHALL 内置多套主题，每套由 token 默认值与 theme.css 组成，共用同一 token 接口。`default` 面向技术长文，`shujuan` 使用衬线字族和暖色调，`danxia` 显示为「苔青」，通过 token 设置苔绿色标题竖条。内置主题只读，发布后的视觉升级通过新增 id 保留旧版本。应用首次使用 SHALL 无需任何配置即以 `default` 渲染。

#### Scenario: 零配置默认主题

- **WHEN** 应用首次启动进入预览
- **THEN** 预览以内置技术长文预设渲染

#### Scenario: 代码块与表格完整表达

- **WHEN** 正文包含代码块与表格
- **THEN** 预设对两者均有可辨识的视觉处理（背景、边条、表头色）
