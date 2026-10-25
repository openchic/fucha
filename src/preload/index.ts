import type { DownloadImagesPayload, FuchaApi } from '@shared/types'
import { contextBridge, ipcRenderer } from 'electron'

const api: FuchaApi = {
  fetchArticle: (url: string) => ipcRenderer.invoke('fetch-article', url),
  downloadImages: (payload: DownloadImagesPayload) =>
    ipcRenderer.invoke('download-images', payload),
}

contextBridge.exposeInMainWorld('fucha', api)
