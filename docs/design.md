# 浮槎 fucha

把一个链接，变成一篇可以直接发进公众号的文章。

打开只有一个输入框和一个生成按钮，粘贴链接，正文区域展开公众号效果预览，套上主题，一键复制进公众号编辑器。

## 非目标

不做应用内正文编辑（预览只读，提取质量靠抓取端保证）、不做多平台分发、不做 AI 改写、不做账号登录、不接素材库 API 与第三方图床。只服务「链接进、公众号文章出」这一条路。

## 命名

浮槎，读音 fú chá。出自晋代张华《博物志》：天河与海相通，海边有人年年八月见浮槎往来，从不错期。取「从此岸渡到彼岸」之意，把一篇文章从它原本所在的地方，渡到它要去的地方。

图标用「渡」方案：一根横木加一道弧线，16px 可辨。已知风险：槎字生僻，易误读为「差」。应对是图标不依赖文字即可识别，README 首行固定标注读音「浮槎（fú chá）」。

## 技术栈

已有脚手架：electron-vite + React 19 + TypeScript + pnpm + electron-builder。

选 Electron 而非 Tauri：渲染内核可控，界面不受系统 WebView 差异影响，代价是包体与内存偏高，可接受。

依赖按环节分组，其中 highlight.js 与 juice 已安装，其余已就位：

- `界面`：tailwindcss 与 @tailwindcss/vite，应用壳样式载体，@theme 承接配色与基调 token，preflight 兼作样式重置。
- `路由`：react-router，Home 布局承载 `/`（New 输入页）与 `/preview` 文章页；左侧历史栏常驻，右侧 Outlet 切换输入页与文章。
- `提取`：@mozilla/readability。
- `净化`：dompurify。
- `高亮`：highlight.js，输出 class，导出时由 juice 一并内联成 style。
- `内联`：juice。

结构化数据用 Electron 自带 `node:sqlite` 存 `userData/fucha.db`，图片字节仍按文章存 `userData/article-cache/`。数据库与文件读写只在主进程，渲染进程经后续 IPC 调用；表结构见 `docs/local-store.md`。

工具链版本锁在 TypeScript 5.9 与 ESLint 9：@vainjs/eslint-config 的 peer 要求 TS ^5.9，typescript-eslint 只支持 TS 小于 6.1，eslint 插件（import、react、react-hooks）最高到 9。三者互相牵制，升 TS 或 ESLint 要同时换掉这一组，不能单独抬版本。ESLint 用该包的 react 预设，React 19 走自动运行时故关掉 react-in-jsx-scope，并忽略 out/ 与 dist/ 构建产物。

## 架构

### 进程分工

主进程与渲染进程的边界由两件事决定：渲染进程的 fetch 受同源策略限制，主进程不受；渲染进程开了 sandbox，不能直接读写磁盘。

| 层       | 职责                                                                                      | 为什么在这一层                                                                       |
| -------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 主进程   | 抓取、图片下载与缓存、`fucha://` 协议、文件读写、主题与偏好存储、导出末端图片内嵌、剪贴板 | 网络请求不受同源策略限制，且只有它能直接访问磁盘与系统剪贴板                         |
| preload  | 通过 contextBridge 暴露 `window.fucha` 单一命名空间                                       | sandbox 渲染进程只能经它调用 IPC                                                     |
| 渲染进程 | HTML 解析、Readability 提取、DOMPurify 净化、预览渲染、主题 CSS 生成、juice 内联          | 自带 DOM，省掉主进程再装一份 DOM 实现；净化贴着解析入口做，进 React 状态的数据已安全 |

`FuchaApi` 是唯一的跨进程契约，类型与 IPC 方法签名同文件维护（`src/shared/types.ts`）。方法按里程碑逐步补齐：

| 方法             | 载荷                                             | 返回                                   | 阶段 |
| ---------------- | ------------------------------------------------ | -------------------------------------- | ---- |
| `fetchArticle`   | url                                              | 成功为 html + finalUrl，失败为四类错误 | M0   |
| `downloadImages` | articleHash + 图片 id/originalUrl 列表           | 每张图的 done/failed 与缓存文件名      | M0   |
| `exportHtml`     | articleHash + 已内联样式的 HTML                  | 图片已转 data URI 的最终 HTML          | M1   |
| `copyHtml`       | 最终 HTML                                        | 无                                     | M1   |
| `store`          | 主题与偏好的读写、更新（含改名）、删除、导入导出 | 结构化记录                             | M2   |

### 主链路

```
输入 URL
  │ window.fucha.fetchArticle(url)
  ▼
主进程抓取 ── 失败 ──► 错误四分类 ──► 失败态
  │ { html, finalUrl }
  ▼
渲染进程提取与净化
  DOMParser → base 归一 → 站点适配 → Readability → DOMPurify
  │ Article
  ├──────────────► 预览链路
  │                 downloadImages（主进程）
  │                 img src → fucha://
  │                 ThemeToken → CSS 变量
  │
  └──────────────► 导出链路
                    ThemeToken → 具体值 CSS → juice 内联
                    微信属性过滤
                    exportHtml（主进程）图片转 base64
                    copyHtml
```

历史打开是另一条入口：左侧历史栏列出 `articles` 摘要，点击后以 `?hash=` 打开本地快照，经同一预览/导出链路渲染，不重新抓取；`重新提取` 才回到网络并更新快照。

### 进程通信与错误模型

主进程抓取、下载和导出结果都通过可序列化对象跨 IPC 返回，不把 Electron 异常抛给渲染进程。抓取失败分四类：网络不可达、超时、目标拒绝（HTTP 状态异常或不是网页）、验证码页。提取失败单独归为 `extract`，由渲染进程在 Readability 或净化阶段抛出，界面按同一套错误态展示。

### 本地图片协议

- `fucha://` 在 app ready 前注册为 privileged scheme（standard、secure、supportFetchAPI、stream），ready 后由 `protocol.handle` 服务。
- 路径形态 `fucha://img/<articleHash>/<file>`，只服务 `userData/article-cache/`；路径归一化后必须仍在缓存目录内，防路径穿越。
- 渲染进程用 `img` 的 `src` 直接引用，不把图片字节经 IPC 复制成 blob URL。
- 选自定义协议而不选 `file://`：dev 下渲染源是 http、打包后是 file，`file://` 图片在 dev 会被 CSP 拦；自定义协议把两端行为拉平。
- CSP 放行 `default-src 'self'`、`script-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: fucha:`、`font-src 'self' data:`；`data:` 字体仅供提取净化器生成的安全内嵌 SVG 字体使用。

### 缓存与存储

- 文章图片按文章归档：`userData/article-cache/<articleHash>/<内容 hash>.<ext>`，文件名取内容 SHA-1；同目录的 `index.json` 记 URL 到文件名的映射，重复提交直接复用。
- 文章 hash 取 `finalUrl` 的 SHA-256 前 32 位。
- 结构化数据存 `userData/fucha.db`：自定义主题进 `themes`、偏好进 `preferences`、文章快照与图片元数据进 `articles` / `article_images`；文章快照的 `theme_id` 只存主题引用，自定义主题原地编辑后所有引用它的文章同步换样，内置主题只读。schema 与迁移策略见 `docs/local-store.md`。
- 所有数据库与文件读写只在主进程。渲染进程的 `theme/store.ts` 将来只是 IPC 客户端，不是第二份存储实现。
- 数据库不可用时回默认预设与空历史，不阻断抓取、提取与预览。
- 缓存跨提交复用，清理动作不放在导出完成时，避免当前预览裂图；具体清理策略后置。

### 安全基线

- contextIsolation 与 sandbox 开启，nodeIntegration 关闭。sandbox 在窗口配置里显式开启，另外两项沿用 Electron 默认值。
- 渲染进程不直接加载远程页面。预览容器拦截文章内的链接点击，交给系统浏览器打开，不在应用窗口内导航。
- 内容净化、`fucha://` 路径校验与 CSP 分别见「提取与净化」「本地图片协议」，此处不重复。

## 抓取

- 默认：主进程原生 fetch，覆盖多数文档站与博客。
- 请求参数：15 秒超时，跟随重定向，带桌面浏览器 UA；检查 content-type 是否为 html/xhtml/纯文本；按响应头 charset 解码，缺省 utf-8。
- 微信：文章页与图片域名（`mmbiz.qpic.cn`）都命中站点表，图片下载带 `Referer: https://mp.weixin.qq.com/` 绕防盗链；页面命中验证码特征时显式抛错，不能静默返回空内容。
- 其余站点：按需加域名级选择器与请求头配置。客户端渲染站点 fetch 拿不到正文时，再考虑隐藏 BrowserWindow 兜底，暂不实现。
- 站点差异集中在 `src/shared/profiles.ts` 的域名表，主管线不出现按域名分支的抓取逻辑。

## 提取与净化

顺序固定，前一步的输出是后一步的输入：

1. 用 `DOMParser` 解析 HTML。解析出的文档是惰性的，不执行脚本。
2. 以 `finalUrl` 作为文档 base。Readability 按 `doc.baseURI` 解析相对地址，不设 base 会落到应用自身地址，相对图片和链接都会坏。微信等站点若把正文容器以内联 `visibility` / `opacity` 预先隐藏，先解除隐藏，否则 Readability 会把正文判为不可见；站点导航或交互组件按 `profiles.ts` 的清理选择器在提取前或提取后移除。
3. 微信图片把 `data-src` 写回 `src`，只在 `src` 为空或以 `data:` 开头时覆盖。必须在净化前做，因为 DOMPurify 会把 `data-*` 属性剥掉，之后再映射就找不到真实地址。
4. 从 meta 提取标题、作者、发布时间、封面；标题缺失时回落 `document.title`。
5. 交给 Readability 抽正文。正文字符数低于 200 视为非文章页，直接失败。
6. DOMPurify 白名单净化。HTML 标签只留段落、标题、列表、引用、代码块、表格、图片、链接、强调、图注等语义结构；HTML 属性只留 `href`、`src`、`alt`、`title`、`class`、`colspan`、`rowspan`、`datetime`；`style` 与全部 `data-*` 剥除；`script`、`iframe`、`object`、`embed`、表单控件、音视频等禁止。
7. 内嵌 SVG 走独立静态白名单：保留图形、路径、文本、渐变、剪裁与标记，属性保留几何、颜色、安全 presentation 样式及 `text` / `tspan` 上的安全数值 `dx`、`dy`；`script`、事件、动画、`foreignObject`、嵌套位图、`use`、外部 `href` 与非本地 `url()` 全部移除。若 `foreignObject` 仅含一个纯文本标题（可由安全行内标签包裹，并带无可见文本的装饰节点），则在净化前转换为静态 SVG 文字，并沿用标题及祖先中匹配到的安全字体、字号、字重、字形与颜色；`h1` 的线条读取来源底边框样式。只保留 SVG 实际引用、来源为受限 `data:` 字体的 `@font-face`，并通过 CSP 的 `font-src 'self' data:` 加载。Readability 前先解析页面级及 SVG 内部的 `style` 与 class，把匹配 SVG 的安全声明按属性合并到图形，再清理源码样式，最终正文不含来源 SVG `style` 标签或 class。HTML 的 `style` 仍整体剥离，只有 SVG 的 presentation 声明按属性白名单保留。
8. 从净化结果收集图片清单，只收 `http(s)` 绝对地址，按 URL 去重；内嵌 SVG 不走图片下载。

输出 `Article`。`html` 是已净化的正文，`img` 的 `src` 仍指向原始地址。

```ts
interface Article {
  title: string
  author?: string
  publishedAt?: string
  sourceUrl: string
  cover?: string
  html: string // 已净化，img src 指向原始地址
  images: ImageAsset[]
}

interface ImageAsset {
  id: string
  originalUrl: string
  localPath?: string // 下载失败时只有原地址，导出降级为占位
  status: 'pending' | 'done' | 'failed'
  width?: number
  height?: number
}
```

预览引用块沿用正文段落间距，但最后一个子元素清除段后距，避免段落 margin 与引用块内边距叠加，造成底部留白过大。

## 图片

- 下载在主进程，3 并发，单图 20 秒超时；失败不重试，`ImageAsset.status` 记 pending/done/failed。
- 正文提取完成后先进入预览，图片在后台下载并原地更新；下载失败保留 originalUrl，预览用占位图展示，不阻断正文。
- 外链 SVG 图片与位图走同一下载链路，缓存保留 `.svg` 并以 `image/svg+xml` 提供；内嵌 SVG 由净化白名单直接保留，不进入下载。
- 微信图片下载按图片域名匹配站点表里的请求头（文章域名与 `mmbiz.qpic.cn` 共享配置）；缓存命中则跳过网络下载，布局与复用规则见「缓存与存储」。
- 预览重写：done 的 `img` 的 `src` 换成 `fucha://img/<articleHash>/<file>`；failed 换成占位图。

## 主题系统

### 主题契约与实现

主题系统以 `docs/theme-system.md` 为准，本节只保留边界：

- token 是稳定接口：正文、颜色、圆角、quote/code/table/image/divider，以及顶层 h1–h6；每级标题有字号、字重、行高、对齐、装饰与上下边距。字段名对齐 CSS 属性名。
- 内置主题「清简」（`default`）与「书卷」（`serif`）各自带 token 默认值与 `theme.css`，只读；升级视觉时新增 id，旧 id 保留。
- 应用维护 `base.css`，元素规则只引用 token 变量；主题 CSS 只写差异。加载顺序为 base.css → 装饰规则 → hljs 语法色 → theme.css。
- 文章只保存 `theme_id`；内置主题只读，自定义主题可在设置页原地编辑并同步所有引用文章，另存为与新建生成新主题；文章页只负责选择主题。
- 自定义主题以 `.fucha-theme` 主题包导入导出（`theme.json` + `theme.css`），导入时 fail-closed 校验 token 与 CSS。

### 预览与导出

预览与导出共用同一份 CSS 与同一份正文归一，差异只有样式形态与图片传输：

```text
preview:
  token -> .article-body CSS 变量
  base.css + theme.css -> 注入 .article-body 作用域

export:
  token -> 具体值变量表
  base.css + theme.css -> 解析 var()
  -> juice 内联
  -> 微信属性过滤
```

- 导出必须把所有 `var(--fucha-*)` 替换成具体值；juice 不解析 CSS 变量。
- 预览与导出共用 `normalizeArticleDom`：去重复首标题、清引用末段距。
- 导出输入是净化后的 `Article.html`（原始图片地址），不是预览 HTML；正文外链降级为文本。
- hljsTheme 只提供语法色，代码块背景取 `code.backgroundColor`，未设置时用语法主题背景；表头背景色取 `table.headerBackgroundColor`。

单图上限先定 5MB（按原始文件字节），实测后调整。webp/avif 的微信端兼容性在 M1 清单中实测，不通过则在导出前转成 jpeg/png。占位图导出用位图 data URI，不用 SVG。

微信约束：

- `只认内联样式`：style 标签、外部 CSS、class 样式一律被剥离，样式必须落到元素 style 属性。
- `图片必须 base64 内联`：外链图片会裂图，产物里的图片必须是 base64 data URI；微信编辑器粘贴时会自动转存。
- `正文不能放外链`：正文内已有外链在导出时降级为文本并保留文字；来源只在预览信息带显示，不写入导出产物。
- `布局能力受限`：position 与 float 基本失效，伪元素不可用，flex 部分可用，grid 别想，复杂排版靠 table 与 section 拼。
- `代码块`：包 pre 加 `overflow-x: auto`，保证横向滚动不折行。

## 界面

配色只属于应用壳：主色 #5e7b6f（鼠尾草绿，L\* 49.1、彩度 13.5）落在来源状态点、输入框聚焦边框、键盘焦点环与文字选中的 25% 浅调（#d7dedb，其上文字对比 12.3:1）这些小面积标记上；实底控件只用主色与错误色：主操作按钮底色固定为主色、配白字，实测对比 4.63:1 过 WCAG AA，悬停往深走到主色 88% 混近黑的 #567065（白字 5.40:1），不换成别的色；破坏性确认的确认按钮用错误色实底配白字，对白底 4.98:1，也过 AA。一份白色面板里只有一个实底控件，骨架使用中性浅灰，不承担实底。错误色取独立警示红 #cf3538（L\* 47.1、彩度 69.3），不再与主色混调；对白底对比 4.98:1、对悬停浅底 #f5f5f7 4.57:1、对未聚焦边框 4.08:1，13px 的删除项与提示文案在静止和悬停态都过 AA。大面积由白色内容与近白中性画布承担。预览与导出的文章样式完全由 ThemeToken 决定，不经 Tailwind，与应用配色互不影响——预览保真不吃应用品牌。

视觉基调是简洁大方优雅，六条：留白分组为主，内容区只用 1px 淡线分层、不加投影，内部不再层层套卡；色彩纪律，大面积白色承载内容与操作区，主色只做那一个实底控件与小面积点缀；层级只靠留白、字号和 1px 信息带分隔，不使用背景色分层；动效轻短，内容淡入约 200ms ease-out，无弹跳无循环，尊重系统减少动态效果设置；字号底盘，正常 UI 与正文 14、说明 12、区块标题 16 至 22（取偶数档）、错误页标题 26、品牌字标 32，最小 12（仅说明文字）；主面板保持直角，控件用药丸形，文章内容圆角由 token 决定，是另一套。

字体走系统栈（mac 即 PingFang），应用文字使用 #1d1d1f、次级文字 #6e6e73、线条 #e8e8ed，应用壳文字统一 400 字重，层级只靠字号与颜色；文章正文的标题、粗体与代码语法仍由 ThemeToken / theme.css 决定。统一样式重置与滚动条样式。初始态用帆形线性字标识别品牌，操作图标使用同一套线宽，不增加装饰卡片。

应用默认打开 Home 布局（`/`），右侧为 New 输入页；左侧 264px 历史栏常驻，底部为历史标题与最近文章列表，列表项单行显示标题，超出省略，不展示来源与时间。历史栏顶部「新建」回到 `/` 输入页；点击历史项进入 `/preview?url=&hash=` 子路由，右侧显示加载态、错误态、文章信息带与正文，当前文章高亮；`重新提取` 才回到网络抓取。两个子路由只替换右侧内容，左侧历史栏不重建。悬停或键盘聚焦时显示「更多」按钮，菜单目前只提供「删除」；打开确认弹层时菜单收起，删除失败时重新展开并显示错误。

设置页是 Home 的兄弟布局（`/settings`）：左侧 264px 设置导航（返回、主题管理），返回与 Home 的「新建」使用同一位置和导航项样式，右侧为主题列表或配置页；历史栏右下角设置图标与文章页主题下拉底部的「主题管理」都进入 `/settings/themes`。列表分内置与自定义，每项用主题自己的纸色、标题装饰与引用边条生成缩略样本；内置只读、只能另存为；自定义可编辑（标题旁改名随保存提交）、另存为、导出与删除；顶部提供新建与导入。配置页左侧是固定示例文章预览，右侧是 token 控件；内置只读只提供另存为，自定义保存原地更新并同步所有引用文章，新建从默认 token 起；未保存离开确认。设置页不读取当前文章，保存后返回文章由 Preview 重新加载；文章页主题下拉只负责选择与打开管理，不再内联编辑主题。

窗口默认 1180 × 800，最小 1000 × 700。不设顶部栏。New 输入页在右侧内容区是一列内容，与正文同一条测宽（676px）垂直居中，不带卡片、边框或投影；Preview 页由同一块白色窗口承载信息带与正文，不设外圈留白、背景分层或外边框。正文为单栏，内容宽度上限 676px，两侧共 48px 内边距，空间不足时随窗口收窄；New 输入页与 Preview 的信息带、正文共用同一左边界。

macOS 隐藏系统标题栏，红绿灯直接覆盖在内容上，不保留系统标题文字或应用自绘顶栏。所有状态统一由应用壳顶部固定的 24px 透明空白带触发窗口拖动，该区域不占据文档流、不增加头部高度；文章信息带、加载说明、错误与正文区域均不触发拖动，标题和正文可正常选择，输入框、按钮与链接保持正常交互。

### 交互流程

| 状态   | 页面内容                                                                                                                                 | 去向                           |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| 输入态 | 左侧历史栏保留；右侧一列内容为品牌字标、说明与链接表单；表单是单个药丸字段，占位「请输入一个链接」，右端内嵌「生成预览」，回车与点击等价 | 提交后进入加载态               |
| 加载态 | 左侧历史栏保留；右侧 40px 标题骨架、元信息带骨架与「取消」；正文区显示同宽骨架行；允许取消并保留已提交链接回到输入态                     | 成功后进入预览，失败进入失败态 |
| 预览态 | 左侧历史栏保留，当前文章高亮；右侧顶部 40px 标题栏单行显示标题并可拖动窗口，元信息带显示来源、提取时间与操作；下方只读正文，图片原位更新 | 新建进入输入态，历史切换文章   |
| 失败态 | 左侧历史栏保留；右侧信息带显示错误分类，正文区给出具体原因并提供「重新尝试」                                                             | 重试回到加载态，新建进入输入态 |

路由用 Hash：`/` 是 Home 布局的 index，即 New 输入页；`/preview` 是 Home 的子路由，右侧 Outlet 承载文章，`/preview?url=&hash=` 打开本地快照；加载与失败是 Preview 子路由内的状态。`/settings` 是 Home 的兄弟布局，index 重定向到 `/settings/themes`，其下 `themes` 是主题列表、`themes/new` 与 `themes/:id` 是主题配置，不套在 Home 的 Outlet 下。Preview 缺少目标地址时回到 `/`，`/new` 等未知路径由兜底路由回到 `/`。生产从 `file://` 加载，Hash 路由刷新时不会请求不存在的路径。链接随 `?url=` 进地址，刷新即按该链接重跑，不再另存上次链接。

「新建」固定在历史栏顶部，点击回到 `/` 输入页并终止尚未完成的图片更新；左侧历史栏常驻，默认页不自动打开文章。不常驻长链接，也不显示不可用的文章操作占位。输入框整只药丸是一个焦点目标，聚焦时边框由浅灰转主色 #5e7b6f，1px、不叠描边（实测对白底 4.63:1、对未聚焦边框 3.79:1，过焦点指示建议的 3:1）。校验错误文案左缩进 19px，与字段内链接图标左边缘对齐（实测同为 271px）。字段内提供清除按钮，生成按钮始终可点，空链接与无效链接都在字段下方就地提示；省略协议的有效域名自动补全 HTTPS，无效、非 HTTP(S)、带账户密码或包含空白的链接在原位提示。骨架屏在成功后原地淡出为预览。导出不是独立页面，刷新、复制与主题选择排在工具栏右侧，产物是一致的内联样式 HTML。Preview 右侧 44px 工具栏使用面板的 24px 左右边线，标题后紧跟来源外链图标，右侧为发布/状态与操作，正文保持 676px 内容列；操作区依次为刷新图标、复制图标与主题文字下拉，整组约 164px。标题可截断；完整 URL 放在来源图标 tooltip；发布时间只在宽窗口显示；最窄窗口 1000px 下工具栏不换行。文章页主题下拉只保留名称、当前值与底部「主题管理」，不提供内联编辑。Preview 顶部为 44px 合并工具栏，标题 14px 单行省略、来源外链图标、操作靠右；头部合计 44px，正文直接接在工具栏下方。

预览直接渲染净化后的 HTML，主题切换走 CSS 变量即时生效。整页加载骨架只用于首次网络提取与网络回退；从历史打开本地快照时静默读取，不闪骨架。加载态与预览态使用同一 44px 工具栏高度，骨架首行与正文首内容共用 40px 顶部内边距。进入预览后阅读区保持稳定；图片下载完成时按图片 ID 更新已有 `img` 的 `src`，不重新设置整篇 `innerHTML`，保留正文节点与滚动位置。工具栏固定显示来源外链图标、重新提取入口和可用的发布时间，不展示作者与域名；图标可点击打开原始链接，完整 URL 在 tooltip 中。刷新入口按当前链接重新抓取和提取；快照视图也原地刷新，保留当前正文与左侧历史栏，不回退整页加载骨架，并用锚定的应用内提示说明操作与当前刷新状态，支持鼠标悬浮和键盘聚焦。pending/done/failed 三态仅由图片下载管道内部维护，元信息带不显示图片状态、数量或占位。

## 目录结构

需求与规格在 `openspec/` 下按 change 组织，规则见 AGENTS.md，实现清单看对应 change 的 `tasks.md`。本文维护跨 change 的架构、机制与常量；change 文档只记录本次取舍与任务，不重复本文细节。

```
src/
  main/
    index.ts              窗口创建与生命周期
    ipc.ts                抓取、图片下载、fucha:// 协议、存储 IPC、导出图片内嵌、剪贴板
    db.ts                 SQLite 初始化、schema 迁移与存储可用状态
    store.ts              偏好、自定义主题、文章快照与图片元数据仓储
    theme-package.ts      主题包生成、解析与导入导出
    zip.ts                主题包 zip 读写（stored 写出，stored/deflate 读入）
  preload/
    index.ts              暴露 IPC 接口
    index.d.ts            暴露接口的类型声明
  renderer/
    index.html            入口页
    src/
      main.tsx            渲染进程入口
      App.tsx             路由与整屏分发
      env.d.ts
      pages/
        Home/
          index.tsx        布局：历史栏、侧栏动作与右侧 Outlet
        New/               独立的 New 页面，作为 Home 的 index 子路由
        Preview/           独立的 Preview 页面：文章、主题与导出
        Settings/
          index.tsx        Settings 布局：左侧设置导航 + 右侧 Outlet
          Themes/index.tsx 主题列表：内置/自定义与主题操作
          Themes/Editor.tsx 主题配置：左侧示例预览 + 右侧 token 控件
          Themes/SamplePreview.tsx 固定示例文章
      components/
        Button/          应用壳胶囊按钮：primary/secondary/danger/back 变体与默认 type
        Icon/            应用壳线性图标
        Popover/         共享弹层：定位、进出场、外部点击与焦点回位
        ConfirmDialog/   全局确认弹层：标题、说明与危险操作
        Dropdown/        应用壳下拉选择（主题选择）
        Sidebar/         左侧历史列表、设置入口与快照打开入口
        ArticleMeta/     文章信息带：标题、主题选择、复制与来源元信息
        ThemePanel/      设置页主题配置：按颜色/排版/代码分组的 token 控件
        LoadingPanel/    加载态骨架与阶段提示
        ErrorPanel/      失败分类、原因与重试
      hooks/
        useArticlePreview.ts    按 ?url= 抓取提取；按 ?hash= 打开本地快照
        useArticleHistory.ts    历史文章摘要列表
        useArticleExport.ts     导出与复制状态
        useArticleTheme.ts      当前文章主题选择与持久化
        useThemeLibrary.ts      内置主题与自定义主题合并
      pipeline/
        extract.ts        Readability 提取与置信度判断
        sanitize.ts       DOMPurify 白名单
        images.ts         图片路径映射与预览重写
        export.ts         高亮、juice 内联与微信属性过滤
      theme/
        tokens.ts         shared 校验的兼容导出
        base-css.ts       正文基础排版（只引用 token 变量）
        apply.ts          预览变量/作用域 CSS 与导出变量解析 CSS
        highlight.ts      代码高亮与 hljs 主题
        hljs-github.ts    github 语法色常量
        library.ts        主题解析与可用主题合并
        presets/
          index.ts        内置主题加载
          default.json    内置默认主题 token
          default-css.ts  默认主题 theme.css
          serif.json      内置衬线主题 token
          serif-css.ts    衬线主题 theme.css
      styles/
        app.css           样式入口与公共规则：base、布局、拖动、减弱动效
        tokens.css        应用壳设计 token 与动画关键帧
  shared/
    pageBridge.ts         Home/Preview 页面桥接：活动 hash 与历史刷新（仅渲染层）
    theme.ts              ThemeToken 范围常量与校验（主进程/渲染层共用）
    theme-css.ts          主题 CSS 契约校验、作用域与变量解析
    store-types.ts        本地存储记录类型
    types.ts              跨进程数据契约（含 IPC 接口签名）
    profiles.ts           域名适配（微信必须，其余按需）
```

## 里程碑

`M0`：界面四态与应用壳配色基调，主进程抓取，Readability 提取，DOMPurify 净化，微信公众号文章可用（data-src 取图、Referer 下载、验证码抛错）。拿二十个不同类型链接验证提取正确率。

`M1`：内置主题加导出内联 HTML，产出物直接粘进公众号后台不改格式。建微信兼容性检查清单，逐条验证标题、列表、引用、代码块、表格、图片、分割线，另加深色模式代码块配色、图片宽度降级两项实测，规则一变立刻重跑。

`M2`：主题系统落地（base.css + theme.css、多套内置主题、主题包导入导出）与设置页主题管理；预览页左侧历史栏接入本地快照；文章快照与主题绑定写入本地存储。token 自动生成不包含在本里程碑。

后置（需要时再排）：自绘标题栏与系统控件、Windows 一致性对照、签名与公证分发。打包链路有一处上游版本不匹配待处理：app-builder-lib 需要 @electron/get 3.1 的 ElectronDownloadCacheMode，lockfile 仍锁在 3.0.0，`build:unpack` 会报错。

## 风险

`微信规则会变`：过滤策略无官方文档，靠实测，清单要能快速重跑。

`抓取合规`：尊重 robots.txt，抓取他人原创内容用于发布前需获授权。Article 保留来源链接与作者供来源记录和导出使用，预览界面固定显示来源链接。robots 检查目前尚未落到抓取代码，作为对外发布前的合规项补齐。

`正文不可编辑`：提取质量差时无法在应用内修正，只能换来源。后续若确有需要，再引入 Tiptap 做最小编辑。

`跨平台`：Windows 需要单独验证 `fucha://` 的路径服务与字体渲染。当前协议处理按 `/` 拼路径前缀，Windows 的 `resolve()` 产出反斜杠，需要按 `path.sep` 处理。

`签名`：对外分发才需要，自用可跳过。
