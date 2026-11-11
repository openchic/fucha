import type { Article, ThemeDefinition } from '@shared/types'
import { useCallback, useEffect, useState } from 'react'
import { buildExportHtml, exportHtmlToText } from '../pipeline/export'

export type ExportAction = 'copy'

export type ExportState = {
  action: ExportAction | null
  notice?: string
  error?: string
}

/** 导出并写入剪贴板；导出期间禁用入口，失败只回显状态不打断预览 */
export function useArticleExport(
  article: Article | null,
  articleHash: string,
  theme: ThemeDefinition
) {
  const [state, setState] = useState<ExportState>({ action: null })

  useEffect(() => {
    setState((current) => (current.notice || current.error ? { action: current.action } : current))
  }, [article?.sourceUrl, articleHash])

  const run = useCallback(async () => {
    if (!article || !articleHash) return
    setState({ action: 'copy' })
    try {
      const rendered = buildExportHtml(article, theme)
      const html = await window.api.exportHtml({ articleHash, html: rendered })
      await window.api.copyHtml({ html, text: exportHtmlToText(html) })
      setState({ action: null, notice: '已复制到剪贴板' })
    } catch {
      setState({ action: null, error: '导出失败，请重试' })
    }
  }, [article, articleHash, theme])

  return {
    state,
    copy: useCallback(() => void run(), [run]),
  }
}
