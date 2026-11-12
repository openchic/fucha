import { describe, expect, it } from 'vitest'
import { normalizeRspressCallouts, normalizeRspressCodeBlocks } from '@renderer/pipeline/rspress'

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('normalizeRspressCodeBlocks', () => {
  it('带标题代码块归一为 figure + figcaption 并保留语言类', () => {
    const parsed = doc(
      '<div class="rp-codeblock language-tsx"><div class="rp-codeblock__title">app/page.tsx</div><div class="rp-codeblock__content"><pre class="shiki" data-lang="tsx"><code>const a = 1</code></pre></div></div>'
    )
    const preserved = normalizeRspressCodeBlocks(parsed)

    const figure = parsed.body.querySelector('figure.code-block')
    expect(figure).not.toBeNull()
    expect(figure?.querySelector('figcaption')?.textContent).toBe('app/page.tsx')
    expect(figure?.querySelector('code')?.className).toContain('language-tsx')
    expect(preserved).toContain('language-tsx')
  })

  it('无标题代码块只抽出 pre 并补语言类', () => {
    const parsed = doc(
      '<div class="rp-codeblock language-html"><div class="rp-codeblock__content"><pre data-lang="html"><code>&lt;p&gt;hi&lt;/p&gt;</code></pre></div></div>'
    )
    normalizeRspressCodeBlocks(parsed)

    expect(parsed.body.querySelector('figure.code-block')).toBeNull()
    expect(parsed.body.querySelector('pre code')?.className).toContain('language-html')
    expect(parsed.body.querySelector('.rp-codeblock')).toBeNull()
  })

  it('普通代码块保持不变', () => {
    const parsed = doc('<pre><code>const a = 1</code></pre>')
    const preserved = normalizeRspressCodeBlocks(parsed)
    expect(parsed.body.innerHTML).toBe('<pre><code>const a = 1</code></pre>')
    expect(preserved).toEqual([])
  })
})

describe('normalizeRspressCallouts', () => {
  it('提示容器归一为引用块并把标题加粗', () => {
    const parsed = doc(
      '<div class="rp-callout rp-callout--tip"><div class="rp-callout__title">提醒</div><div class="rp-callout__content"><p>内容</p></div></div>'
    )
    normalizeRspressCallouts(parsed)

    const quote = parsed.body.querySelector('blockquote')
    expect(quote).not.toBeNull()
    expect(quote?.querySelector('strong')?.textContent).toBe('提醒')
    expect(quote?.textContent).toContain('内容')
    expect(parsed.body.querySelector('.rp-callout')).toBeNull()
  })

  it('没有提示容器时不改动正文', () => {
    const parsed = doc('<p>正文</p>')
    normalizeRspressCallouts(parsed)
    expect(parsed.body.innerHTML).toBe('<p>正文</p>')
  })
})
