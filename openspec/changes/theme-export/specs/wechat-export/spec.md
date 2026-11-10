## Purpose

把净化后的正文转成微信编辑器可无损接受的内联样式 HTML：样式落到元素 style 属性、图片内联、不支持的能力提前降级，最终一键复制。

## ADDED Requirements

### Requirement: 导出内联样式 HTML

系统 SHALL 产出所有样式均落在元素 style 属性上的 HTML（经 juice 内联），微信编辑器粘贴后不依赖 style 标签与 class 选择器；预览与导出 SHALL 共用 base.css 与主题 theme.css，导出路径先把所有 token 变量替换成具体值（juice 不解析 CSS 变量），再执行内联。

#### Scenario: 粘贴不改格式

- **WHEN** 导出产物粘贴进微信公众号编辑器
- **THEN** 标题、列表、引用、代码块、表格、分割线按主题呈现，无样式丢失

#### Scenario: 无外部样式依赖

- **WHEN** 检查导出 HTML
- **THEN** 不含 style 标签选择器依赖，元素样式均可内联溯源

### Requirement: 导出外层页边距

导出产物外层 section SHALL 应用页面 token 的四边内距；页面 token 的左右内距默认 0，只表达额外内距。微信正文自带的左右留白由平台提供，SHALL NOT 重复计入 token。预览画布 SHALL 在 token 内距之外固定加入平台左右留白，模拟真实阅读页。

#### Scenario: 公众号预览左右留白

- **WHEN** 导出并粘贴到微信公众号编辑器预览
- **THEN** 正文左右留白为平台固定留白加 token 额外内距，默认不出现两层边距叠加导致的过宽留白

### Requirement: 代码高亮

导出与预览 SHALL 对代码块做语法高亮（highlight.js，class 输出由内联步骤转 style），代码块 SHALL 横向可滚动不折行。

#### Scenario: 代码块高亮且不折行

- **WHEN** 正文含多语言代码块
- **THEN** 高亮色以内联样式呈现，长行横向滚动

### Requirement: 图片内联

导出时正文图片 SHALL 转为 base64 内联（微信编辑器粘贴时自动转存），单图超过 5MB SHALL 跳过并降级处理，不产出超限产物。

#### Scenario: 图片内联成功

- **WHEN** 导出含已下载图片的文章
- **THEN** 图片以 base64 data URI 呈现在导出 HTML 中

#### Scenario: 超限降级

- **WHEN** 一张图片超 5MB
- **THEN** 该图跳过内联并按失败降级处理，导出继续完成

### Requirement: 微信白名单降级

导出前 SHALL 过微信支持白名单：不支持的能力（position、float、伪元素、grid）提前降级为微信安全的等价实现或移除，产物不携带微信会剥离或错乱的样式。

#### Scenario: 不支持能力降级

- **WHEN** 正文样式含微信不支持的属性
- **THEN** 降级为安全实现（如表格布局、section 拼装），导出后不错乱

### Requirement: 预览与导出结构一致

预览稿与导出稿 SHALL 共用正文 DOM 归一：都移除与信息带标题重复的首个 h1/h2，并把引用块最后一个子元素的段后距归零。除图片传输方式、正文链接降级与样式内联形态外，两条路径的正文结构与文本 SHALL 保持一致。

#### Scenario: 结构差异被归一

- **WHEN** 文章正文以与标题相同的 h1 开头，或引用块包含多个段落
- **THEN** 预览与导出都不重复显示首标题，引用块末段间距一致

### Requirement: 一键复制

系统 SHALL 在文章信息带的元信息行右侧操作区末位提供复制图标按钮，带可访问名称与忙碌状态，一键复制内联 HTML 到剪贴板。

#### Scenario: 一键复制

- **WHEN** 用户点击文章信息带的复制按钮
- **THEN** 剪贴板内容为内联 HTML，粘贴进微信编辑器格式正确

### Requirement: 兼容性回归清单

系统 SHALL 附带微信兼容性检查清单（标题、列表、引用、代码块、表格、图片、分割线，另含深色模式代码块配色、图片宽度降级两项实测），微信规则变化时 SHALL 可快速重跑。

#### Scenario: 清单可重跑

- **WHEN** 按清单逐项验证一次导出产物
- **THEN** 每项有明确的通过/失败记录
