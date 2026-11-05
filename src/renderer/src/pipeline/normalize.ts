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

/** 表格包一层横向滚动容器；仅 3 列及以上在窄屏内滚动，2 列表格按容器换行 */
function wrapTables(doc: Document): void {
  doc.querySelectorAll('table').forEach((table) => {
    if (table.parentElement?.classList.contains('table-scroll')) return
    const columns = Math.max(
      0,
      ...Array.from(table.querySelectorAll('tr')).map((row) =>
        Array.from(row.children).reduce(
          (total, cell) => total + ((cell as HTMLTableCellElement).colSpan || 1),
          0
        )
      )
    )
    const wrapper = doc.createElement('figure')
    wrapper.className = 'table-scroll'
    if (columns >= 3) wrapper.classList.add('table-scroll-wide')
    table.replaceWith(wrapper)
    wrapper.append(table)
  })
}

/** 预览与导出共用的正文 DOM 归一：去重复标题、清引用块末段距、包表格滚动容器 */
export function normalizeArticleDom(doc: Document, title: string): void {
  removeDuplicateTitle(doc, title)
  collapseQuoteTail(doc)
  wrapTables(doc)
}
