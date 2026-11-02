import type {
  ArticleSnapshotInput,
  JsonValue,
  StoredImageInput,
  ThemeSnapshotInput,
  ThemeUpdateInput,
} from '@shared/store-types'
import type {
  CopyHtmlPayload,
  DownloadImagesPayload,
  ExportHtmlPayload,
  FuchaApi,
} from '@shared/types'
import { contextBridge, ipcRenderer } from 'electron'

const api: FuchaApi = {
  fetchArticle: (url: string) => ipcRenderer.invoke('fetch-article', url),
  downloadImages: (payload: DownloadImagesPayload) =>
    ipcRenderer.invoke('download-images', payload),
  exportHtml: (payload: ExportHtmlPayload) => ipcRenderer.invoke('export-html', payload),
  copyHtml: (payload: CopyHtmlPayload) => ipcRenderer.invoke('copy-html', payload),
  listThemes: () => ipcRenderer.invoke('themes:list'),
  createTheme: (input: ThemeSnapshotInput) => ipcRenderer.invoke('themes:create', input),
  updateTheme: (input: ThemeUpdateInput) => ipcRenderer.invoke('themes:update', input),
  deleteTheme: (id: string) => ipcRenderer.invoke('themes:delete', id),
  exportThemePackage: (input: ThemeSnapshotInput) => ipcRenderer.invoke('themes:export', input),
  importThemePackage: () => ipcRenderer.invoke('themes:import'),
  getPreference: (key: string) => ipcRenderer.invoke('preferences:get', key),
  setPreference: (key: string, value: JsonValue) =>
    ipcRenderer.invoke('preferences:set', key, value),
  listArticles: (limit?: number, offset?: number) =>
    ipcRenderer.invoke('articles:list', limit, offset),
  getArticle: (hash: string) => ipcRenderer.invoke('articles:get', hash),
  saveArticle: (input: ArticleSnapshotInput) => ipcRenderer.invoke('articles:save', input),
  replaceArticleImages: (hash: string, images: StoredImageInput[]) =>
    ipcRenderer.invoke('articles:images', hash, images),
  setArticleTheme: (hash: string, themeId: string) =>
    ipcRenderer.invoke('articles:theme', hash, themeId),
  touchArticle: (hash: string) => ipcRenderer.invoke('articles:touch', hash),
  deleteArticle: (hash: string) => ipcRenderer.invoke('articles:delete', hash),
}

contextBridge.exposeInMainWorld('fucha', api)
