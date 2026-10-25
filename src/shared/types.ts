// 跨进程数据契约与 IPC 接口签名。本文件只放纯类型，主进程与渲染进程共享。

export interface ImageAsset {
  id: string
  originalUrl: string
  localPath?: string // 相对文章缓存目录的文件名；下载失败时只有原地址
  status: 'pending' | 'done' | 'failed'
  width?: number
  height?: number
}

export interface Article {
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

export interface FetchError {
  kind: FetchErrorKind
  message: string
  status?: number
}

export type FetchResult =
  { ok: true; html: string; finalUrl: string } | { ok: false; error: FetchError }

export type ImageDownloadStatus = 'done' | 'failed'

export interface ImageDownloadResult {
  id: string
  status: ImageDownloadStatus
  /** 下载成功时的缓存文件名（内容 hash），配合 fucha://img/ 使用 */
  file?: string
}

export interface DownloadImagesPayload {
  articleHash: string
  images: { id: string; originalUrl: string }[]
}

/** preload 经 contextBridge 暴露的单一命名空间 */
export interface FuchaApi {
  fetchArticle: (url: string) => Promise<FetchResult>
  downloadImages: (payload: DownloadImagesPayload) => Promise<ImageDownloadResult[]>
}
