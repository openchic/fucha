/** 把 Rspress 代码块归一为通用结构：figure.code-block > figcaption + pre */
export function normalizeRspressCodeBlocks(doc: Document): string[] {
  const preservedClasses = new Set<string>()

  doc.querySelectorAll('.rp-codeblock').forEach((block) => {
    const pre = block.querySelector('pre')
    if (!pre) return

    const title =
      block.querySelector('.rp-codeblock__title')?.textContent?.trim() ||
      pre.getAttribute('data-title')?.trim() ||
      ''
    const language =
      pre.getAttribute('data-lang')?.trim() ||
      /(?:^|\s)language-([\w-]+)/i.exec(block.getAttribute('class') ?? '')?.[1] ||
      ''

    if (language) {
      const code = pre.querySelector('code')
      if (code) {
        code.classList.add(`language-${language}`)
        preservedClasses.add(`language-${language}`)
      }
    }

    if (!title) {
      block.replaceWith(pre)
      return
    }

    const figure = doc.createElement('figure')
    figure.className = 'code-block'
    const caption = doc.createElement('figcaption')
    caption.textContent = title
    figure.append(caption, pre)
    block.replaceWith(figure)
    preservedClasses.add('code-block')
  })

  return [...preservedClasses]
}
