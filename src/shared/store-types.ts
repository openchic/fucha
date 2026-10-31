import type { Article, ImageAsset, ThemeToken } from './types'

/** 可序列化为 JSON 的偏好值 */
export type JsonValue =
  null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue }

export type StoredImage = Pick<ImageAsset, 'id' | 'originalUrl' | 'status' | 'width' | 'height'> & {
  sort: number
}

export type StoredArticle = Pick<
  Article,
  'sourceUrl' | 'title' | 'author' | 'publishedAt' | 'cover' | 'html'
> & {
  hash: string
  finalUrl: string
  themeId: string
  createdAt: string
  updatedAt: string
  lastVisitedAt?: string
  visitCount: number
  images: StoredImage[]
}

export type ArticleSummary = Pick<
  StoredArticle,
  | 'hash'
  | 'sourceUrl'
  | 'finalUrl'
  | 'title'
  | 'themeId'
  | 'createdAt'
  | 'updatedAt'
  | 'lastVisitedAt'
  | 'visitCount'
>

export type StoredImageInput = Pick<
  StoredImage,
  'id' | 'originalUrl' | 'status' | 'width' | 'height'
>

export type ArticleSnapshotInput = {
  hash: string
  finalUrl: string
  article: Article
  images: StoredImageInput[]
  /** 首次写入时的主题；重新提取不覆盖文章已有主题 */
  themeId?: string
}

export type ThemeRecord = {
  id: string
  name: string
  token: ThemeToken
  css: string
  tokenVersion: number
  sourceThemeId?: string
  sort: number
  createdAt: string
  updatedAt: string
}

/** 写入主题快照的入参；token 与 css 写入后不再修改 */
export type ThemeSnapshotInput = {
  token: ThemeToken
  css: string
  tokenVersion?: number
  sourceThemeId?: string
}
