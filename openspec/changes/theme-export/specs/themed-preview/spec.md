## Purpose

让预览成为公众号最终效果的忠实呈现：按主题 token 渲染，切换即时生效，不因切主题重建文档。

## ADDED Requirements

### Requirement: 预览按主题渲染

预览态正文 SHALL 按当前主题的 token 与 theme.css 渲染：token 写成 `.article-body` 上的 CSS 变量，应用 base.css 与主题 theme.css 合并后注入；用户在预览中看到的效果与导出后粘进公众号的效果同源，两条路径共用同一份 CSS。

#### Scenario: 预览即主题效果

- **WHEN** 预览态加载完成
- **THEN** 正文以当前主题的字体、颜色、块级样式呈现

### Requirement: 切换即时生效

切换主题 SHALL 即时生效于预览，不重新解析文档、不重置图片与滚动状态。主题选择控件 SHALL 位于文章信息带的元信息行右侧操作区（与刷新、复制同一行），显示当前主题名与下拉箭头；列表为内置主题与自定义主题，底部提供编辑与管理动作。

#### Scenario: 切主题不闪断

- **WHEN** 预览态下切换主题
- **THEN** 样式立即变化，文档内容与滚动位置不变

#### Scenario: 文章信息带内切换

- **WHEN** 用户在文章信息带的主题下拉中选择主题
- **THEN** 预览即时切换且滚动位置不变

### Requirement: 手机预览面板

预览态 SHALL 在复制按钮左侧提供手机预览开关。开启后正文区 SHALL 复用主题配置页的设备预览面板：右上角设备下拉（默认 iPhone 18 Pro，可切 iPhone 16、iPhone SE、Pixel 7、Galaxy S21）、raised 预览区与 28px 圆角手机画布，且不显示「示例文章」标题。开关只影响预览呈现，不改变当前主题、导出与复制产物。

#### Scenario: 开关手机预览

- **WHEN** 用户点击手机预览开关
- **THEN** 正文区在平铺阅读与设备预览面板之间切换，默认画布为 iPhone 18 Pro

#### Scenario: 切换预览设备

- **WHEN** 用户在面板右上角选择其他设备
- **THEN** 画布宽高切到对应尺寸，正文与主题不变

### Requirement: 代码块卡片

正文中的代码块 SHALL 统一呈现为带 1px 外框与代码块圆角的卡片。带标题的代码块 SHALL 在卡片顶部增加标题条，标题左对齐，使用次级文字色、次级字号与等宽字体，标题条与代码区之间以 1px 分隔线相接；无标题的代码块 SHALL 只呈现卡片外框，不生成标题条或分隔线。卡片 SHALL 使用现有 token（次级色、次级字号、边框色、代码内边距与代码块圆角）表达，不新增 token；主题 SHALL 可在 theme.css 中用 `pre`、`.code-block` 与 `.code-block figcaption` 覆盖。预览与导出的卡片样式 SHALL 同源一致，导出所用属性 SHALL 在微信白名单内。

#### Scenario: 带标题代码块

- **WHEN** 正文包含带标题的代码块
- **THEN** 预览与导出都显示带外框的代码卡片，文件名以等宽字体位于顶部标题条，标题与代码区之间有分隔线

#### Scenario: 主题覆盖

- **WHEN** 主题的 theme.css 定义了 `pre`、`.code-block` 或 `.code-block figcaption` 规则
- **THEN** 卡片样式按主题规则渲染，预览与导出一致

#### Scenario: 无标题代码块

- **WHEN** 正文中的代码块没有标题
- **THEN** 代码块仍显示同样的 1px 外框与圆角，但不出现标题条或分隔线

### Requirement: 宽表横向滚动

正文中的表格 SHALL 包在带 1px 边框与代码块圆角的横向滚动容器中。表格外圈边框 SHALL 由容器承担，表格 SHALL 只保留内部行列线；滚动条 SHALL 位于容器边框内，使用浏览器原生样式，不自定义、不隐藏。列数 ≥3 的表格 SHALL 具有 600px 的最小宽度，容器不足时在边框内横向滚动，页面 SHALL NOT 出现横向溢出；列数 <3 的表格 SHALL NOT 强制最小宽度，按容器宽度换行且不出现横向滚动条。容器宽度足够时，表格 SHALL 占满容器且不出现横向滚动。容器 SHALL 带 `table-scroll` 标记，宽表额外带 `table-scroll-wide` 标记；主题 SHALL 可在 theme.css 中用 `.table-scroll` / `.table-scroll-wide` 覆盖。预览与导出 SHALL 共用该结构；导出所用属性 SHALL 在微信白名单内。

#### Scenario: 2 列表格

- **WHEN** 表格列数小于 3
- **THEN** 表格按容器宽度换行，不出现横向滚动条

#### Scenario: 3 列及以上表格

- **WHEN** 表格列数大于等于 3 且容器宽度小于 600px
- **THEN** 表格在带边框的容器内横向滚动，滚动条位于边框内，页面不横向溢出

#### Scenario: 桌面宽度

- **WHEN** 容器宽度大于 600px
- **THEN** 表格占满容器，外框完整包住表格，不出现横向滚动条

#### Scenario: 导出保留滚动

- **WHEN** 导出包含表格的文章
- **THEN** 导出结果的容器边框保留；宽表保留 600px 最小宽度与横向滚动，2 列表格不强制最小宽度

### Requirement: 导出值一致性

预览用 CSS 变量渲染的同时，SHALL 能把同一份 CSS 中的 `var(--fucha-*)` 解析成具体值交给导出——任何 token 值在预览与导出两条路径下 SHALL 解析为相同的最终样式，导出 CSS 不得残留 `var()`。

#### Scenario: 变量与具体值同源

- **WHEN** token 的 primary 颜色变化
- **THEN** 预览（CSS 变量路径）与导出（具体值路径）的对应样式同步变化且一致
