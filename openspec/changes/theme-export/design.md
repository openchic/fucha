## Context

依赖 change 1 的 Article 契约、净化管道与预览态宿主。本 change 对应里程碑 M1，核心风险在"预览与导出两条渲染路径的一致性"，设计围绕这个风险展开。

## Goals / Non-Goals

**Goals:**

- 预览即公众号所见效果（同源 CSS 生成）
- 导出产物粘进公众号后台不改格式
- 兼容性清单可重跑，作为回归基线

**Non-Goals:**

- 主题编辑面板与自定义主题持久化（change 3）
- 素材库 API、多平台导出
- 其他提取质量优化（站点导航、正文判定等）仍属 change 1 的 article-extract 范畴；本 change 只增加 Rspress 代码块标题归一

## Decisions

机制与常量以 docs/design.md 的「主题系统」「导出」为准，本文只保留本 change 特有的取舍：

**CSS 生成函数单源，双输出。** 备选两套样式各自维护：必然漂移，否。

**高亮选 highlight.js 而非 shiki。** 同步、体积轻，微信只认内联样式，TextMate 级高亮精度收益趋零。

**图片 base64 放导出末端。** 不在净化阶段做，保持 Article.html 可复用于预览与导出；超限或失败降级占位。

**微信降级分两层。** 结构层白名单与样式层属性表各自可单测。

**导出不附来源行。** 来源只在预览信息带展示；导出产物只保留正文与图片，不追加作者或原文脚注，避免正文结尾多出一段非文章内容。

**剪贴板走主进程写 HTML。** 渲染进程 Clipboard API 的跨平台行为不可控，否；保存按钮已移除，只保留复制入口。

**预览与导出共用正文 DOM 归一。** 两条路径都先经过 `normalizeArticleDom`：移除与信息带标题重复的首个 h1/h2，并把引用块最后一个子元素的段后距归零。之后只保留必要的传输差异：预览把图片换成 `fucha://` 并用 CSS 变量，导出把链接降级为文本、用 juice 内联样式并把图片转 base64。这样预览与复制稿的正文结构一致，只有样式形态不同。

**主题选择控件按主题列表扩展。** M1 先接内置主题；M2 在同一控件中加入自定义主题、编辑与管理入口。

**主题选择用项目内 Dropdown，不用原生 select。** 原生 select 的箭头与描边药丸在元信息行的控件里视觉最重，和复制按钮抢层级，平台打开行为也不一致。自定义组件把触发降为文字按钮（宽度随内容、悬停才出浅底），菜单用 1px 淡线和药丸选项；支持点击外部、Esc 关闭、方向键移动与选中态勾选，供 M2 多预设直接复用。

**预览样式由 base.css 与主题 theme.css 合并生成，M0 的 article.css 基线移除。** 预览注入的 `<style>` 把 token 写成 `.article-body` 上的变量并附加作用域后的 base.css、装饰规则、hljs 语法色与 theme.css；导出路径使用同一份 CSS，先把变量解析成具体值再用 juice 内联。正文 HTML 不重建，只替换 style 内容，因此滚动位置不变。

**手机预览复用设备预览组件。** 主题配置页与文章页共用 `PhonePreview`：设备下拉、raised 预览区与 28px 圆角画布；主题配置页传「示例文章」标题，文章页不传标题。开关放在复制按钮左侧，打开后面板占据正文区，默认设备 iPhone 18 Pro，可切五种设备；导出与快照保存仍按原内容走，不受开关影响。

**导出外层加 section 承载基础排版。** 微信正文会继承客户端字体与颜色，导出 CSS 若不显式给出基础字体、字号、行高、字距和颜色，预览与微信两端会分叉。导出产物在 juice 与属性过滤后用 section 包裹，section 的 inline style 与预览 `.article-body` 同源；文章元素规则仍负责各自的排版。页面 token 的内距按四边输出，但左右默认 0：微信正文自带左右留白，token 只表达额外的页面缩进，避免默认主题再把两侧撑宽。预览画布在 token 四边内距之外固定加入 `PLATFORM_SIDE_PADDING`（20px）左右留白，模拟公众号阅读页；因此预览看到的总留白与导出后平台提供的基础留白一致。

**引用块导出用 section 承载。** 微信会给 `<blockquote>` 叠加默认左条，和主题左边条并成双线；导出把 blockquote 换成带相同内联样式的 section，保留背景、内距、圆角、左边条和末段间距。预览仍使用 blockquote。

**列表首项粗体改为行内 span 并包进无外边距 p。** 微信保存会把 `<li>` 开头的 `<strong>/<b>` 识别成术语，并把后续内容包进块级 `<section>`，说明因此另起一行；导出把首项粗体换成带 `font-weight:700` 的 span，并把整项内容包进 `style="margin:0"` 的 p，让微信的 section 包住整段，视觉不变、列表保持单行。预览不替换。

**代码块长行保留横向滚动。** 实机反馈经历两次修正：只给 `pre` 内联 `white-space: pre` / `overflow-x: auto` 并豁免 `max-width` 后，公众号仍折行且没有滚动条；改成 `code` 滚动容器 + `<br>` 换行 + 不可折叠空格后滚动条出现，但行内空格与中文仍会折行。根因是微信保存时会重写空白并让 `white-space` 失效，行宽必须由结构决定而不是靠换行属性。最终做法：按行拆成 `width: max-content` 的块，`code` 作为横向滚动容器（`display: block` / `overflow-x: auto`），空格与缩进用不可折叠空格，`pre` 及其子元素豁免 `max-width`。每行宽度由内容决定，即使 `white-space` 被丢弃也不会折行；`code` 再用 `width: max-content` 撑到最宽行，让滚动条回到 `pre` 底部，与预览一致；若微信丢掉该宽度则回退到 `code` 自身滚动。纯文本兜底按行块补换行。仍需实机确认触摸滑动；若仍被裁切，回退自动换行。

**代码块空白以不可折叠空格导出。** 高亮后的空格常落在 span 内，微信保存会裁掉 span 前后的空白，导致 token 粘连、缩进消失；导出时把 `pre code` 文本里的空格替换为不可折叠空格，纯文本兜底再还原为普通空格。预览不使用该替换，保持正常可复制文本。

**SVG 样式导出提升为表现属性。** 微信会剥离 SVG 元素的 `style`；sanitize 与导出阶段把安全的 `fill`、`stroke`、`stroke-dasharray`、`font-*` 等声明提升为同名表现属性，旧快照在导出时再处理一次且不改写原快照。导出还会把只含实色 rect 的 mask 烘成标签底色矩形并移除 mask，给只有 viewBox 的 SVG 补宽高；嵌入字体被微信剥离时回退系统字体，但标签位置、遮罩和线条保持。矩形不再回退黑底，虚线与文字保留。

**页面背景走 token，导出按设置写外层。** 预览把 `page.backgroundColor` 写成 `.article-body` 的背景并保证至少铺满阅读区；导出只在字段存在时给外层 section 写 `background-color`，未设置时保持透明以跟随微信深色模式。theme.css 的 `& { background-color }` 仍然后写覆盖。

**正文外链在导出时降级为文本。** 微信正文不保留可点击外链；导出前移除所有 `a` 标签但保留其子节点，避免正文里出现无效链接。来源只在预览信息带展示，不写入导出产物。

**hljs 主题只保留语法色。** github 主题的结构规则与背景会和 `pre`/`code` 的 token 样式冲突，因此只保留颜色、字重与斜体规则；代码块背景取 `code.backgroundColor`，未设置时用语法主题背景。主题 CSS 固化为 TS 常量，保证 Vite 与 esbuild 验证包都能使用。

**内置主题从一开始就按多套设计。** 每套 = token 默认值 + theme.css，M1 先提供 default；M2 增加 shujuan 与 qingci，共用同一 token 接口与渲染管线。

**兼容性清单与 bad case 样张落仓库。** 清单是流程资产，每项含验证步骤与预期，规则一变可快速重跑；样张存 artifacts 便于对比。

**Rspress 代码块标题归一到独立适配文件。** 生成器标记差异不进入主管线：新增 `pipeline/rspress.ts`，由 `extractArticle` 在 Readability 前统一调用，按 `.rp-codeblock` 标记识别，把带标题的块转成通用结构；主管线不按域名或来源分支，其他站点结构不受影响。备选方案是写进 profiles 域名表，但 Rspress 是生成器签名而非域名例外，且一份配置无法覆盖所有 Rspress 站点，否。

**代码块标题以通用结构进入 Article.html。** 归一后统一为 `figure.code-block > figcaption + pre`：`figcaption` 是纯文本标题，语言写在 `code` 的 `language-*` 上。预览、导出与主题只消费这个结构，不知道 Rspress；以后支持其他生成器时复用同一结构。Readability 会清空 class，因此注入的 `code-block` 与 `language-*` 需通过 `classesToPreserve` 保留。

**线框属于代码块，不新增 token。** 所有代码块统一为 1px 外框与代码块圆角的卡片；带标题的块只在卡片顶部增加标题条（次级文字色、次级字号、等宽字体）与 1px 分隔线。线框写在 `pre` 上，`figure.code-block` 复用同一外观并容纳标题与代码；主题可在 theme.css 中用 `pre, .code-block { border: none }` 退出。备选是只给带标题块加框，同一篇文章会出现两种代码块外观，否；新增 codeTitle 背景、边框与字号 token 会把主题 schema、编辑面板、导入校验与迁移成本一起扩散，也不采用。

**语言映射归高亮层。** Rspress 的 `data-lang` 可能是 `tsx`、`jsx` 或 `html`，都不是 hljs 注册语言；映射到 `typescript`、`javascript`、`xml` 放在 `theme/highlight.ts`，适配器只把声明的语言写入 `language-*`，不复制 hljs 知识。

**表格按内容量决定是否横向滚动，只限三列及以上。** 预览和导出共用 `figure.table-scroll`，一至两列表格保持占满容器并换行。三列及以上标记 `table-scroll-wide`，表格改用 `width: max-content` 按内容自然宽度排布，并以 `min-width: 100%` 保证内容少时仍铺满容器；单元格宽度限制在 `5em` 到 `18em`，超过上限的内容在单元格内换行。这样短表放得下就不出现滚动条，内容多到自然宽度超出容器才在边框内横滚，滚动量与内容量相关。旧规则给整张三列表设 600px 下限，短表也被迫横滑；只设单元格下限又会让内容多的表被压成很高的行。内联导出使用白名单中的 `width`、`min-width`、`max-width` 与 `overflow-x`，微信编辑器是否保留 `max-content` 与滚动能力仍需实机验证，缺失时回落为普通换行。

**导出圆角按 CSSOM 长属性保留。** Chromium 会把 `border-radius` 展开成四个角的长属性，微信属性过滤按枚举到的属性名匹配；白名单必须包含四个角的长属性，否则引用、代码块、图片与表格的圆角会在导出时静默丢失。

## Risks / Trade-offs

- [juice 对复杂选择器内联不全] → 生成函数只输出元素级选择器（h1、p、blockquote、pre code、table 等），不生成嵌套与伪类，从源头避开
- [微信编辑器对 base64 大图转存失败] → 单图 5MB 上限 + 清单项实测，超限降级占位
- [深色模式下微信客户端改写代码块配色] → 清单专项实测，必要时代码块配色选微信深色模式不反转的安全组合
- [hljs 语言自动检测误判] → 常用语言子集显式注册（按标记语言序：ts/js/py/go/rust/bash/json/yaml/html/css/sql），检测失败落纯文本
- [Rspress 类名或结构随版本变化] → 识别与归一收敛在 `pipeline/rspress.ts`，升级或新增变体只改一处；非 Rspress 页面不受影响
- [Readability 清空注入的 class，标题条失去结构标记] → 注入的 `code-block` 与 `language-*` 通过 `classesToPreserve` 显式保留，harness 断言提取后的结构
- [微信编辑器剥离 min-width 或 overflow-x，表格无法横向滚动] → 实机验证；被剥离时回落为换行，不影响正文；必要时改用说明型表格的分组块方案

## Migration Plan

绿地叠加，无迁移。回滚即移除 theme/ 与 export.ts，预览退回 change 1 的基线样式。

## Open Questions

无。

### 2026-10-30 本地验收

主题 token、预设、CSS 双输出、主题化预览、高亮、导出与复制链路已落地。验证结果：

- 主进程 harness 24 项 0 失败，覆盖图片 base64、缺失/超 5MB 占位、data URI 原样保留与剪贴板写入。
- 渲染进程 harness 105 项 0 失败，覆盖 token 校验、29 个元素选择器的预览/导出计算样式一致、代码高亮、导出无 style 标签、外链降级、无来源行与横向滚动。
- 真实 Electron 窗口确认主题化预览、元信息行主题选择与复制按钮；点击复制后系统剪贴板为内联 HTML，并回显「已复制到剪贴板」；加载态与预览头部仍同为 145.4px、正文首行同为 185.4px。最小窗口 1000×700 下标题保持 676px 列宽，元信息与操作区同行，页面无横向溢出。
- 公众号后台实机粘贴、微信深色模式代码块配色与窄屏图片宽度降级仍待人工验证，记录在 `docs/wechat-checklist.md` 第 8、9、12 项；4.2 保持未完成。
