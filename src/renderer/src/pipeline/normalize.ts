const normalizeText = (value: string): string => value.replace(/\s+/g, ' ').trim()

function removeDuplicateTitle(doc: Document, title: string): void {
  const first = doc.body.firstElementChild
  if (
    (first?.tagName === 'H1' || first?.tagName === 'H2') &&
    normalizeText(first.textContent ?? '') === normalizeText(title)
  ) {
    first.remove()
  }
}

function collapseQuoteTail(doc: Document): void {
  doc.querySelectorAll('blockquote').forEach((quote) => {
    const last = quote.lastElementChild as HTMLElement | null
    if (last) last.style.marginBottom = '0'
  })
}

/** 预览与导出共用的正文 DOM 归一：去重复标题、清引用块末段距 */
export function normalizeArticleDom(doc: Document, title: string): void {
  removeDuplicateTitle(doc, title)
  collapseQuoteTail(doc)
}
