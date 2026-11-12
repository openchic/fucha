import { describe, expect, it } from 'vitest'
import {
  WECHAT_STYLE_PROPERTIES,
  parseCssRules,
  resolveThemeVariables,
  scopeCss,
  themeRootDeclarations,
  validateThemeCss,
  withoutThemeRootRules,
} from '@shared/theme-css'

function failure(run: () => unknown): string {
  try {
    run()
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('期望抛出错误，但没有')
}

describe('parseCssRules：结构拆分', () => {
  it('空字符串返回空数组', () => {
    expect(parseCssRules('')).toEqual([])
  })

  it('纯空白返回空数组', () => {
    expect(parseCssRules('  \n\t\n')).toEqual([])
  })

  it('纯注释返回空数组', () => {
    expect(parseCssRules('/* 只有注释 */')).toEqual([])
  })

  it('拆出选择器、声明与行号', () => {
    expect(parseCssRules('h1 {\n  color: red;\n}')).toEqual([
      { selector: 'h1', declarations: '\n  color: red;\n', line: 1 },
    ])
  })

  it('多条规则按出现顺序返回并记录行号', () => {
    const rules = parseCssRules('h1 { color: red; }\n\nblockquote {\n  padding: 4px;\n}')
    expect(rules.map((rule) => rule.selector)).toEqual(['h1', 'blockquote'])
    expect(rules.map((rule) => rule.line)).toEqual([1, 3])
  })

  it('注释不改变后续规则的行号', () => {
    const rules = parseCssRules('/* 第一行\n第二行 */\nh1 { color: red; }')
    expect(rules[0]?.line).toBe(3)
  })

  it('保留声明原文，不做语法解析', () => {
    expect(parseCssRules('h1 { color: red; margin: 0 }')[0]?.declarations).toBe(
      ' color: red; margin: 0 '
    )
  })

  it('缺少左花括号时报错', () => {
    expect(failure(() => parseCssRules('h1 color: red;'))).toContain('缺少左花括号')
  })

  it('缺少右花括号时报错', () => {
    expect(failure(() => parseCssRules('h1 { color: red;'))).toContain('缺少右花括号')
  })

  it('选择器为空时报错', () => {
    expect(failure(() => parseCssRules('{ color: red; }'))).toContain('选择器不能为空')
  })

  it('拒绝 @ 规则', () => {
    expect(failure(() => parseCssRules('@media screen { h1 { color: red; } }'))).toContain(
      '不允许 @ 规则'
    )
  })
})

describe('parseCssRules：选择器白名单', () => {
  it.each(['h1', '.article-body', 'h1 .quote', '.foo .bar', 'h1, h2', '&', '.a-b_c'])(
    '接受选择器 %s',
    (selector) => {
      expect(() => parseCssRules(`${selector} { color: red; }`, true)).not.toThrow()
    }
  )

  it.each([
    ['& h1', '&` 只能单独使用'],
    ['h1 > p', '只允许元素、类与后代选择器'],
    ['h1 + p', '只允许元素、类与后代选择器'],
    ['h1 ~ p', '只允许元素、类与后代选择器'],
    ['#title', '不合法'],
    ['[data-x]', '不合法'],
    ['.foo:hover', '不合法'],
    ['h1.bar', '不合法'],
    ['*', '不合法'],
  ])('拒绝选择器 %s', (selector, reason) => {
    expect(failure(() => parseCssRules(`${selector} { color: red; }`, true))).toContain(reason)
  })

  it('拒绝嵌套规则', () => {
    expect(failure(() => parseCssRules('h1 { p { color: red; } }', true))).toContain(
      '不允许嵌套规则'
    )
  })

  it('非校验模式下允许同一段 CSS 中的多个 & 规则', () => {
    const rules = parseCssRules('& { font-family: serif; }\n& { line-height: 1.8; }')
    expect(rules.map((rule) => rule.selector)).toEqual(['&', '&'])
  })
})

describe('validateThemeCss：合法 CSS', () => {
  it('接受空字符串并原样返回', () => {
    expect(validateThemeCss('')).toBe('')
  })

  it('校验通过时原样返回输入', () => {
    const css = 'h1 {\n  color: #333333;\n  font-size: 20px;\n}'
    expect(validateThemeCss(css)).toBe(css)
  })

  it('接受单独的 & 根规则', () => {
    expect(() => validateThemeCss('& { font-family: serif; }')).not.toThrow()
  })

  it('接受全部白名单属性', () => {
    for (const property of WECHAT_STYLE_PROPERTIES) {
      const value = property === 'display' ? 'block' : '1px'
      expect(() => validateThemeCss(`h1 { ${property}: ${value}; }`)).not.toThrow()
    }
  })

  it('引号内的分号不会被当成声明分隔符', () => {
    expect(() => validateThemeCss('blockquote { font-family: "a;b"; }')).not.toThrow()
  })

  it('声明末尾分号可省略', () => {
    expect(() => validateThemeCss('h1 { color: red }')).not.toThrow()
  })
})

describe('validateThemeCss：拒绝不安全或不受支持的写法', () => {
  it('拒绝 < 与 >', () => {
    expect(failure(() => validateThemeCss('h1 { color: red; } <'))).toContain('不能包含 < 或 >')
    expect(failure(() => validateThemeCss('h1 > p { color: red; }'))).toContain('不能包含 < 或 >')
  })

  it.each(['position', 'float', 'top', 'z-index', 'box-shadow'])(
    '拒绝非白名单属性 %s',
    (property) => {
      expect(failure(() => validateThemeCss(`h1 { ${property}: 1px; }`))).toContain(
        '使用了微信不支持的属性'
      )
    }
  )

  it.each(['!important', '!IMPORTANT', 'red !important'])('拒绝 %s', (value) => {
    expect(failure(() => validateThemeCss(`h1 { color: ${value}; }`))).toContain(
      '不允许 !important'
    )
  })

  it('拒绝外部资源 url()', () => {
    expect(
      failure(() => validateThemeCss('h1 { background-color: url(https://x.test/a.png); }'))
    ).toContain('不允许外部资源 url()')
  })

  it('拒绝 expression()', () => {
    expect(failure(() => validateThemeCss('h1 { width: expression(alert(1)); }'))).toContain(
      '含不安全的值'
    )
  })

  it('拒绝 javascript: 协议', () => {
    expect(
      failure(() => validateThemeCss('h1 { background-color: javascript:alert(1); }'))
    ).toContain('含不安全的值')
  })

  it.each([
    'block',
    'inline',
    'inline-block',
    'list-item',
    'none',
    'table',
    'table-cell',
    'table-row',
  ])('接受安全 display 值 %s', (value) => {
    expect(() => validateThemeCss(`h1 { display: ${value}; }`)).not.toThrow()
  })

  it('display 值大小写不敏感', () => {
    expect(() => validateThemeCss('h1 { display: BLOCK; }')).not.toThrow()
  })

  it.each(['flex', 'inline-flex', 'grid', 'contents', 'inherit'])('拒绝 display 值 %s', (value) => {
    expect(failure(() => validateThemeCss(`h1 { display: ${value}; }`))).toContain(
      '的 display 只允许'
    )
  })
})

describe('validateThemeCss：token 变量契约', () => {
  it('接受契约内的变量', () => {
    expect(() => validateThemeCss('h1 { color: var(--theme-primary); }')).not.toThrow()
    expect(() => validateThemeCss('h1 { color: var( --theme-text-color ); }')).not.toThrow()
  })

  it('拒绝契约外的 theme 变量', () => {
    expect(failure(() => validateThemeCss('h1 { color: var(--theme-nope); }'))).toContain(
      '引用了不存在的变量 --theme-nope'
    )
  })

  it('拒绝非 theme 前缀的变量', () => {
    expect(failure(() => validateThemeCss('h1 { color: var(--other); }'))).toContain(
      '只能引用 token 契约内的变量'
    )
  })

  it('拒绝带 fallback 的变量写法', () => {
    expect(failure(() => validateThemeCss('h1 { color: var(--theme-primary, red); }'))).toContain(
      '只能引用 token 契约内的变量'
    )
  })

  it('同一值里可以引用多个变量', () => {
    expect(() =>
      validateThemeCss('h1 { margin: var(--theme-h1-margin-top) var(--theme-h1-margin-bottom); }')
    ).not.toThrow()
  })
})

describe('validateThemeCss：畸形声明', () => {
  it('拒绝缺少冒号的声明', () => {
    expect(failure(() => validateThemeCss('h1 { color red; }'))).toContain('的声明缺少冒号')
  })

  it('拒绝缺少属性名的声明', () => {
    expect(failure(() => validateThemeCss('h1 { : red; }'))).toContain('的声明缺少属性名')
  })

  it('拒绝缺少值的声明', () => {
    expect(failure(() => validateThemeCss('h1 { color: ; }'))).toContain('缺少值')
  })

  it('拒绝未闭合的字符串引号', () => {
    expect(failure(() => validateThemeCss('h1 { font-family: "Songti; }'))).toContain(
      '字符串引号未闭合'
    )
  })

  it('拒绝未闭合的括号', () => {
    expect(failure(() => validateThemeCss('h1 { color: var(--theme-primary; }'))).toContain(
      '括号未闭合'
    )
  })

  it('错误信息带行号', () => {
    expect(failure(() => validateThemeCss('h1 { color: red; }\n\nh2 { position: fixed; }'))).toBe(
      'theme.css 第 3 行：h2 使用了微信不支持的属性 position'
    )
  })
})

describe('themeRootDeclarations', () => {
  it('没有 & 规则时返回空字符串', () => {
    expect(themeRootDeclarations('h1 { color: red; }')).toBe('')
  })

  it('取出一条 & 规则的声明并补分号', () => {
    expect(themeRootDeclarations('& { font-family: serif }')).toBe('font-family: serif;')
  })

  it('多条 & 规则按顺序拼接', () => {
    expect(themeRootDeclarations('& { font-family: serif; }\n& { line-height: 1.8; }')).toBe(
      'font-family: serif;\nline-height: 1.8;'
    )
  })

  it('忽略空声明', () => {
    expect(themeRootDeclarations('& { }\n& { color: red; }')).toBe('color: red;')
  })

  it('忽略普通规则', () => {
    expect(themeRootDeclarations('h1 { color: red; }\n& { color: blue; }')).toBe('color: blue;')
  })
})

describe('withoutThemeRootRules', () => {
  it('去掉 & 规则并保留其余规则', () => {
    expect(withoutThemeRootRules('& { font-family: serif; }\n\nh1 { color: red; }')).toBe(
      'h1 { color: red; }'
    )
  })

  it('只有 & 规则时返回空字符串', () => {
    expect(withoutThemeRootRules('& { color: red; }')).toBe('')
  })

  it('空输入返回空字符串', () => {
    expect(withoutThemeRootRules('')).toBe('')
  })
})

describe('scopeCss', () => {
  it('给单条规则加上作用域', () => {
    expect(scopeCss('h1 { color: red; }', '.article-body')).toBe('.article-body h1 { color: red; }')
  })

  it('逗号分组逐项加作用域', () => {
    expect(scopeCss('h1, h2 { color: red; }', '.article-body')).toBe(
      '.article-body h1, .article-body h2 { color: red; }'
    )
  })

  it('丢弃 & 规则', () => {
    expect(scopeCss('& { color: red; }\nh1 { color: blue; }', '.article-body')).toBe(
      '.article-body h1 { color: blue; }'
    )
  })

  it('空输入返回空字符串', () => {
    expect(scopeCss('', '.article-body')).toBe('')
  })
})

describe('resolveThemeVariables', () => {
  const values = { primary: '#a8b9f0', 'text-color': '#333333' }

  it('替换已知变量', () => {
    expect(resolveThemeVariables('h1 { color: var(--theme-primary); }', values)).toBe(
      'h1 { color: #a8b9f0; }'
    )
  })

  it('替换同一值里的多个变量', () => {
    expect(
      resolveThemeVariables(
        'h1 { color: var(--theme-primary); background-color: var(--theme-text-color); }',
        values
      )
    ).toBe('h1 { color: #a8b9f0; background-color: #333333; }')
  })

  it('容忍变量名周围的空白', () => {
    expect(resolveThemeVariables('h1 { color: var( --theme-primary ); }', values)).toBe(
      'h1 { color: #a8b9f0; }'
    )
  })

  it('未定义的变量直接报错', () => {
    expect(failure(() => resolveThemeVariables('h1 { color: var(--theme-nope); }', values))).toBe(
      '未定义的 token 变量 --theme-nope'
    )
  })

  it('非 theme 前缀的变量保持原样', () => {
    expect(resolveThemeVariables('h1 { color: var(--other); }', values)).toBe(
      'h1 { color: var(--other); }'
    )
  })

  it('替换值里再次出现的变量不会被递归解析', () => {
    expect(
      resolveThemeVariables('h1 { color: var(--theme-primary); }', {
        primary: 'var(--theme-text-color)',
      })
    ).toBe('h1 { color: var(--theme-text-color); }')
  })

  it('替换值里的 $ 符号不会被当作替换模式', () => {
    expect(resolveThemeVariables('h1 { color: var(--theme-primary); }', { primary: '$&$1' })).toBe(
      'h1 { color: $&$1; }'
    )
  })

  it('没有变量时原样返回', () => {
    expect(resolveThemeVariables('h1 { color: red; }', values)).toBe('h1 { color: red; }')
  })
})
