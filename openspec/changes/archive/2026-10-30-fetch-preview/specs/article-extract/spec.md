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

### Requirement: 来源地址归一

已确认的用户可见现象是 GitHub 文档预览中的 25 张图片全部裂图。根因是提取器没有以 finalUrl 设置文档 base，相对图片地址被解析到应用自身地址（`localhost:5173`），下载与显示都指向不存在的资源。提取 SHALL 在 Readability 之前以 finalUrl 设置文档 base，正文中的相对图片与链接 SHALL 解析为来源站点的绝对地址。

#### Scenario: 相对图片与链接

- **WHEN** 文章 HTML 使用 `/assets/a.png` 与 `/post/2` 这类相对地址
- **THEN** 提取结果中的图片与链接均为 finalUrl 下的绝对地址

### Requirement: 微信隐藏正文容器

已确认的用户可见现象是微信公众号文章预览只剩「原创…不喜欢」等页脚碎片。根因是来源页把 `#js_content` 以内联 `visibility: hidden` 隐藏，Readability 将整块正文判为不可见。系统 SHALL 在提取前解除微信正文容器的内联隐藏，正文与图片清单 SHALL 来自该容器。

#### Scenario: 真实公众号文章

- **WHEN** 抓取到的微信文章正文容器带有内联隐藏
- **THEN** 提取出完整正文与图片清单，不把页脚碎片当作正文

### Requirement: 站点导航清理

已确认的用户可见现象是 MDN 预览开头出现「基线 / 广泛可用」块、Node.js 代码块尾部出现「javascript」标签，Josh Comeau 的交互 demo 控件与插图进入正文。根因是这些节点属于站点导航或交互组件，但仍被 Readability 计入正文。站点差异 SHALL 集中在 profiles 域名表，并提供提取前移除与提取后移除两类选择器；主管线 SHALL NOT 按域名分支。提取后移除的组件 SHALL 先标记、提取后再删除，避免提前删除改变正文判定。

#### Scenario: 文档站导航

- **WHEN** 来源页包含基线条、代码工具栏等导航或交互控件
- **THEN** 最终正文不包含这些控件的文字或标签

#### Scenario: 交互 demo

- **WHEN** 来源页用 `data-demo-unit` 标记交互 demo
- **THEN** 该 demo 不进入正文；未标记的交互插图若仍进入正文，记录为已知限制

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

### Requirement: 保留安全的 SVG 标题

已确认的用户可见现象是 D2 图表中的「DeepSeek Harness」标题在预览中消失，补回后又与原图字体及标题线不一致。根因是转换器只接受标题及其祖先节点完全没有其它子元素的 `foreignObject`；标题旁有装饰节点或标题内使用简单行内标签时，转换会被跳过，随后净化器移除整个 `foreignObject`。转换器此前也丢弃了标题继承的安全字体和边框样式，改用固定粗体字体及参数重画标题线；来源自定义字体也曾被净化器剥离，保留的字体族名称因此回退到系统字体。提取 SHALL 在移除该容器前，将只含一个纯文本标题的内容转换为静态 SVG 文字，沿用来源中的安全字体、字号、字重、字形、颜色和标题边框样式；只保留 SVG 实际引用且来源为受限 `data:` URL 的内嵌字体。应用 SHALL 通过 CSP 允许 `font-src 'self' data:`。允许空白文本和无可见文本的装饰节点，标题可由安全行内标签包裹。其它可见文字、复杂或混合内容仍按原规则完整移除，不保留 HTML 子树、来源样式表或外部资源。

#### Scenario: 纯文本 SVG 标题

- **WHEN** 静态 SVG 的 `foreignObject` 只包含一个纯文本 `h1` 到 `h6` 标题，可有安全行内标签及无可见文本的装饰节点
- **THEN** 预览显示对应的 SVG 文字及其安全来源字体样式，`h1` 的标题线沿用来源边框样式，来源自定义字体可加载，原 `foreignObject` 仍被移除

### Requirement: 保留 SVG 多行文字位置

已确认的用户可见现象是 DeepSeek Harness 图表中节点文案的多行文字重叠。样例用 `<tspan dy="18.5">` 表示相对行距；单纯放宽位移属性白名单不能稳定保留提取后的排版。提取 SHALL 在净化前将简单 SVG 文本中的数值相对 `dy` 转成绝对 `y` 坐标，并且只在 SVG `text` / `tspan` 上保留安全数值位移列表；其他元素及非数值位移仍须移除。

#### Scenario: 多行节点文案

- **WHEN** SVG 文本使用简单的 `<text y>` 与直接子 `<tspan dy>` 定位多行内容
- **THEN** 提取结果为各行写入明确的 `y` 坐标并保留行间距；非文本节点上的位移属性与非数值位移不会通过净化

### Requirement: 来源信息保留

净化 SHALL 保留正文语义结构（段落、标题、列表、引用、代码块、表格、图片），且文章保留原始来源链接与作者信息，供来源记录与导出使用；预览信息带固定展示来源链接，不展示作者信息。

#### Scenario: 结构保留

- **WHEN** 正文包含段落、代码块与表格
- **THEN** 净化产出保留这些元素及其内容

#### Scenario: 来源可溯源

- **WHEN** 文章数据产出
- **THEN** 数据中包含原始来源 URL 与作者（如页面提供）
