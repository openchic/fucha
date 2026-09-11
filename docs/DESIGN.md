# 浮槎 fucha

把一个链接，变成一篇可以直接发进公众号的文章。

打开只有一个输入框，粘贴链接，右侧直接展开公众号效果预览，套上主题，一键复制进公众号编辑器。

## 非目标

不做应用内正文编辑（预览只读，提取质量靠抓取端保证）、不做多平台分发、不做 AI 改写、不做账号登录、不接素材库 API 与第三方图床。只服务"链接进、公众号文章出"这一条路。

## 命名

浮槎，读音 fú chá。出自晋代张华《博物志》：天河与海相通，海边有人年年八月见浮槎往来，从不错期。取"从此岸渡到彼岸"之意——把一篇文章从它原本所在的地方，渡到它要去的地方。副标：渡文过海。

图标用"渡"方案：一根横木加一道弧线，16px 可辨。已知风险：槎字生僻，易误读为"差"。应对是图标不依赖文字即可识别，官网与 About 固定标注读音，README 首行写"浮槎（fú chá）"。

## 技术栈

已有脚手架：electron-vite + React 19 + TypeScript + pnpm + electron-builder。

选 Electron 而非 Tauri：渲染内核可控，界面不受系统 WebView 差异影响，代价是包体与内存偏高，可接受。

待装依赖：

`提取`：@mozilla/readability
`净化`：dompurify
`高亮`：highlight.js（输出 class，导出时由 juice 一并内联成 style，比 shiki 轻一个量级）
`内联`：juice

存储不引库：自定义主题与偏好都是 userData 下的 JSON 文件，fs 直接读写。不需要 jsdom：渲染进程本身就有 DOM，用 `DOMParser` 转 Document 交给 Readability。

## 架构分工

主进程与渲染进程的边界由一件事决定：渲染进程的 fetch 受同源策略限制，主进程不受。

`主进程`：抓取（原生 fetch）、图片下载、文件读写、主题与偏好存储。preload 暴露 IPC：fetchArticle、downloadImages、exportHtml、saveFile、store 读写。
`渲染进程`：解析（DOMParser 加 Readability 加 DOMPurify）、渲染、导出。

抓取策略：

`默认`：主进程 fetch，覆盖多数文档站与博客。
`微信`：图片真实地址在 `data-src` 而非 `src`，下载要带 Referer 绕防盗链；验证码必须显式抛错，不能静默返回空内容。
`其余站点`：按需加域名级选择器与请求头配置。客户端渲染站点 fetch 拿不到正文时，再考虑隐藏 BrowserWindow 兜底，暂不实现。

安全基线：contextIsolation 与 sandbox 开启，nodeIntegration 关闭；抓取的 HTML 过 DOMPurify 后才进渲染。

## 界面

字体走系统栈（mac 即 PingFang），统一样式重置与滚动条样式。自绘标题栏、Windows 的 DPI 与边框补偿、内嵌字体子集等一致性打磨，后置到做 Windows 版时一并处理。

## 交互流程

`初始态`：居中一个输入框，占满视觉重心。粘贴链接回车。
`加载态`：显示进度，区分正在请求、正在解析、正在下载图片。
`预览态`：左侧元信息栏（标题、来源、作者、发布时间、图片清单），右侧按主题渲染公众号效果，只读。
`导出`：一键复制内联样式 HTML 到剪贴板，另提供保存 HTML 文件。

预览直接渲染净化后的 HTML，主题切换走 CSS 变量即时生效。

## 目录结构

```
src/
  main/
    index.ts              窗口创建与生命周期
    ipc.ts                抓取、图片下载、文件读写
    profiles.ts           域名适配（微信必须，其余按需）
  preload/
    index.ts              暴露 IPC 接口
  renderer/src/
    App.tsx
    views/
      ComposeView.tsx     单输入框态
      PreviewView.tsx     左元信息 右预览
    components/
      ThemePanel.tsx      主题切换与自定义面板
    pipeline/
      extract.ts          Readability 提取与置信度判断
      sanitize.ts         DOMPurify 白名单
      images.ts           图片路径映射与缓存清理
      export.ts           内联渲染与写剪贴板
    theme/
      tokens.ts           token 类型与默认值
      apply.ts            token 转 CSS 变量
      store.ts            主题与偏好 JSON 读写
      presets/technical.json
    styles/
      reset.css
shared/
  types.ts                跨进程数据契约（含 IPC 接口签名）
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

主题 token 是纯数据。数值统一注明单位：fontSize 与 paragraphSpacing 是 px（正文 15 至 17），lineHeight 与 letterSpacing 是无单位倍数，radius 是 px。

```ts
interface ThemeToken {
  id: string
  name: string
  builtin: boolean
  colors: {
    primary: string
    text: string
    muted: string
    background: string
    codeBackground: string
  }
  typography: {
    fontSize: number // px
    lineHeight: number // 倍数
    letterSpacing: number // em
    paragraphSpacing: number // px
  }
  heading: {
    align: 'left' | 'center'
    decoration: 'none' | 'bar' | 'underline' | 'bracket'
  }
  block: {
    quoteBackground: string
    quoteBarColor: string
    codeTheme: string // highlight.js 主题名
    tableHeaderBackground: string
  }
  decoration: {
    radius: number // px
    divider: 'line' | 'dots' | 'none'
  }
}
```

## 主题系统

三层：内置预设、用户自定义、会话内临时调整。前期只做一套面向技术长文的预设，代码块与表格优先。

主题面板切换预设、逐项调 token，色值用取色器，数值用滑杆，改动实时反映到预览。另存为自定义主题落到 userData 目录，支持重命名、删除、导出 JSON。

token 生成作为面板的增强：从 og:image 与 favicon 取主色填入 primary 一族，按内容特征（代码块、表格密度）自动选预设，实现是纯函数 `deriveToken(article): Partial<ThemeToken>`。生成结果作为基于当前预设的微调建议，可见可改、一键还原，不静默覆盖；取色需过对比度校验，不达标降级为默认色。不做从源站学整套排版——公众号正文的最佳实践是收敛的，生成的价值在给一个对的起点。

预览与导出是两条渲染路径，这是最容易出偏差的地方。预览用 CSS 变量加 class，快；导出用 juice 把样式表内联进 style 属性，准。两者必须共用同一份 CSS 生成函数，且该函数对导出必须输出解析后的具体值——juice 不解析 var()。

## 微信约束

`只认内联样式`：style 标签、外部 CSS、class 样式一律被剥离，样式必须落到元素 style 属性。
`图片必须 base64 内联`：外链图片会裂图。导出时转 base64，微信编辑器粘贴时自动转存，单图上限先定 5MB，实测后调整。
`正文不能放外链`：转成脚注、二维码，或挂到阅读原文。
`布局能力受限`：position 与 float 基本失效，伪元素不可用，flex 部分可用，grid 别想，复杂排版靠 table 与 section 拼。
`代码块`：包 pre 加 `overflow-x: auto`，保证横向滚动不折行。

渲染末尾挂白名单过滤器，把不支持的标签与属性提前降级。图片下载后落 userData 按文章归档，导出完成可清理。

## 里程碑

`M0`：输入框，主进程抓取，Readability 提取，DOMPurify 净化，右侧只读预览。拿二十个不同类型链接验证提取正确率。
`M1`：内置主题加导出内联 HTML，产出物直接粘进公众号后台不改格式。建微信兼容性检查清单，逐条验证标题、列表、引用、代码块、表格、图片、分割线，另加深色模式代码块配色、图片宽度降级两项实测，规则一变立刻重跑。
`M2`：主题编辑面板加自定义主题持久化，加 token 自动生成（取主色与自动选预设）。

后置（需要时再排）：自绘标题栏与系统控件、Windows 一致性对照、签名与公证分发。

## 风险

`微信规则会变`：过滤策略无官方文档，靠实测，清单要能快速重跑。
`抓取合规`：尊重 robots.txt，抓取他人原创内容用于发布前需获授权。界面固定显示来源链接与原作者，导出自动附来源行。
`正文不可编辑`：提取质量差时无法在应用内修正，只能换来源。后续若确有需要，再引入 Tiptap 做最小编辑。
`签名`：对外分发才需要，自用可跳过。
