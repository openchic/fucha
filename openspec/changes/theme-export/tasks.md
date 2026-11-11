## 1. 主题 token 与预设

- [x] 1.1 src/shared/types.ts 增加 ThemeToken 契约（h1–h6 顶层、每级可选颜色回退、CSS 命名、范围常量表，fontSize 14-18 约束），shared/theme.ts 实现校验函数；验证：合法 token 通过、fontSize 10 被拒并带字段路径、标题 color 缺省回退正文色的测试通过
- [x] 1.2 shared/theme-presets/default.json 内置雾紫主题预设（新 token 形状的默认值，代码块与表格优先打磨）；验证：加载后字段齐全并通过校验，首次预览零配置使用该预设

## 2. CSS 生成与主题化预览

- [x] 2.1 theme/apply.ts 实现 token 变量表与 CSS 管线：预览作用域 CSS、导出变量解析 CSS 共用 base.css 与 theme.css；验证：harness 对 21 个元素选择器的预览/导出计算样式逐项比较，结果一致
- [x] 2.2 预览接入主题渲染（pages/Preview 注入 CSS 变量、base.css 与 theme.css），文章信息带元信息行右侧落位主题选择；复制随 3.4 接入；验证：预览按当前主题渲染，多套内置主题切换即时生效
- [x] 2.3 代码块 highlight.js 高亮（显式注册常用语言子集），pre 加横向滚动；验证：多语言代码块高亮正确、长行不折行，hljs 主题背景已剥离
- [x] 2.4 预览信息带复制按钮前加手机预览开关：打开后正文区显示设备预览面板（设备下拉 + 圆角画布，无「示例文章」标题），默认 iPhone 18 Pro；验证：真实窗口开关与设备切换生效，主题与正文不变，导出与复制产物不受影响

## 3. 导出管道

- [x] 3.1 pipeline/export.ts：token → 具体值样式表 → juice 内联 → 微信安全属性白名单过滤；验证：产物无 style 标签依赖、无外部 href、position/float/grid/flex 等不支持属性已剔除，元素样式全部内联
- [x] 3.2 图片 base64 内联（status=done 才转，单图 5MB 上限，超限或 failed 降级占位）；验证：主进程 exportHtml 对已下载图片输出 data URI，缺失图与 >5MB 图输出位图占位，已是 data URI 的图片保持原样
- [x] 3.3 去掉导出文末来源行；来源只在预览信息带展示，正文外链仍降级为文本；验证：导出产物不含原文 URL 或作者脚注
- [x] 3.4 文章信息带元信息行复制图标按钮接主进程剪贴板写 HTML；验证：真实 Electron 点击复制后系统剪贴板为内联 HTML 并回显「已复制到剪贴板」；公众号后台实机粘贴列入 4.2
- [x] 3.5 预览与导出共用 `normalizeArticleDom`：去重复首标题、清理引用块末段段后距；验证：harness 同时检查预览与导出结构一致，剩余差异仅图片传输、链接降级与样式内联

## 4. 兼容性清单与验收

- [x] 4.1 docs/ 建微信兼容性检查清单（标题、列表、引用、代码块、表格、图片、分割线 + 深色模式代码块配色、图片宽度降级），每项含验证步骤与预期；验证：`docs/wechat-checklist.md` 可直接按步骤复跑，附 2026-10-30 本地记录
- [ ] 4.2 按清单对真实导出产物逐项验证并记录通过/失败，bad case 修复后复跑至全绿；验证进度：本地结构项 1-7、10-11 通过；第 8 项深色模式、第 9 项图片宽度降级与第 12 项公众号后台实机粘贴待人工验证
- [x] 4.3 npm run typecheck 与 npm run lint 全绿；另跑 Prettier 检查

## 5. Rspress 代码块标题

- [x] 5.1 pipeline/rspress.ts：按 Rspress 代码块标记把带标题的块归一为 `figure.code-block > figcaption + pre`，无标题块只抽 `pre` 并补 `language-*`，返回需保留的 class 列表；验证：带标题、无标题两种样例结构与语言类符合预期，非 Rspress 页面无变化
- [x] 5.2 pipeline/extract.ts 在 Readability 前调用适配器，并把返回的 class 传给 `classesToPreserve`；验证：提取后标题不再是普通段落，`figure.code-block`、`figcaption` 与语言类保留到 Article.html
- [x] 5.3 theme/highlight.ts 补语言映射（tsx→typescript、jsx→javascript、html→xml）；验证：`language-tsx` 代码块按 TypeScript 高亮，不退回自动检测
- [x] 5.4 theme/base-css.ts 增加带标题代码块的卡片样式（整块 1px 外框与圆角、标题下分隔线、文件名等宽字体），核对导出属性都在微信白名单内；验证：预览/导出计算样式一致，无标题代码块样式不变
- [x] 5.5 渲染进程 harness 增加 Rspress 样例（带标题、无标题、非 Rspress 对照）；验证：归一、语言映射与卡片样式用例全部通过
- [x] 5.6 所有代码块统一外框：`pre` 加 1px 边框，`figure.code-block pre` 去掉重复边框，无标题块与普通代码块使用同一外观；验证：带标题/无标题/普通代码块在预览与导出中外框一致，无标题块无标题条，harness 补相应断言
- [x] 5.7 Rspress 提示容器归一为引用块：`.rp-callout` 提取时转为 `blockquote`，标题作粗体首段、内容原样搬入；验证：harness 覆盖转换结果，真实窗口打开含提示容器的页面按引用样式渲染

## 6. 表格横向滚动

- [x] 6.1 pipeline/normalize.ts 在预览/导出共用归一里给表格包 `figure.table-scroll`；容器画 1px 边框与代码块圆角并 `overflow-x: auto`，表格外圈边框移除、只留内部行列线；`WECHAT_STYLE_PROPERTIES` 加 `min-width`；验证：harness 通过，预览/导出结构一致，滚动条位于边框内
- [ ] 6.2 微信实机验证表格横向滚动与 `min-width` 是否保留；如果微信剥离，记录并回退到换行或说明型表格分组块方案（同步 4.2 清单）
- [x] 6.3 按列数收窄滚动：包容器时数最大列数，≥3 列才加 `table-scroll-wide` 与 `min-width: 600px`；2 列表格不强制最小宽度、按 100% 换行；验证：2 列表格无横向滚动条，3 列表格保留边框内滚动，harness 覆盖两种列数，预览/导出一致
- [x] 6.4 用单元格最小宽度替代整表 600px 下限。已验证 360px 预览和导出 HTML 中三列短表完整可见，六列表仅在框内横滚

## 7. 代码块边框样式

- [x] 7.1 `code.borderStyle` token：允许 solid / dashed / none，默认 solid；base CSS 的 `pre` 与 `figure.code-block` 外框使用该变量，标题分隔线保持实线；验证：默认视觉不变，none 时外框消失，校验拒绝非法值，主题包往返保留该字段
- [x] 7.2 `divider.borderTopStyle` 允许 solid / dashed / none；衬线预设改为 dashed；验证：内置主题校验通过，排版 tab 选项为实线/虚线/无

## 8. SVG 导出

- [x] 8.1 SVG 样式提升为表现属性：微信会剥离 SVG `style`，sanitize 后将安全的 `fill` / `stroke` / `stroke-dasharray` / `font-*` 等声明写成同名表现属性；导出旧快照时再提升一次，不改写原快照；验证：渲染 harness 覆盖内联、预览、导出与旧快照，rect 不再回退黑底、虚线与文字保留
- [x] 8.2 烘平 SVG 实色 rect mask 并补尺寸：导出前把 mask 的黑色矩形转成标签底色，移除 mask，只含 viewBox 的 SVG 补 width/height；验证：harness 覆盖 mask 移除、底色矩形位于标签文字前、宽高补齐，嵌入字体回退待微信实机复核
- [x] 8.3 代码块空格改用不可折叠空格导出，避免微信保存裁掉高亮 span 前后的空白；纯文本兜底还原普通空格；验证：harness 覆盖导出不可折叠空格与纯文本普通空格，待微信保存草稿复核
- [x] 8.4 列表首项粗体导出为带 `font-weight:700` 的行内 span，并把整项内容包进 `style="margin:0"` 的 p，避免微信把首项后的内容包进 section 拆成两行；验证：harness 覆盖 strong/b 转换、p 包裹与文本保持，待微信保存草稿复核
- [x] 8.5 代码块长行恢复横向滚动：预览与导出保留 `white-space: pre` 与 `overflow-x: auto`；微信保存后触摸滑动是否保留待实机复核，若仍被裁切则回退自动换行；验证：harness 覆盖导出滚动样式，待微信保存草稿复核
- [x] 8.6 引用块导出转为带同样内联样式的 section，避免微信给 blockquote 叠加默认左条形成双线；预览仍用 blockquote；验证：harness 覆盖导出无 blockquote、section 保留主色左条与末段间距，待微信保存草稿复核
- [x] 8.7 三列及以上表格按内容量决定是否滚动：表格改 `width: max-content` + `min-width: 100%`，单元格 `5em`～`18em`，短表铺满不滚，内容多的表在边框内横滚；验证：harness 覆盖 360px 下三列短表不滚、内容多的三列表与六列表局部滚动，待微信实机复核
- [x] 8.8 页面留白改为「平台固定留白 + token 额外内距」：内置主题与 schema v10 把左右内距归零，预览画布另加 20px 平台左右留白，导出按 token 输出；验证：harness 覆盖预览平台留白、导出额外内距与 v10 迁移，待公众号预览复核
- [x] 8.9 导出代码块按原生 code-snippet 豁免微信全局宽度限制：`pre` 及其子元素内联 `max-width:1000% !important`，`white-space` / `overflow-x` 提升为 `!important`；验证：harness 覆盖根与子元素优先级，待公众号保存后复核
- [x] 8.10 实机反馈仅给 `pre` 加 `max-width:1000%!important` 仍折行：改为 `code` 横向滚动容器（`display:-webkit-box` / `overflow-x:auto`）、换行用 `<br>`、空格用不可折叠空格，`pre` 及子元素继续豁免 `max-width`；验证：harness 覆盖结构、`br` 与模拟微信全局样式的滚动，待公众号保存后复核
- [x] 8.11 实机反馈 `<br>` + `-webkit-box` 仍会在空格与中文处折行：代码按行拆成 `width:max-content` 块，`code` 改用 `display:block` + `overflow-x:auto` 作滚动容器，空格用不可折叠空格，`pre` 及子元素继续豁免 `max-width`；验证：harness 覆盖行块结构、无 br、模拟微信全局样式下代码与行均横滚，待公众号保存后复核
- [x] 8.12 代码块滚动条位置与预览对齐：`code` 用 `width:max-content !important` 撑到最宽行，滚动条回到 `pre` 底部；该宽度被微信丢弃时回退到 `code` 自身滚动；验证：harness 覆盖 `code` 宽度与模拟微信样式下 `pre` 滚动，待公众号复核
