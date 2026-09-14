# 浮槎 fucha

把一个链接，变成一篇可以直接发进公众号的文章。

打开只有一个输入框和一个生成按钮，粘贴链接，右侧展开公众号效果预览，套上主题，一键复制进公众号编辑器。

## 非目标

不做应用内正文编辑（预览只读，提取质量靠抓取端保证）、不做多平台分发、不做 AI 改写、不做账号登录、不接素材库 API 与第三方图床。只服务"链接进、公众号文章出"这一条路。

## 命名

浮槎，读音 fú chá。出自晋代张华《博物志》：天河与海相通，海边有人年年八月见浮槎往来，从不错期。取"从此岸渡到彼岸"之意——把一篇文章从它原本所在的地方，渡到它要去的地方。副标：渡文过海。

图标用"渡"方案：一根横木加一道弧线，16px 可辨。已知风险：槎字生僻，易误读为"差"。应对是图标不依赖文字即可识别，README 首行固定标注读音"浮槎（fú chá）"。

## 技术栈

已有脚手架：electron-vite + React 19 + TypeScript + pnpm + electron-builder。

选 Electron 而非 Tauri：渲染内核可控，界面不受系统 WebView 差异影响，代价是包体与内存偏高，可接受。

待装依赖：

`提取`：@mozilla/readability
`净化`：dompurify
`高亮`：highlight.js（输出 class，导出时由 juice 一并内联成 style）
`内联`：juice

存储不引库：自定义主题与偏好都是 userData 下的 JSON 文件，fs 直接读写。

工具链版本锁在 TypeScript 5.9 与 ESLint 9：@vainjs/eslint-config 的 peer 要求 TS ^5.9，typescript-eslint 只支持 TS 小于 6.1，eslint 插件（import、react、react-hooks）最高到 9。三者互相牵制，升 TS 或 ESLint 要同时换掉这一组，不能单独抬版本。ESLint 用该包的 react 预设，React 19 走自动运行时故关掉 react-in-jsx-scope，并忽略 out/ 与 dist/ 构建产物。

## 架构分工

主进程与渲染进程的边界由一件事决定：渲染进程的 fetch 受同源策略限制，主进程不受。

`主进程`：抓取（原生 fetch）、图片下载、文件读写、主题与偏好存储，并以自定义协议 `fucha://` 把本地图片供给渲染进程。preload 暴露 IPC：fetchArticle、downloadImages、exportHtml、saveFile、store 读写。
`渲染进程`：解析（DOMParser 加 Readability 加 DOMPurify）、渲染、导出。

抓取策略：

`默认`：主进程 fetch，覆盖多数文档站与博客。
`微信`：图片真实地址在 `data-src` 而非 `src`，下载要带 Referer 绕防盗链；验证码必须显式抛错，不能静默返回空内容。
`其余站点`：按需加域名级选择器与请求头配置。客户端渲染站点 fetch 拿不到正文时，再考虑隐藏 BrowserWindow 兜底，暂不实现。

安全基线：contextIsolation 与 sandbox 开启，nodeIntegration 关闭；抓取的 HTML 过 DOMPurify 后才进渲染。本地图片走 `fucha://` 而非 file://，避免 dev（http 源）与打包后（file 源）下 CSP 行为不一致；CSP 放行 `'self'`、`data:` 与 `fucha:`。

## 界面

配色只属于应用壳：主色 #8fae96（鼠尾草绿）做焦点环、生成按钮、激活态，辅助色 #eadfcf（奶油米）做面板与骨架屏底，实底按钮配深色文字（主色对比度不足以承文字）。预览与导出的文章样式完全由 ThemeToken 决定，与应用配色互不影响——预览保真不吃应用品牌。

视觉基调是简洁大方优雅，六条：留白分组不画框，分隔只用 1px 极淡暖灰线；色彩纪律，大面积白与奶油底，主色点缀，单屏占比很小；层级靠底色不靠投影，白内容、奶油面板两级；动效轻短，滑入淡出约 240ms ease-out，无弹跳无循环；字号底盘，正文 14、次级 13、区块标题 16 至 20、最小 12；控件圆角 6 至 8px，与文章内容圆角 token 是两套。

字体走系统栈（mac 即 PingFang），统一样式重置与滚动条样式。

窗口默认 1180 × 800，最小 1000 × 700——左列约 240px 加预览 677px 再加间距，是两栏布局的下限。

## 交互流程

`初始态`：居中一个输入框，占位提示"请输入一个链接"，紧挨一个"生成"按钮；回车与点击等价。
`加载态`：提交后输入区从居中平滑移到左列，右侧同时滑入骨架屏（约 240ms ease-out），生成按钮禁用；三阶段（正在请求、正在解析、正在下载图片）以小字标注在骨架屏内。
`预览态`：骨架屏原地淡出为公众号文章预览。左列保留输入区，下方元信息栏（标题、来源、作者、发布时间、图片清单）；右栏顶部一行操作栏，右侧依次为主题选择、复制按钮，保存 HTML 为复制旁的次要按钮。左列输入区仍可提交，新链接直接回到加载态。
`导出`：操作栏的复制与保存，两者产物一致——内联样式 HTML。
`失败`：错误显示在右栏骨架屏原位，附重试。

预览直接渲染净化后的 HTML，主题切换走 CSS 变量即时生效。布局自点击生成那一刻稳定为左右结构，此后只有右栏内容在变，不闪不跳。

## 目录结构

标 + 的为待建，其余已就位。需求与规格在 `openspec/` 下按 change 组织，规则见 AGENTS.md，本文只描述设计与架构。

```
src/
  main/
    index.ts              窗口创建与生命周期
  + ipc.ts                抓取、图片下载、文件读写
  + profiles.ts           域名适配（微信必须，其余按需）
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
      + ComposeView.tsx   初始态：居中输入框加生成按钮
      + PreviewView.tsx   左列输入区与元信息，右栏操作栏与预览
      components/
      + ThemePanel.tsx    主题下拉、编辑面板（左列）
      pipeline/
      + extract.ts        Readability 提取与置信度判断
      + sanitize.ts       DOMPurify 白名单
      + images.ts         图片路径映射与缓存清理
      + export.ts         内联渲染与写剪贴板
      theme/
      + tokens.ts         token 类型、校验与范围常量表
      + apply.ts          token 转 CSS 变量与导出样式
      + derive.ts         由文章生成 token 建议
      + store.ts          主题与偏好 JSON 读写
      + presets/technical.json
      styles/
      + reset.css
      + app.css           应用壳配色与视觉基调
shared/
+ types.ts                跨进程数据契约（含 IPC 接口签名）
```

## 数据契约

```ts
interface Article {
  title: string
  author?: string
  publishedAt?: string
  sourceUrl: string
  cover?: string
  html: string // 已净化
  images: ImageAsset[]
}

interface ImageAsset {
  id: string
  originalUrl: string
  localPath?: string // 下载失败时只有原地址，导出降级为外链或占位
  status: 'pending' | 'done' | 'failed'
  width?: number
  height?: number
}
```

主题 token 是纯数据，单位随字段注明。page 组仅预览用：contentWidth 677 模拟公众号编辑器视口，导出不携带宽度——微信正文宽度由客户端决定。圆角按块分离，不用全局单一值。

```ts
interface ThemeToken {
  id: string
  name: string
  builtin: boolean
  page: {
    contentWidth: number // px 仅预览，导出不携带
    padding: number // px 仅预览
  }
  text: {
    fontSize: number // px
    lineHeight: number // 倍数
    letterSpacing: number // em
    paragraphSpacing: number // px
    color: string
    muted: string
    strong: string
  }
  primary: string // 主品牌色：标题装饰、引用边条的默认来源
  heading: {
    color: string
    h1: number // px 章节级，文章大标题由微信平台渲染
    h2: number
    h3: number // h4 起回落正文加粗
    align: 'left' | 'center'
    decoration: 'none' | 'bar' | 'underline' | 'bracket'
    decorationColor: string // 缺省取 primary
    spacingAbove: number // px
    spacingBelow: number // px
  }
  quote: {
    background: string
    barColor: string
    padding: number // px
    borderRadius: number // px
  }
  code: {
    hljsTheme: string // highlight.js 主题名
    background: string // 兜底背景
    fontSize: number // px
    lineHeight: number // 倍数
    padding: number // px
    borderRadius: number // px
  }
  table: {
    headerBackground: string
    borderColor: string
    fontSize: number // px 通常 = 正文 − 1
    cellPadding: number // px
  }
  image: {
    borderRadius: number // px
    captionSize: number // px 图注字号
    spacing: number // px 图与上下文的间距
  }
  divider: {
    style: 'line' | 'dots' | 'none'
    color: string
  }
  footnote: {
    color: string // 缺省取 muted
    fontSize: number // px
  }
}
```

数值字段的范围与技术长文预设默认值（滑杆与校验共用这套边界）：

| 字段                         | 范围                  | 默认         | 字段              | 范围     | 默认 |
| ---------------------------- | --------------------- | ------------ | ----------------- | -------- | ---- |
| text.fontSize                | 15 至 17              | 16           | code.fontSize     | 12 至 15 | 14   |
| text.lineHeight              | 1.5 至 2.2            | 1.75         | code.padding      | 8 至 20  | 16   |
| text.letterSpacing           | 0 至 0.1em            | 0.03         | table.fontSize    | 12 至 16 | 15   |
| text.paragraphSpacing        | 4 至 20               | 12           | table.cellPadding | 4 至 12  | 8    |
| heading.h1 / h2 / h3         | 18-26 / 16-22 / 15-19 | 22 / 19 / 17 | image.spacing     | 8 至 24  | 16   |
| heading.spacingAbove / Below | 12-36 / 8-24          | 24 / 12      | image.captionSize | 12 至 14 | 13   |
| quote.padding                | 8 至 20               | 12           | footnote.fontSize | 12 至 14 | 13   |
| page.contentWidth / padding  | 600-800 / 12-32       | 677 / 24     | 各 borderRadius   | 0 至 12  | 4    |

技术长文预设配色为中性，与应用配色无关：primary #0969da、text 与 strong #333333、muted #888888、heading 色同 text、引用与代码底 #f6f8fa、表头 #f6f8fa、边框与分割线 #d0d7de、hljsTheme github、标题左对齐加装饰条。两条取值理由：中文行高 1.75 是公众号舒适区；主色只上装饰元素（对比度不足以承文字），链接与脚注用深灰加下划线。

## 主题系统

三层：内置预设、用户自定义、会话内临时调整。前期只做一套面向技术长文的预设，代码块与表格优先。

主题面板切换预设、逐项调 token，色值用取色器，数值用滑杆，取值范围取自 token 契约的常量表，改动实时反映到预览；另存为自定义主题落到 userData 目录，支持重命名、删除、导出 JSON。入口在主题选择下拉：列表为内置预设加自定义主题，底部动作项是编辑当前主题与管理自定义主题；面板本体开在左列，编辑时元信息折叠让位——预览永不被遮挡，实时反馈是硬约束。

token 生成作为面板的增强：从 og:image 与 favicon 取主色填入颜色族（primary、quote.barColor、table.headerBackground、divider.color、footnote.color），按内容特征（代码块、表格密度）自动选预设，实现是纯函数 `deriveToken(article): Partial<ThemeToken>`。生成结果作为基于当前预设的微调建议，可见可改、一键还原，不静默覆盖；取色需过对比度校验，不达标降级为默认色。不做从源站学整套排版——公众号正文的最佳实践是收敛的，生成的价值在给一个对的起点。

预览与导出是两条渲染路径，这是最容易出偏差的地方。预览用 CSS 变量加 class，快；导出用 juice 把样式表内联进 style 属性，准。两者必须共用同一份 CSS 生成函数，且该函数对导出必须输出解析后的具体值——juice 不解析 var()。

## 微信约束

`只认内联样式`：style 标签、外部 CSS、class 样式一律被剥离，样式必须落到元素 style 属性。
`图片必须 base64 内联`：外链图片会裂图。导出时转 base64，微信编辑器粘贴时自动转存，单图上限先定 5MB，实测后调整。
`正文不能放外链`：转成脚注、二维码，或挂到阅读原文。
`布局能力受限`：position 与 float 基本失效，伪元素不可用，flex 部分可用，grid 别想，复杂排版靠 table 与 section 拼。
`代码块`：包 pre 加 `overflow-x: auto`，保证横向滚动不折行。

渲染末尾挂白名单过滤器，把不支持的标签与属性提前降级。图片下载后落 userData 按文章归档，导出完成可清理。

## 里程碑

`M0`：界面四态与应用壳配色基调，主进程抓取，Readability 提取，DOMPurify 净化。拿二十个不同类型链接验证提取正确率。
`M1`：内置主题加导出内联 HTML，产出物直接粘进公众号后台不改格式。建微信兼容性检查清单，逐条验证标题、列表、引用、代码块、表格、图片、分割线，另加深色模式代码块配色、图片宽度降级两项实测，规则一变立刻重跑。
`M2`：主题编辑面板加自定义主题持久化，加 token 自动生成（取主色与自动选预设）。

后置（需要时再排）：自绘标题栏与系统控件、Windows 一致性对照、签名与公证分发。打包链路有一处上游版本不匹配待处理：app-builder-lib 需要 @electron/get 3.1 的 ElectronDownloadCacheMode，lockfile 仍锁在 3.0.0，`build:unpack` 会报错。

## 风险

`微信规则会变`：过滤策略无官方文档，靠实测，清单要能快速重跑。
`抓取合规`：尊重 robots.txt，抓取他人原创内容用于发布前需获授权。界面固定显示来源链接与原作者，导出自动附来源行。
`正文不可编辑`：提取质量差时无法在应用内修正，只能换来源。后续若确有需要，再引入 Tiptap 做最小编辑。
`签名`：对外分发才需要，自用可跳过。
