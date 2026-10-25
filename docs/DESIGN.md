# 浮槎 fucha

把一个链接，变成一篇可以直接发进公众号的文章。

打开只有一个输入框和一个生成按钮，粘贴链接，正文区域展开公众号效果预览，套上主题，一键复制进公众号编辑器。

## 非目标

不做应用内正文编辑（预览只读，提取质量靠抓取端保证）、不做多平台分发、不做 AI 改写、不做账号登录、不接素材库 API 与第三方图床。只服务「链接进、公众号文章出」这一条路。

## 命名

浮槎，读音 fú chá。出自晋代张华《博物志》：天河与海相通，海边有人年年八月见浮槎往来，从不错期。取「从此岸渡到彼岸」之意，把一篇文章从它原本所在的地方，渡到它要去的地方。副标：渡文过海。

图标用「渡」方案：一根横木加一道弧线，16px 可辨。已知风险：槎字生僻，易误读为「差」。应对是图标不依赖文字即可识别，README 首行固定标注读音「浮槎（fú chá）」。

## 技术栈

已有脚手架：electron-vite + React 19 + TypeScript + pnpm + electron-builder。

选 Electron 而非 Tauri：渲染内核可控，界面不受系统 WebView 差异影响，代价是包体与内存偏高，可接受。

依赖按环节分组，其中 highlight.js 与 juice 尚未安装，其余已就位：

- `界面`：tailwindcss 与 @tailwindcss/vite，应用壳样式载体，@theme 承接配色与基调 token，preflight 兼作样式重置。
- `提取`：@mozilla/readability。
- `净化`：dompurify。
- `高亮`：highlight.js，输出 class，导出时由 juice 一并内联成 style。
- `内联`：juice。

存储不引库：自定义主题与偏好都是 userData 下的 JSON 文件，fs 直接读写。写盘只发生在主进程，渲染进程经 IPC 调用。

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

| 方法             | 载荷                                     | 返回                                   | 阶段 |
| ---------------- | ---------------------------------------- | -------------------------------------- | ---- |
| `fetchArticle`   | url                                      | 成功为 html + finalUrl，失败为四类错误 | M0   |
| `downloadImages` | articleHash + 图片 id/originalUrl 列表   | 每张图的 done/failed 与缓存文件名      | M0   |
| `exportHtml`     | articleHash + 已内联样式的 HTML          | 图片已转 data URI 的最终 HTML          | M1   |
| `copyHtml`       | 最终 HTML                                | 无                                     | M1   |
| `saveFile`       | 最终 HTML                                | 无                                     | M1   |
| `store`          | 主题与偏好的读写、重命名、删除、导入导出 | JSON                                   | M2   |

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
                    微信属性过滤 → 来源行
                    exportHtml（主进程）图片转 base64
                    copyHtml / saveFile
```

### 进程通信与错误模型

主进程抓取、下载和导出结果都通过可序列化对象跨 IPC 返回，不把 Electron 异常抛给渲染进程。抓取失败分四类：网络不可达、超时、目标拒绝（HTTP 状态异常或不是网页）、验证码页。提取失败单独归为 `extract`，由渲染进程在 Readability 或净化阶段抛出，界面按同一套错误态展示。

### 本地图片协议

- `fucha://` 在 app ready 前注册为 privileged scheme（standard、secure、supportFetchAPI、stream），ready 后由 `protocol.handle` 服务。
- 路径形态 `fucha://img/<articleHash>/<file>`，只服务 `userData/article-cache/`；路径归一化后必须仍在缓存目录内，防路径穿越。
- 渲染进程用 `img` 的 `src` 直接引用，不把图片字节经 IPC 复制成 blob URL。
- 选自定义协议而不选 `file://`：dev 下渲染源是 http、打包后是 file，`file://` 图片在 dev 会被 CSP 拦；自定义协议把两端行为拉平。
- CSP 放行 `default-src 'self'`、`script-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: fucha:`。

### 缓存与存储

- 文章图片按文章归档：`userData/article-cache/<articleHash>/<内容 hash>.<ext>`，文件名取内容 SHA-1；同目录的 `index.json` 记 URL 到文件名的映射，重复提交直接复用。
- 文章 hash 取 `finalUrl` 的 SHA-256 前 32 位。
- 主题存 `userData/themes/<id>/token.json`，偏好存 `userData/preferences.json`（记 lastThemeId）。
- 所有 fs 读写只在主进程。渲染进程的 `theme/store.ts` 只是 IPC 客户端，不是第二份存储实现。
- 偏好或主题文件损坏时回默认预设，不阻断启动。
- 缓存跨提交复用，清理动作不放在导出完成时，避免当前预览裂图；具体清理策略后置。

### 安全基线

- contextIsolation 与 sandbox 开启，nodeIntegration 关闭。sandbox 在窗口配置里显式开启，另外两项沿用 Electron 默认值。
- 渲染进程不直接加载远程页面。预览容器拦截文章内的链接点击，交给系统浏览器打开，不在应用窗口内导航。
- 内容净化、`fucha://` 路径校验与 CSP 分别见「提取与净化」「本地图片协议」，此处不重复。

## 抓取

- 默认：主进程原生 fetch，覆盖多数文档站与博客。
- 请求参数：15 秒超时，跟随重定向，带桌面浏览器 UA；检查 content-type 是否为 html/xhtml/纯文本；按响应头 charset 解码，缺省 utf-8。
- 微信：图片下载带 `Referer: https://mp.weixin.qq.com/` 绕防盗链；页面命中验证码特征时显式抛错，不能静默返回空内容。
- 其余站点：按需加域名级选择器与请求头配置。客户端渲染站点 fetch 拿不到正文时，再考虑隐藏 BrowserWindow 兜底，暂不实现。
- 站点差异集中在 `src/shared/profiles.ts` 的域名表，主管线不出现按域名分支的抓取逻辑。

## 提取与净化

顺序固定，前一步的输出是后一步的输入：

1. 用 `DOMParser` 解析 HTML。解析出的文档是惰性的，不执行脚本。
2. 以 `finalUrl` 作为文档 base。Readability 按 `doc.baseURI` 解析相对地址，不设 base 会落到应用自身地址，相对图片和链接都会坏。
3. 微信图片把 `data-src` 写回 `src`，只在 `src` 为空或以 `data:` 开头时覆盖。必须在净化前做，因为 DOMPurify 会把 `data-*` 属性剥掉，之后再映射就找不到真实地址。
4. 从 meta 提取标题、作者、发布时间、封面；标题缺失时回落 `document.title`。
5. 交给 Readability 抽正文。正文字符数低于 200 视为非文章页，直接失败。
6. DOMPurify 白名单净化。HTML 标签只留段落、标题、列表、引用、代码块、表格、图片、链接、强调、图注等语义结构；HTML 属性只留 `href`、`src`、`alt`、`title`、`class`、`colspan`、`rowspan`、`datetime`；`style` 与全部 `data-*` 剥除；`script`、`iframe`、`object`、`embed`、表单控件、音视频等禁止。
7. 内嵌 SVG 走独立静态白名单：保留图形、路径、文本、渐变、剪裁与标记，属性保留几何、颜色与安全 presentation 样式；`script`、事件、动画、`foreignObject`、嵌套位图、`use`、外部 `href` 与非本地 `url()` 全部移除。Readability 前先解析页面级及 SVG 内部的 `style` 与 class，把匹配 SVG 的安全声明按属性合并到图形，再清理源码样式，最终正文不含 SVG `style` 标签或 class。HTML 的 `style` 仍整体剥离，只有 SVG 的 presentation 声明按属性白名单保留。
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

## 图片

- 下载在主进程，3 并发，单图 20 秒超时；失败不重试，`ImageAsset.status` 记 pending/done/failed。
- 正文提取完成后先进入预览，图片在后台下载并原地更新；下载失败保留 originalUrl，预览用占位图展示，不阻断正文。
- 外链 SVG 图片与位图走同一下载链路，缓存保留 `.svg` 并以 `image/svg+xml` 提供；内嵌 SVG 由净化白名单直接保留，不进入下载。
- 微信图片下载使用站点表里的请求头；缓存命中则跳过网络下载，布局与复用规则见「缓存与存储」。
- 预览重写：done 的 `img` 的 `src` 换成 `fucha://img/<articleHash>/<file>`；failed 换成占位图。

## 主题系统

### Token 契约

主题 token 是纯数据，单位随字段注明。预览画布的 contentWidth 676 是内容宽度上限，padding 24 是固定内边距；这两个是预览常量，不进入 token，也不参与导出，空间不足时内容随可用宽度收窄。微信正文宽度由客户端决定。圆角统一成 borderRadius，引用、代码、图片共用。

```ts
interface ThemeToken {
  id: string
  name: string
  builtin: boolean
  text: {
    fontSize: number // px 正文
    smallSize: number // px 代码、表格、图注、来源脚注
    lineHeight: number // 倍数
    letterSpacing: number // em
    paragraphSpacing: number // px
    color: string
    muted: string
  }
  primary: string // 标题装饰与引用边条共用
  surface: string // 引用、代码、表头共用的块底色
  border: string // 表格边框与分割线共用的线色
  borderRadius: number // px 引用、代码、图片共用
  heading: {
    color?: string // 缺省随 text.color
    h1: number // px 章节级，文章大标题由微信平台渲染
    h2: number
    h3: number // h4 起回落正文加粗
    align: 'left' | 'center'
    decoration: 'none' | 'bar' | 'underline' | 'bracket'
    spacingAbove: number // px
    spacingBelow: number // px
  }
  quote: {
    padding: number // px
  }
  code: {
    hljsTheme: string // highlight.js 主题名，只提供语法色
    lineHeight: number // 倍数，代码块通常比正文紧
    padding: number // px
  }
  table: {
    cellPadding: number // px
  }
  image: {
    spacing: number // px 图与上下文的间距
  }
  divider: {
    style: 'line' | 'dots' | 'none'
  }
}
```

强调文字只加粗并继承正文色，小字统一使用 smallSize，标题装饰与引用边条统一使用 primary，来源脚注使用 muted，不再为同一视觉职责设置第二份 token。

数值字段的范围与技术长文预设默认值（滑杆与校验共用这套边界）。整数项取偶数，滑杆步长 2；行高与字距是倍数，保留小数：

| 字段                         | 范围                  | 默认         |
| ---------------------------- | --------------------- | ------------ |
| text.fontSize                | 14 至 18              | 16           |
| text.smallSize               | 12 至 16              | 14           |
| text.lineHeight              | 1.5 至 2.2            | 1.75         |
| text.letterSpacing           | 0 至 0.1em            | 0.03         |
| text.paragraphSpacing        | 4 至 20               | 12           |
| heading.h1 / h2 / h3         | 18-26 / 16-22 / 16-20 | 22 / 20 / 18 |
| heading.spacingAbove / Below | 12-36 / 8-24          | 24 / 12      |
| quote.padding                | 8 至 20               | 12           |
| code.padding                 | 8 至 20               | 16           |
| code.lineHeight              | 1.4 至 2.0            | 1.6          |
| table.cellPadding            | 4 至 12               | 8            |
| image.spacing                | 8 至 24               | 16           |
| borderRadius                 | 0 至 12               | 4            |

校验只要求必填字段；heading.color 未显式覆盖时随 text.color 变化。其余颜色不设覆盖分支，避免同一元素同时受基础色与派生色两个入口控制。

技术长文预设配色为中性，与应用配色无关：primary #0969da、text #333333、muted #6b7280、surface #f6f8fa、border #d0d7de、hljsTheme github，标题左对齐加装饰条。中文行高 1.75 是公众号舒适区；主色只上装饰元素，链接与脚注用深灰加下划线。标题装饰只用真实元素实现，`bar` 用边框、`underline` 用底边、`bracket` 用首尾内联元素，不依赖伪元素，因为微信会剥离伪元素。

### 一份生成逻辑，两条渲染路径

预览与导出是两条渲染路径，这是最容易出偏差的地方。预览用 CSS 变量加 class，快；导出用 juice 把样式表内联进 style 属性，准。两者必须共用同一份 CSS 生成函数 `generateCss(token)`：函数先产出声明表，预览路径物化为 CSS 变量，导出路径输出解析后的具体值。juice 不解析 `var()`，导出路径不能留变量。组件不手写文章样式字面量，全部经 `generateCss`，这是一致性的唯一保证。

两条硬约束保证一致性：生成函数只输出元素级选择器（h1、p、blockquote、pre code、table 等），不生成嵌套与伪类，避开 juice 内联不全；文章样式的全部排版属性由生成函数显式给出，不依赖 Tailwind preflight 或浏览器默认值，否则预览（应用文档）与微信（自有基线）必然分叉。

高亮选 highlight.js 而非 shiki：hljs 同步、体积轻一个量级，输出 class 由 juice 统一内联成 style；微信只认内联样式，TextMate 级高亮精度在这里收益趋零。常用语言子集显式注册，检测失败落纯文本。hljsTheme 只提供语法色；生成 CSS 时剥掉 hljs 主题自带的背景声明，代码块底色统一取 surface，避免主题名与底色两个来源。

### 主题面板、持久化与自动生成（M2）

三层：内置预设、用户自定义、会话内临时调整。前期只做一套面向技术长文的预设，代码块与表格优先。

主题面板切换预设、逐项调 token，色值用取色器，数值用滑杆，取值范围取自 token 契约的常量表，改动实时反映到预览；可选颜色字段是「跟随基础色 / 显式覆盖」两态，覆盖可清除。另存为自定义主题落到 userData 目录，支持重命名、删除、导出 JSON、导入（复用 token 校验）。入口在主题选择下拉：列表为内置预设加自定义主题，底部动作项是编辑当前主题与管理自定义主题；面板位于预览上方的元信息区域，编辑时替换元信息带——预览永不被遮挡，实时反馈是硬约束。

编辑走会话草稿：改动只进内存工作副本，另存为才落盘，离开或切换时未保存的调整给提示。

token 生成作为面板的增强：从 og:image 与 favicon 取主色写入 primary，标题装饰与引用边条随之更新，surface 与 border 保持预设中性色。按内容特征（代码块、表格密度）自动选预设，实现是纯函数 `deriveToken(article): Partial<ThemeToken>`。生成结果作为基于当前预设的微调建议，可见可改、一键还原，不静默覆盖；取色需过对比度校验（阈值 3.0），不达标降级为默认色。不做从源站学整套排版——公众号正文的最佳实践是收敛的，生成的价值在给一个对的起点。封面与 favicon 的字节由主进程读取后交给渲染进程取色，避免跨域 canvas 污染。

### 导出

导出输入是净化后的 `Article.html`（原始图片地址），不是预览 HTML（`fucha://` 地址），否则本地协议地址会漏进产物。管道按顺序：

1. 渲染进程用 `generateCss(token)` 生成导出用具体值样式表，highlight.js 高亮代码块。
2. juice 把样式内联到元素的 `style` 属性。
3. 过微信安全属性表，剔除 position、float、grid 等不支持属性。结构层黑名单在净化阶段已经处理。
4. 附加来源行，文末脚注式，含原文链接与作者。来源信息与预览元信息栏同源于 Article。
5. 主进程 `exportHtml` 从缓存读取图片，转 base64 data URI 写入 `img` 的 `src`；超过单图上限或缓存中不存在的换成位图占位。
6. `copyHtml` 走主进程 `clipboard.write` 写 HTML 格式，`saveFile` 走系统对话框落盘；两者产物一致。

单图上限先定 5MB（按原始文件字节），实测后调整。webp/avif 的微信端兼容性在 M1 清单中实测，不通过则在导出前转成 jpeg/png。占位图导出用位图 data URI，不用 SVG。

微信约束：

- `只认内联样式`：style 标签、外部 CSS、class 样式一律被剥离，样式必须落到元素 style 属性。
- `图片必须 base64 内联`：外链图片会裂图，产物里的图片必须是 base64 data URI；微信编辑器粘贴时会自动转存。
- `正文不能放外链`：可选脚注、二维码或挂到阅读原文。本应用只自动做文末脚注，二维码与阅读原文由用户按需自行处理。
- `布局能力受限`：position 与 float 基本失效，伪元素不可用，flex 部分可用，grid 别想，复杂排版靠 table 与 section 拼。
- `代码块`：包 pre 加 `overflow-x: auto`，保证横向滚动不折行。

## 界面

配色只属于应用壳：主色 #8fae96（鼠尾草绿）做焦点环、生成按钮、激活态，实底按钮配深色文字（主色对比度不足以承文字）；顶部命令栏用深灰绿，正文区域用白色，骨架屏用浅灰绿。预览与导出的文章样式完全由 ThemeToken 决定，不经 Tailwind，与应用配色互不影响——预览保真不吃应用品牌。

视觉基调是简洁大方优雅，六条：留白分组不画框，分隔只用 1px 极淡中性灰线；色彩纪律，大面积白与深灰绿命令栏，主色点缀，单屏占比很小；层级靠底色不靠投影，应用画布、深色命令栏、白色内容三级；动效轻短，内容淡入约 200ms ease-out，无弹跳无循环，尊重系统减少动态效果设置；字号底盘，正文 14、次级 13、区块标题 16 至 20、最小 12；控件圆角 8px，与文章内容圆角 token 是两套。

字体走系统栈（mac 即 PingFang），统一样式重置与滚动条样式。

窗口默认 1180 × 800，最小 1000 × 700。顶部命令栏固定 64px；正文为单栏，内容宽度上限 676px，两侧共 48px 内边距，空间不足时随窗口收窄。

### 交互流程

| 状态   | 顶部命令栏                                                      | 正文区域                                                                           | 去向                           |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------ |
| 初始态 | 左侧品牌标识                                                    | 左对齐链接表单，占位提示「请输入一个链接」，紧挨「生成」按钮；回车与点击等价       | 提交后进入加载态               |
| 加载态 | 品牌右侧保留紧凑输入区，生成按钮禁用                            | 白色骨架屏，小字标注：正在请求、正在解析                                           | 成功后进入预览，失败进入失败态 |
| 预览态 | 紧凑输入区可再次提交，右侧依次为主题选择、保存 HTML、复制主按钮 | 正文上方横向元信息带：标题、来源主机名、作者、发布时间、图片下载状态；下方文章预览 | 新链接直接回到加载态           |
| 失败态 | 紧凑输入区保留                                                  | 错误显示在骨架屏原位，附重试                                                       | 重试回到加载态                 |

骨架屏在成功后原地淡出为预览。导出不是独立页面，顶部命令栏的复制与保存都产出一致的内联样式 HTML。

预览直接渲染净化后的 HTML，主题切换走 CSS 变量即时生效。顶部命令栏自点击生成那一刻保持稳定，此后只有正文区域的内容在变，不闪不跳。

## 目录结构

标 + 的为待建，其余已在仓库。需求与规格在 `openspec/` 下按 change 组织，规则见 AGENTS.md，实现清单看对应 change 的 `tasks.md`。本文维护跨 change 的架构、机制与常量；change 文档只记录本次取舍与任务，不重复本文细节。

```
src/
  main/
    index.ts              窗口创建与生命周期
    ipc.ts                抓取、图片下载、fucha:// 协议、导出图片内嵌
  preload/
    index.ts              暴露 IPC 接口
    index.d.ts            暴露接口的类型声明
  renderer/
    index.html            入口页
    src/
      main.tsx            渲染进程入口
      App.tsx             四态状态机与整体布局
      env.d.ts
      views/
        ComposeView.tsx   初始输入表单与顶部紧凑输入区
        PreviewView.tsx   顶部输入区宿主与横向文章元信息
      components/
      + ThemePanel.tsx    主题下拉、编辑面板（M2）
      pipeline/
        extract.ts        Readability 提取与置信度判断
        sanitize.ts       DOMPurify 白名单
        images.ts         图片路径映射与预览重写
        export.ts         token 内联、微信属性过滤与来源行（M1）
      theme/
      + tokens.ts         token 类型、校验与范围常量表（M1）
      + apply.ts          token 转 CSS 变量与导出样式（M1）
      + derive.ts         由文章生成 token 建议（M2）
      + store.ts          主题与偏好读写（IPC 客户端，M2）
      + presets/technical.json  内置技术长文预设（M1）
      styles/
        app.css           Tailwind 入口与 @theme（应用壳配色与基调）
        article.css       M0 预览基线样式（M1 起由主题渲染取代）
  shared/
    types.ts              跨进程数据契约（含 IPC 接口签名）
    profiles.ts           域名适配（微信必须，其余按需）
```

## 里程碑

`M0`：界面四态与应用壳配色基调，主进程抓取，Readability 提取，DOMPurify 净化，微信公众号文章可用（data-src 取图、Referer 下载、验证码抛错）。拿二十个不同类型链接验证提取正确率。

`M1`：内置主题加导出内联 HTML，产出物直接粘进公众号后台不改格式。建微信兼容性检查清单，逐条验证标题、列表、引用、代码块、表格、图片、分割线，另加深色模式代码块配色、图片宽度降级两项实测，规则一变立刻重跑。

`M2`：主题编辑面板加自定义主题持久化，加 token 自动生成（取主色与自动选预设）。

后置（需要时再排）：自绘标题栏与系统控件、Windows 一致性对照、签名与公证分发。打包链路有一处上游版本不匹配待处理：app-builder-lib 需要 @electron/get 3.1 的 ElectronDownloadCacheMode，lockfile 仍锁在 3.0.0，`build:unpack` 会报错。

## 风险

`微信规则会变`：过滤策略无官方文档，靠实测，清单要能快速重跑。

`抓取合规`：尊重 robots.txt，抓取他人原创内容用于发布前需获授权。界面固定显示来源链接与原作者。robots 检查目前尚未落到抓取代码，作为对外发布前的合规项补齐。

`正文不可编辑`：提取质量差时无法在应用内修正，只能换来源。后续若确有需要，再引入 Tiptap 做最小编辑。

`跨平台`：Windows 需要单独验证 `fucha://` 的路径服务与字体渲染。当前协议处理按 `/` 拼路径前缀，Windows 的 `resolve()` 产出反斜杠，需要按 `path.sep` 处理。

`签名`：对外分发才需要，自用可跳过。
