## Purpose

从抓取的 HTML 中提取正文与元信息，净化后产出结构化的文章数据（Article 契约）。提取决定预览质量，净化保证进入渲染的内容安全。

## ADDED Requirements

### Requirement: 提取正文与元信息

系统 SHALL 从页面 HTML 中提取正文内容与元信息（标题、作者、发布时间、封面，存在即取），产出文章数据；缺失的元信息 SHALL 留空，不阻断流程。

#### Scenario: 标准文章页

- **WHEN** 输入为结构正常的文章页面 HTML
- **THEN** 提取出正文内容与标题

#### Scenario: 元信息缺失

- **WHEN** 页面不包含作者或发布时间
- **THEN** 对应字段为空，正文预览正常进行

### Requirement: 提取置信度判断

系统 SHALL 对提取结果做置信度判断：正文过短或提取失败时 SHALL 标记为不支持，并给出明确错误，不得渲染空白或无关内容。

#### Scenario: 非文章页

- **WHEN** 输入为站点首页或登录页等无正文的页面
- **THEN** 返回提取失败错误，界面提示该链接不支持

### Requirement: 内容净化

正文进入渲染前 SHALL 完成净化：移除脚本节点、事件属性与危险协议链接（如 javascript:），预览 SHALL 不执行任何来自源页面的脚本。

#### Scenario: 脚本被移除

- **WHEN** 源页面 HTML 包含 script 节点或内联事件属性
- **THEN** 净化后的内容不含可执行脚本，预览不触发任何源页面脚本

#### Scenario: 危险协议降级

- **WHEN** 正文含 javascript: 等危险协议链接
- **THEN** 该链接被移除或降级为纯文本

### Requirement: 内嵌 SVG 安全保留

正文中的内嵌 SVG SHALL 保留静态矢量结构，包括图形、路径、文本、渐变与本地引用；SVG SHALL 可正常显示且不超出正文宽度。SVG 内部及页面级 `<style>` 中匹配 SVG 的安全 presentation 属性 SHALL 在提取前内联到对应图形，并与元素原有内联样式按属性合并；最终正文 SHALL 不保留这些 `style` 标签或 class。净化 SHALL 移除 SVG 内的脚本、事件属性、动画、`foreignObject`、嵌套位图、`use`、外部 `href`、非本地 `url()` 与不安全 CSS。曾因白名单整体禁止 `svg` 导致图形消失，后续又因 Readability 清理 `<style>` 与 class、以及内联样式覆盖已计算颜色，导致 `rect` 回落默认黑色；最终实现 SHALL 使用独立 SVG 白名单，在提取前完成安全样式合并。

#### Scenario: 静态图形保留

- **WHEN** 正文包含由 `svg`、`path`、`rect`、`text` 与本地 `linearGradient` 组成的图形
- **THEN** 预览保留图形结构、文本、渐变与尺寸，且 SVG 不超出正文宽度

#### Scenario: 内部样式上色

- **WHEN** SVG 的 `rect` 仅通过内部 class 规则获得 `fill`
- **THEN** 该颜色在提取前内联到 `rect`，预览显示规则颜色而非 SVG 默认黑色

#### Scenario: 可执行与外部内容移除

- **WHEN** 内嵌 SVG 包含脚本、事件属性、动画、外部图片、外部渐变引用或 `foreignObject`
- **THEN** 上述内容全部被移除，预览不执行源页面脚本、不加载外部 SVG 资源

### Requirement: 来源信息保留

净化 SHALL 保留正文语义结构（段落、标题、列表、引用、代码块、表格、图片），且文章保留原始来源链接与作者信息，供界面固定展示与导出附来源行。

#### Scenario: 结构保留

- **WHEN** 正文包含段落、代码块与表格
- **THEN** 净化产出保留这些元素及其内容

#### Scenario: 来源可溯源

- **WHEN** 文章数据产出
- **THEN** 数据中包含原始来源 URL 与作者（如页面提供）
