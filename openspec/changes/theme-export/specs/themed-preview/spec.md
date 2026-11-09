## Purpose

让预览成为公众号最终效果的忠实呈现：按主题 token 渲染，切换即时生效，不因切主题重建文档。

## ADDED Requirements

### Requirement: 预览按主题渲染

预览态正文 SHALL 按当前主题的 token 与 theme.css 渲染：token 写成 `.article-body` 上的 CSS 变量，应用 base.css 与主题 theme.css 合并后注入；用户在预览中看到的效果与导出后粘进公众号的效果同源，两条路径共用同一份 CSS。

#### Scenario: 预览即主题效果

- **WHEN** 预览态加载完成
- **THEN** 正文以当前主题的字体、颜色、块级样式呈现

### Requirement: SVG 样式导出

内嵌 SVG 的样式 SHALL NOT 只依赖元素的 `style` 属性；导出 SHALL 把安全的 `fill`、`fill-opacity`、`stroke`、`stroke-width`、`stroke-dasharray`、`font-*`、`text-anchor` 等声明提升为同名表现属性。旧文章快照若仍以 `style` 保存，导出时 SHALL 再提升一次，且不改写原快照。导出 SHALL 把只含实色 rect 的 mask 烘成标签底色矩形并移除 mask；只有 `viewBox` 的 SVG SHALL 补 `width`/`height`。嵌入字体被微信剥离时文字 SHALL 回退到系统字体，但位置、遮罩与线条 SHALL 保持。微信剥离 SVG `style` 后，矩形、描边、虚线与文字 SHALL 保持可见。

#### Scenario: 微信剥离 SVG style

- **WHEN** 导出含内嵌 SVG 的文章并在微信编辑器中粘贴
- **THEN** 图形按表现属性显示，不出现默认黑块、描边缺失或文字错色

#### Scenario: 标签遮罩导出

- **WHEN** SVG 用实色 rect mask 遮挡标签后的箭头或生命线
- **THEN** 导出烘成标签底色矩形并移除 mask，箭头和生命线不再穿过文字，SVG 补上宽高

#### Scenario: 旧快照导出

- **WHEN** 文章快照中的 SVG 仍使用 `style`
- **THEN** 导出时提升为表现属性，原快照保持不变

### Requirement: 页面背景

页面背景 SHALL 由 `page.backgroundColor` 控制。设置时预览 SHALL 把背景作用在 `.article-body` 并至少铺满手机阅读区；导出 SHALL 仅在该字段设置时写入外层 section 的 `background-color`。未设置时预览透明、导出不写背景，保留宿主深色模式。theme.css 的 `& { background-color }` SHALL 仍可覆盖。

#### Scenario: 设置页面背景

- **WHEN** 主题设置 `page.backgroundColor`
- **THEN** 预览正文区显示该背景并铺满阅读区，导出写入同一背景色

#### Scenario: 未设置页面背景

- **WHEN** 主题省略 `page.backgroundColor`
- **THEN** 预览透明，导出不写 `background-color`

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

正文中的代码块 SHALL 使用主题的代码块背景与圆角，外框 SHALL 由 `code.borderStyle` 决定。带标题的代码块 SHALL 在顶部增加标题条，标题左对齐，使用次级文字色、次级字号与等宽字体，标题条与代码区之间的 1px 分隔线 SHALL 由 `code.captionDivider` 控制线型和颜色。主题 SHALL 可在 theme.css 中用 `pre`、`.code-block` 与 `.code-block figcaption` 覆盖。预览与导出的代码块样式 SHALL 同源一致，导出所用属性 SHALL 在微信白名单内。

#### Scenario: 带标题代码块

- **WHEN** 正文包含带标题的代码块
- **THEN** 预览与导出的文件名均以等宽字体位于顶部标题条，标题与代码区之间按主题设置显示或隐藏分隔线

#### Scenario: 主题覆盖

- **WHEN** 主题的 theme.css 定义了 `pre`、`.code-block` 或 `.code-block figcaption` 规则
- **THEN** 卡片样式按主题规则渲染，预览与导出一致

#### Scenario: 无标题代码块

- **WHEN** 正文中的代码块没有标题
- **THEN** 预览与导出均按主题显示背景、圆角与外框，省略标题条和分隔线

### Requirement: 宽表横向滚动

正文中的表格 SHALL 包在带 1px 边框与代码块圆角的横向滚动容器中。外框 SHALL 由容器承担，滚动条 SHALL 位于边框内并使用浏览器原生样式。表格 SHALL 占满容器并允许单元格换行。容器 SHALL 带 `table-scroll` 标记，三列及以上额外带 `table-scroll-wide` 标记，默认在单元格设置 `5em` 最小宽度。主题 SHALL 可在 theme.css 中用这两个标记覆盖。容器放不下表格时 SHALL 在边框内横向滚动，页面 SHALL NOT 出现横向溢出。预览与导出 SHALL 共用该结构，导出所用属性 SHALL 在微信白名单内。

#### Scenario: 2 列表格

- **WHEN** 表格列数小于 3
- **THEN** 表格按容器宽度换行，不出现横向滚动条

#### Scenario: 窄屏短表与宽表

- **WHEN** 在 360px 手机宽度预览或呈现导出的雾紫正文，正文包含三列字词短表和六列表格
- **THEN** 三列短表 SHALL 完整展示。此前整表强制 600px 最小宽度，造成第三列在窄屏被遮挡。六列表格 SHALL 局部横滚，页面保持原宽度

#### Scenario: 桌面宽度

- **WHEN** 容器宽度足以容纳所有列
- **THEN** 表格占满容器，外框完整包住表格，不出现横向滚动条

#### Scenario: 导出保留滚动

- **WHEN** 导出包含表格的文章
- **THEN** 容器边框与局部滚动样式 SHALL 内联，三列及以上表格的最小宽度 SHALL 设在单元格

### Requirement: 导出值一致性

预览用 CSS 变量渲染的同时，SHALL 能把同一份 CSS 中的 `var(--fucha-*)` 解析成具体值交给导出——任何 token 值在预览与导出两条路径下 SHALL 解析为相同的最终样式，导出 CSS 不得残留 `var()`。

#### Scenario: 变量与具体值同源

- **WHEN** token 的 primary 颜色变化
- **THEN** 预览（CSS 变量路径）与导出（具体值路径）的对应样式同步变化且一致
