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

/** 单级标题的排版；color 缺省回退 text.color */
export type HeadingToken = {
  fontSize: number // px
  color?: string
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
    secondaryFontSize: number // px，代码、表格、图注、上下标
    lineHeight: number // 倍数
    letterSpacing: number // em
    marginBottom: number // px，块级元素段后距
    color: string
    secondaryColor: string // 弱化文字色（图注等）
  }
  primary: string // 标题装饰与引用边条
  backgroundColor: string // 引用、代码、表头底色
  borderColor: string // 表格边框与分割线
  borderRadius: number // px，引用、代码、图片共用
  h1: HeadingToken
  h2: HeadingToken
  h3: HeadingToken
  h4: HeadingToken
  h5: HeadingToken
  h6: HeadingToken
  quote: {
    padding: number // px
  }
  code: {
    hljsTheme: string
    lineHeight: number // 倍数
    padding: number // px
  }
  table: {
    padding: number // px，th / td 内边距
  }
  image: {
    marginTop: number // px
    marginBottom: number // px
  }
  divider: {
    borderTopStyle: 'solid' | 'dotted' | 'none'
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
