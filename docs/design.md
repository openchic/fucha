# 浮槎

本文记录浮槎的产品边界、架构和界面约定。使用方式见 [README](../README-zh_CN.md#怎么用)。

## 非目标

不做应用内正文编辑（预览只读，提取质量靠抓取端保证）、不做多平台分发、不做 AI 改写、不做账号登录、不接素材库 API 与第三方图床。只服务「链接进、公众号文章出」这一条路。

## 命名

浮槎，读音 fú chá。出自晋代张华《博物志》：天河与海相通，海边有人年年八月见浮槎往来，从不错期。取「从此岸渡到彼岸」之意，把一篇文章从它原本所在的地方，渡到它要去的地方。

正式安装包显示为「浮槎」，Bundle ID 为 `com.ls63cc.fucha`。单独打包的开发版显示为「浮槎 Debug」，Bundle ID 为 `com.ls63cc.fucha.dev`；`pnpm dev` 仍使用 Electron 开发运行时，不改变 Electron.app 的 Bundle ID。开发运行与 Debug 安装包共用开发版 [数据目录](local-store.md#存储边界)，与正式版隔离。

图标用斜放的浮木和两道水纹表现「渡」。槎字生僻，README 标题标注读音。图形见 [SVG 源文件](../build/macos-icon.svg)。

## 技术栈

应用基于 Electron、React 和 TypeScript，使用 electron-vite 开发、electron-builder 打包。Electron 提供一致的 Chromium 渲染环境。应用壳使用 Tailwind，页面由 React Router 管理。

## 架构

### 进程分工

主进程与渲染进程的边界由两件事决定：渲染进程的 fetch 受同源策略限制，主进程不受；渲染进程开了 sandbox，不能直接读写磁盘。

| 层       | 职责                                                                                    | 为什么在这一层                                                                       |
| -------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 主进程   | 抓取、图片下载与缓存、`app://` 协议、文件读写、主题与偏好存储、导出末端图片内嵌、剪贴板 | 网络请求不受同源策略限制，且只有它能直接访问磁盘与系统剪贴板                         |
| preload  | 通过 contextBridge 暴露 `window.api` 单一命名空间                                       | sandbox 渲染进程只能经它调用 IPC                                                     |
| 渲染进程 | HTML 解析、Readability 提取、DOMPurify 净化、预览渲染、主题 CSS 生成、juice 内联        | 自带 DOM，省掉主进程再装一份 DOM 实现；净化贴着解析入口做，进 React 状态的数据已安全 |

跨进程方法和数据类型统一定义在 [AppApi](../src/shared/types.ts) 中。

### 主链路

```
输入 URL
  │ window.api.fetchArticle(url)
  ▼
主进程抓取 ── 失败 ──► 错误四分类 ──► 失败态
  │ { html, finalUrl }
  ▼
渲染进程提取与净化
  DOMParser → base 归一 → 站点适配 → Rspress 代码块归一 → Readability → DOMPurify
  │ Article
  ├──────────────► 预览链路
  │                 downloadImages（主进程）
  │                 img src → app://
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

- `app://` 在 app ready 前注册为 privileged scheme（standard、secure、supportFetchAPI、stream），ready 后由 `protocol.handle` 服务。
- 路径形态 `app://img/<articleHash>/<file>`，只服务 `userData/article-cache/`；路径归一化后必须仍在缓存目录内，防路径穿越。
- 渲染进程用 `img` 的 `src` 直接引用，不把图片字节经 IPC 复制成 blob URL。
- 选自定义协议而不选 `file://`：dev 下渲染源是 http、打包后是 file，`file://` 图片在 dev 会被 CSP 拦；自定义协议把两端行为拉平。
- CSP 放行 `default-src 'self'`、`script-src 'self'`、`style-src 'self' 'unsafe-inline'`、`img-src 'self' data: app:`、`font-src 'self' data:`；`data:` 字体仅供提取净化器生成的安全内嵌 SVG 字体使用。

### 缓存与存储

- 文章图片按文章归档：`userData/article-cache/<articleHash>/<内容 hash>.<ext>`，文件名取内容 SHA-1；同目录的 `index.json` 记 URL 到文件名的映射，重复提交直接复用。
- 主进程用 SQLite 保存文章快照、图片元数据、自定义主题和偏好。表结构、迁移与故障降级见 [本地存储](local-store.md)。

### 安全基线

- contextIsolation 与 sandbox 开启，nodeIntegration 关闭。sandbox 在窗口配置里显式开启，另外两项沿用 Electron 默认值。
- 渲染进程不直接加载远程页面。预览容器拦截文章内的链接点击，交给系统浏览器打开，不在应用窗口内导航。
- 内容净化、`app://` 路径校验与 CSP 分别见「提取与净化」「本地图片协议」，此处不重复。

## 抓取

- 默认：主进程原生 fetch，覆盖多数文档站与博客。
- 请求参数：15 秒超时，跟随重定向，带桌面浏览器 UA；检查 content-type 是否为 html/xhtml/纯文本；按响应头 charset 解码，缺省 utf-8。
- 微信：文章页与图片域名（`mmbiz.qpic.cn`）都命中站点表，图片下载带 `Referer: https://mp.weixin.qq.com/` 绕防盗链；页面命中验证码特征时显式抛错，不能静默返回空内容。
- 抓取依赖服务器返回的 HTML，完全由客户端脚本生成的正文可能无法提取。
- 站点差异集中在 `src/shared/profiles.ts` 的域名表，主管线不出现按域名分支的抓取逻辑。生成器级的结构差异（如 Rspress 代码块标题）走独立适配器，不进入域名表。

## 提取与净化

顺序固定，前一步的输出是后一步的输入：

1. 用 `DOMParser` 解析 HTML。解析出的文档是惰性的，不执行脚本。
2. 以 `finalUrl` 作为文档 base。Readability 按 `doc.baseURI` 解析相对地址，不设 base 会落到应用自身地址，相对图片和链接都会坏。微信等站点若把正文容器以内联 `visibility` / `opacity` 预先隐藏，先解除隐藏，否则 Readability 会把正文判为不可见；站点导航或交互组件按 `profiles.ts` 的清理选择器在提取前或提取后移除。
3. 微信图片把 `data-src` 写回 `src`，只在 `src` 为空或以 `data:` 开头时覆盖。必须在净化前做，因为 DOMPurify 会把 `data-*` 属性剥掉，之后再映射就找不到真实地址。
4. 从 meta 提取标题、作者、发布时间、封面；标题缺失时回落 `document.title`。
5. 在交给 Readability 前，先按 `.rp-codeblock` 标记归一 Rspress 代码块：带标题的块转为 `figure.code-block > figcaption + pre` 的通用结构，无标题的块只保留代码与声明语言；适配器独立在 `pipeline/rspress.ts`，主管线不按域名分支。然后交给 Readability 抽正文；正文字符数低于 200 视为非文章页，直接失败。
6. DOMPurify 白名单净化。HTML 标签只留段落、标题、列表、引用、代码块、表格、图片、链接、强调、图注等语义结构；HTML 属性只留 `href`、`src`、`alt`、`title`、`class`、`colspan`、`rowspan`、`datetime`；`style` 与全部 `data-*` 剥除；`script`、`iframe`、`object`、`embed`、表单控件、音视频等禁止。
7. 内嵌 SVG 走独立静态白名单：保留图形、路径、文本、渐变、剪裁与标记，属性保留几何、颜色、安全 presentation 样式及 `text` / `tspan` 上的安全数值 `dx`、`dy`；`script`、事件、动画、`foreignObject`、嵌套位图、`use`、外部 `href` 与非本地 `url()` 全部移除。若 `foreignObject` 仅含一个纯文本标题（可由安全行内标签包裹，并带无可见文本的装饰节点），则在净化前转换为静态 SVG 文字，并沿用标题及祖先中匹配到的安全字体、字号、字重、字形与颜色；`h1` 的线条读取来源底边框样式。只保留 SVG 实际引用、来源为受限 `data:` 字体的 `@font-face`，并通过 CSP 的 `font-src 'self' data:` 加载。Readability 前先解析页面级及 SVG 内部的 `style` 与 class，把匹配 SVG 的安全声明按属性合并到图形，再清理源码样式，最终正文不含来源 SVG `style` 标签或 class。HTML 的 `style` 仍整体剥离，只有 SVG 的 presentation 声明按属性白名单保留。
8. 从净化结果收集图片清单，只收 `http(s)` 绝对地址，按 URL 去重；内嵌 SVG 不走图片下载。

输出 [Article](../src/shared/types.ts)。其中 `html` 保存已净化的正文，图片地址仍指向原始来源。

## 图片

- 下载在主进程，3 并发，单图 20 秒超时；失败不重试，`ImageAsset.status` 记 pending/done/failed。
- 正文提取完成后先进入预览，图片在后台下载并原地更新；下载失败保留 originalUrl，预览用占位图展示，不阻断正文。
- 外链 SVG 图片与位图走同一下载链路，缓存保留 `.svg` 并以 `image/svg+xml` 提供；内嵌 SVG 由净化白名单直接保留，不进入下载。
- 微信图片下载按图片域名匹配站点表里的请求头（文章域名与 `mmbiz.qpic.cn` 共享配置）；缓存命中则跳过网络下载，布局与复用规则见「缓存与存储」。
- 预览重写：done 的 `img` 的 `src` 换成 `app://img/<articleHash>/<file>`；failed 换成占位图。

## 主题系统

文章正文样式由 ThemeToken 与 `theme.css` 决定。渲染进程从同一份净化正文生成应用预览和公众号 HTML，再由主进程完成导出的图片内联与剪贴板写入。

字段、主题包和样式处理见 [排版主题](theme-system.md)。公众号侧的约束和验证方法见 [导出规格](../openspec/specs/wechat-export/spec.md)与 [兼容性清单](wechat-checklist.md)。

## 界面

应用壳采用墨黑、中性灰和烟灰蓝，危险操作使用警示红。首页、文章与设置共用白色圆角内容面板。应用壳配色独立于正文主题，颜色、字号和动效常量见 [设计 token](../src/renderer/src/styles/tokens.css)。动效遵循系统的减少动态效果设置。

应用默认进入 Home 输入页。历史栏与设置导航展开时宽 248px，可折叠，折叠状态保存在本地。历史项单行显示标题并高亮当前文章，悬停或键盘聚焦时可打开删除菜单。

历史栏的设置按钮和文章主题下拉底部的「主题管理」均进入 `/settings/themes`。操作与保存行为见 [设置页与主题管理](theme-system.md#设置页与主题管理)。

窗口启动大小以 1200 × 800 为上限，受主屏可用空间约束，配置的最小尺寸为 1000 × 700。正文单栏宽度上限为 676px，窗口变窄时随之收缩。

macOS 隐藏系统标题栏，红绿灯直接覆盖在内容上，不保留系统标题文字或应用自绘顶栏。所有状态统一由应用壳顶部固定的 24px 透明空白带触发窗口拖动，该区域不占据文档流、不增加头部高度；文章信息带、加载说明、错误与正文区域均不触发拖动，标题和正文可正常选择，输入框、按钮与链接保持正常交互。

macOS 运行期间在菜单栏常驻应用图标，点击弹出「打开」「关于」「退出」（⌘Q）：打开会新建或召回主窗口，退出则完全结束应用；关闭窗口不退出应用。

### 交互流程

| 状态   | 页面内容                                                                                                     | 去向                           |
| ------ | ------------------------------------------------------------------------------------------------------------ | ------------------------------ |
| 输入态 | 左侧历史栏保留；右侧居中是单个药丸链接表单，占位「粘贴文章链接」，右端内嵌「生成预览」，回车与点击等价       | 提交后进入加载态               |
| 加载态 | 右侧显示工具栏与正文骨架，可取消并带着已提交的链接回到输入态                                                 | 成功后进入预览，失败进入失败态 |
| 预览态 | 历史栏高亮当前文章，右侧工具栏显示标题、来源与操作，下方为只读正文                                           | 新建进入输入态，历史切换文章   |
| 失败态 | 左侧历史栏保留；右侧内容列居中显示错误分类、具体原因与「重新尝试」「返回修改链接」，不设信息带、分隔线或卡片 | 重试回到加载态，新建进入输入态 |

路由用 Hash：`/` 是 Home 布局的 index，即 New 输入页；`/preview` 是 Home 的子路由，右侧 Outlet 承载文章，`/preview?url=&hash=` 打开本地快照；加载与失败是 Preview 子路由内的状态。`/settings` 是 Home 的兄弟布局，index 重定向到 `/settings/themes`，其下 `themes` 是主题列表、`themes/new` 与 `themes/:id` 是主题配置，不套在 Home 的 Outlet 下。Preview 缺少目标地址时回到 `/`，`/new` 等未知路径由兜底路由回到 `/`。生产从 `file://` 加载，Hash 路由刷新时不会请求不存在的路径。链接随 `?url=` 进地址，刷新即按该链接重跑，不再另存上次链接。

点击「新建」回到输入页，同时停止尚未完成的图片更新。输入框整体是一个焦点目标，聚焦时边框使用烟灰蓝，出错时改用警示红。校验提示左缩进 19px，与字段内链接图标对齐。输入框提供清除按钮，「生成预览」始终可点。省略协议的有效域名自动补全 HTTPS，空链接、非 HTTP(S) 链接、带账户密码或空白的链接会在输入框下提示。

加载与预览共用 44px 工具栏，骨架首行与正文首内容共用 40px 顶部内边距。预览工具栏左侧显示单行省略的 14px 标题和来源图标，悬停图标可查看完整 URL。右侧显示状态和操作，发布时间在窗口宽度达到 1100px 时显示，作者、域名及图片下载状态不在工具栏展示。操作依次为重新提取、手机预览、复制和主题选择，在最窄窗口也不换行。

打开手机预览时，正文区使用与主题配置页相同的设备预览面板，默认 iPhone 18 Pro。文章预览隐藏「示例文章」标题。

整页骨架用于首次网络提取和网络回退，提取成功后原地淡出。从历史打开本地快照时静默读取。图片下载完成后按 ID 更新已有 `img` 的 `src`，保留正文节点与滚动位置。点击「重新提取」时，保留当前正文和历史栏，并用应用内提示反馈进度与结果。

## 源码入口

- [主进程](../src/main)负责窗口、网络请求、存储和系统接口。
- [preload](../src/preload)提供 `window.api`。
- [渲染进程](../src/renderer/src)包含页面和组件、提取与导出管线以及主题渲染。
- [共享代码](../src/shared)定义跨进程契约、主题校验和站点适配。

当前行为见 [OpenSpec 主规格](../openspec/specs)。开发流程见 [AGENTS.md](../AGENTS.md)。

## 已知限制

- 微信端验证项目集中在 [兼容性清单](wechat-checklist.md)。
- Windows 的图片协议和字体渲染需在目标平台验证。
- GitHub 发布需配置日志生成、Developer ID 签名和 Apple 公证凭据；流程与失败重试约束见 [发布说明](release.md)。
