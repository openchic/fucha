// 跨进程数据契约与 IPC 接口签名。本文件只放纯类型，主进程与渲染进程共享。

import type {
  ArticleSnapshotInput,
  ArticleSummary,
  JsonValue,
  StoredArticle,
  StoredImageInput,
  ThemeRecord,
  ThemeSnapshotInput,
  ThemeUpdateInput,
} from './store-types'

export type ImageAsset = {
  id: string
  originalUrl: string
  localPath?: string // 相对文章缓存目录的文件名；下载失败时只有原地址
  status: 'pending' | 'done' | 'failed'
  width?: number
  height?: number
}

export type Article = {
  title: string
  author?: string
  publishedAt?: string
  sourceUrl: string
  cover?: string
  /** 已净化的正文 HTML，img src 仍指向原始地址 */
  html: string
  images: ImageAsset[]
}

/** 抓取失败的四类原因 */
export type FetchErrorKind = 'network' | 'timeout' | 'rejected' | 'captcha'

export type FetchError = {
  kind: FetchErrorKind
  message: string
  status?: number
}

export type FetchResult =
  { ok: true; html: string; finalUrl: string } | { ok: false; error: FetchError }

export type ImageDownloadStatus = 'done' | 'failed'

export type ImageDownloadResult = {
  id: string
  status: ImageDownloadStatus
  /** 下载成功时的缓存文件名（内容 hash），配合 fucha://img/ 使用 */
  file?: string
}

export type DownloadImagesPayload = {
  articleHash: string
  images: { id: string; originalUrl: string }[]
}

export type HeadingDecoration = 'none' | 'bar' | 'underline' | 'bracket'

/** 单级标题的排版 */
export type HeadingToken = {
  fontSize: number // px
  fontWeight: number
  lineHeight: number // 倍数
  textAlign: 'left' | 'center'
  decoration: HeadingDecoration
  marginTop: number // px
  marginBottom: number // px
}

/** 主题 token：纯数据，预览、导出与持久化共用同一形状；数值单位见字段注释 */
export type ThemeToken = {
  id: string
  name: string
  builtin: boolean
  text: {
    fontSize: number // px
    secondaryFontSize: number // px，图注、上下标；表格与行内代码按正文 0.875 倍
    lineHeight: number // 倍数
    letterSpacing: number // em
    marginBottom: number // px，块级元素段后距
    color: string
    secondaryColor: string // 次级文字色（图注等）
  }
  primary: string // 标题装饰与引用边条
  borderColor: string // 表格边框
  headingColor: string // 标题文字色
  page: {
    backgroundColor?: string // 缺省透明，不写入导出
    paddingTop: number // px
    paddingRight: number // px
    paddingBottom: number // px
    paddingLeft: number // px
  }
  h1: HeadingToken
  h2: HeadingToken
  h3: HeadingToken
  h4: HeadingToken
  h5: HeadingToken
  h6: HeadingToken
  quote: {
    backgroundColor: string // 引用块背景色
    fontSize: number // px
    decoration: 'none' | 'bar'
    paddingBlock: number // px
    paddingInline: number // px
    borderRadius: number // px
  }
  code: {
    hljsTheme: string
    backgroundColor?: string // 代码块背景色；缺省跟随语法主题
    fontSize: number // px，代码块文字字号
    inlineBackgroundColor: string // 行内代码背景色
    lineHeight: number // 倍数
    paddingBlock: number // px，代码块上下内边距
    paddingInline: number // px，代码块左右内边距
    borderRadius: number // px，代码块圆角
    inlineBorderRadius: number // px，行内代码圆角
    borderStyle: 'solid' | 'dashed' | 'none' // 代码块外边框样式
    captionDivider: {
      borderBottomStyle: 'solid' | 'dashed' | 'none'
      borderBottomColor?: string // 缺省跟随主题边框色
    }
  }
  table: {
    headerBackgroundColor: string // 表头背景色
    paddingBlock: number // px，th / td 上下内边距
    paddingInline: number // px，th / td 左右内边距
  }
  image: {
    marginTop: number // px
    marginBottom: number // px
    borderRadius: number // px
  }
  divider: {
    borderTopStyle: 'solid' | 'dashed' | 'none'
    borderTopColor: string // 分割线颜色
    marginTop: number // px
    marginBottom: number // px
  }
}

/** 一套可渲染主题：token 决定可调项，css 只写 base 之外的差异 */
export type ThemeDefinition = {
  token: ThemeToken
  css: string
}

export type ExportHtmlPayload = {
  articleHash: string
  html: string
}

export type CopyHtmlPayload = {
  html: string
  text: string
}

export type ThemeExportResult =
  { ok: true; path: string } | { ok: false; canceled?: boolean; error?: string }

export type ThemeImportResult =
  { ok: true; theme: ThemeRecord } | { ok: false; canceled?: boolean; error?: string }

/** preload 经 contextBridge 暴露的单一命名空间 */
export type FuchaApi = {
  fetchArticle: (url: string) => Promise<FetchResult>
  downloadImages: (payload: DownloadImagesPayload) => Promise<ImageDownloadResult[]>
  exportHtml: (payload: ExportHtmlPayload) => Promise<string>
  copyHtml: (payload: CopyHtmlPayload) => Promise<void>
  listThemes: () => Promise<ThemeRecord[]>
  createTheme: (input: ThemeSnapshotInput) => Promise<ThemeRecord>
  updateTheme: (input: ThemeUpdateInput) => Promise<ThemeRecord>
  deleteTheme: (id: string) => Promise<void>
  exportThemePackage: (input: ThemeSnapshotInput) => Promise<ThemeExportResult>
  importThemePackage: () => Promise<ThemeImportResult>
  getPreference: (key: string) => Promise<JsonValue | null>
  setPreference: (key: string, value: JsonValue) => Promise<void>
  listArticles: (limit?: number, offset?: number) => Promise<ArticleSummary[]>
  getArticle: (hash: string) => Promise<StoredArticle | null>
  saveArticle: (input: ArticleSnapshotInput) => Promise<StoredArticle>
  replaceArticleImages: (hash: string, images: StoredImageInput[]) => Promise<void>
  setArticleTheme: (hash: string, themeId: string) => Promise<boolean>
  touchArticle: (hash: string) => Promise<boolean>
  deleteArticle: (hash: string) => Promise<boolean>
}
