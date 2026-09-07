import { describe, expect, it } from 'vitest'
import { normalizeArticleDom } from '@renderer/pipeline/normalize'

function doc(html: string): Document {
  return new DOMParser().parseFromString(`<html><body>${html}</body></html>`, 'text/html')
}

describe('normalizeArticleDom：首标题去重', () => {
  it('去掉与文章标题一致的第一个标题', () => {
    const parsed = doc('<h1>示例文章</h1><p>正文</p>')
    normalizeArticleDom(parsed, '示例文章')
    expect(parsed.body.querySelector('h1')).toBeNull()
  })

  it('空白差异不影响判定', () => {
    const parsed = doc('<h2>  示例\n 文章 </h2><p>正文</p>')
    normalizeArticleDom(parsed, '示例 文章')
    expect(parsed.body.querySelector('h2')).toBeNull()
  })

  it('标题不一致时保留', () => {
    const parsed = doc('<h1>其他标题</h1><p>正文</p>')
    normalizeArticleDom(parsed, '示例文章')
    expect(parsed.body.querySelector('h1')?.textContent).toBe('其他标题')
  })

  it('只处理第一个元素，不误删后文同名标题', () => {
    const parsed = doc('<p>开头</p><h1>示例文章</h1>')
    normalizeArticleDom(parsed, '示例文章')
    expect(parsed.body.querySelector('h1')?.textContent).toBe('示例文章')
  })
})

describe('normalizeArticleDom：引用与表格', () => {
  it('最后一个引用段清零段后距', () => {
    const parsed = doc('<blockquote><p>一</p><p>二</p></blockquote>')
    normalizeArticleDom(parsed, '标题')
    const last = parsed.body.querySelector('blockquote')?.lastElementChild as HTMLElement
    expect(last.style.marginBottom).toBe('0px')
  })

  it('两列表格包容器但不标记宽表', () => {
    const parsed = doc('<table><tr><th>甲</th><th>乙</th></tr></table>')
    normalizeArticleDom(parsed, '标题')
    const wrapper = parsed.body.querySelector('figure.table-scroll')
    expect(wrapper).not.toBeNull()
    expect(wrapper?.classList.contains('table-scroll-wide')).toBe(false)
    expect(wrapper?.querySelector('table')).not.toBeNull()
  })

  it('三列及以上标记宽表，colspan 计入列数', () => {
    const parsed = doc(
      '<table><tr><th colspan="2">合并</th><th>丙</th></tr></table><table><tr><th>一</th><th>二</th><th>三</th></tr></table>'
    )
    normalizeArticleDom(parsed, '标题')
    const wrappers = parsed.body.querySelectorAll('figure.table-scroll-wide')
    expect(wrappers).toHaveLength(2)
  })

  it('已包过的表格不重复包裹', () => {
    const parsed = doc(
      '<figure class="table-scroll table-scroll-wide"><table><tr><th>一</th><th>二</th><th>三</th></tr></table></figure>'
    )
    normalizeArticleDom(parsed, '标题')
    expect(parsed.body.querySelectorAll('figure.table-scroll')).toHaveLength(1)
  })
})
