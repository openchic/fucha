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

/** 把 Rspress 提示容器归一为引用块：标题作粗体首段，其余内容原样搬入 */
export function normalizeRspressCallouts(doc: Document): void {
  doc.querySelectorAll('.rp-callout').forEach((callout) => {
    const titleNode = callout.querySelector('.rp-callout__title')
    const content = callout.querySelector('.rp-callout__content')
    const title = titleNode?.textContent?.trim() ?? ''

    const quote = doc.createElement('blockquote')
    if (title) {
      const heading = doc.createElement('p')
      const strong = doc.createElement('strong')
      strong.textContent = title
      heading.append(strong)
      quote.append(heading)
    }
    if (content) {
      while (content.firstChild) quote.append(content.firstChild)
    } else {
      Array.from(callout.children).forEach((child) => {
        if (child !== titleNode) quote.append(child)
      })
    }
    callout.replaceWith(quote)
  })
}
