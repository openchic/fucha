## Purpose

把净化后的正文转成微信编辑器可无损接受的内联样式 HTML：样式落到元素 style 属性、图片内联、不支持的能力提前降级，最终一键复制或保存。

## ADDED Requirements

### Requirement: 导出内联样式 HTML

系统 SHALL 产出所有样式均落在元素 style 属性上的 HTML（经 juice 内联），微信编辑器粘贴后不依赖 style 标签与 class 选择器；预览与导出 SHALL 共用同一份 CSS 生成函数，导出路径输出解析后的具体值（juice 不解析 CSS 变量）。

#### Scenario: 粘贴不改格式

- **WHEN** 导出产物粘贴进微信公众号编辑器
- **THEN** 标题、列表、引用、代码块、表格、分割线按主题呈现，无样式丢失

#### Scenario: 无外部样式依赖

- **WHEN** 检查导出 HTML
- **THEN** 不含 style 标签选择器依赖，元素样式均可内联溯源

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

### Requirement: 来源行附加

导出产物末尾 SHALL 自动附加来源行（含原文链接与作者，如文章数据提供），原文外链 SHALL 转为脚注式呈现，不放正文内可点链接。

#### Scenario: 来源行存在

- **WHEN** 导出任意文章
- **THEN** 产物末尾包含来源行，链接以脚注形式呈现

### Requirement: 一键复制与保存

系统 SHALL 提供一键复制内联 HTML 到剪贴板，并提供保存为 HTML 文件；两者产物 SHALL 一致。

#### Scenario: 一键复制

- **WHEN** 用户点击复制
- **THEN** 剪贴板内容为内联 HTML，粘贴进微信编辑器格式正确

#### Scenario: 保存文件

- **WHEN** 用户选择保存
- **THEN** 得到与剪贴板产物一致的 HTML 文件

### Requirement: 兼容性回归清单

系统 SHALL 附带微信兼容性检查清单（标题、列表、引用、代码块、表格、图片、分割线，另含深色模式代码块配色、图片宽度降级两项实测），微信规则变化时 SHALL 可快速重跑。

#### Scenario: 清单可重跑

- **WHEN** 按清单逐项验证一次导出产物
- **THEN** 每项有明确的通过/失败记录
