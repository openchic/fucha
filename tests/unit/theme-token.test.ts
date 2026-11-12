import type { ThemeToken } from '@shared/types'
import { describe, expect, it } from 'vitest'
import {
  CODE_BORDER_STYLE_VALUES,
  HEADING_KEYS,
  HLJS_THEME_VALUES,
  THEME_RANGES,
  THEME_TOKEN_VERSION,
  validateThemeToken,
  type NumericRange,
} from '@shared/theme'
import { DEFAULT_THEME } from '@renderer/theme/presets'

function validToken(): ThemeToken {
  return structuredClone(DEFAULT_THEME.token)
}

function failure(input: unknown): string {
  try {
    validateThemeToken(input)
  } catch (error) {
    return (error as Error).message
  }
  throw new Error('期望校验失败，但通过了')
}

function withToken(mutate: (token: ThemeToken) => void): ThemeToken {
  const token = validToken()
  mutate(token)
  return token
}

type NumericAccessor = {
  range: NumericRange
  read: (token: ThemeToken) => number
  write: (token: ThemeToken, value: number) => void
}

const NUMERIC_FIELDS: Record<string, NumericAccessor> = {
  fontSize: {
    range: THEME_RANGES.fontSize,
    read: (token) => token.text.fontSize,
    write: (token, value) => (token.text.fontSize = value),
  },
  secondaryFontSize: {
    range: THEME_RANGES.secondaryFontSize,
    read: (token) => token.text.secondaryFontSize,
    write: (token, value) => (token.text.secondaryFontSize = value),
  },
  lineHeight: {
    range: THEME_RANGES.lineHeight,
    read: (token) => token.text.lineHeight,
    write: (token, value) => (token.text.lineHeight = value),
  },
  headingFontWeight: {
    range: THEME_RANGES.headingFontWeight,
    read: (token) => token.h1.fontWeight,
    write: (token, value) => HEADING_KEYS.forEach((key) => (token[key].fontWeight = value)),
  },
  letterSpacing: {
    range: THEME_RANGES.letterSpacing,
    read: (token) => token.text.letterSpacing,
    write: (token, value) => (token.text.letterSpacing = value),
  },
  marginBottom: {
    range: THEME_RANGES.marginBottom,
    read: (token) => token.text.marginBottom,
    write: (token, value) => (token.text.marginBottom = value),
  },
  h1FontSize: {
    range: THEME_RANGES.h1FontSize,
    read: (token) => token.h1.fontSize,
    write: (token, value) => (token.h1.fontSize = value),
  },
  h2FontSize: {
    range: THEME_RANGES.h2FontSize,
    read: (token) => token.h2.fontSize,
    write: (token, value) => (token.h2.fontSize = value),
  },
  h3FontSize: {
    range: THEME_RANGES.h3FontSize,
    read: (token) => token.h3.fontSize,
    write: (token, value) => (token.h3.fontSize = value),
  },
  h4FontSize: {
    range: THEME_RANGES.h4FontSize,
    read: (token) => token.h4.fontSize,
    write: (token, value) => (token.h4.fontSize = value),
  },
  h5FontSize: {
    range: THEME_RANGES.h5FontSize,
    read: (token) => token.h5.fontSize,
    write: (token, value) => (token.h5.fontSize = value),
  },
  h6FontSize: {
    range: THEME_RANGES.h6FontSize,
    read: (token) => token.h6.fontSize,
    write: (token, value) => (token.h6.fontSize = value),
  },
  headingMarginTop: {
    range: THEME_RANGES.headingMarginTop,
    read: (token) => token.h1.marginTop,
    write: (token, value) => HEADING_KEYS.forEach((key) => (token[key].marginTop = value)),
  },
  headingMarginBottom: {
    range: THEME_RANGES.headingMarginBottom,
    read: (token) => token.h1.marginBottom,
    write: (token, value) => HEADING_KEYS.forEach((key) => (token[key].marginBottom = value)),
  },
  dividerMarginTop: {
    range: THEME_RANGES.dividerMarginTop,
    read: (token) => token.divider.marginTop,
    write: (token, value) => (token.divider.marginTop = value),
  },
  dividerMarginBottom: {
    range: THEME_RANGES.dividerMarginBottom,
    read: (token) => token.divider.marginBottom,
    write: (token, value) => (token.divider.marginBottom = value),
  },
  quotePadding: {
    range: THEME_RANGES.quotePadding,
    read: (token) => token.quote.paddingBlock,
    write: (token, value) => (token.quote.paddingBlock = value),
  },
  quoteFontSize: {
    range: THEME_RANGES.quoteFontSize,
    read: (token) => token.quote.fontSize,
    write: (token, value) => (token.quote.fontSize = value),
  },
  codeLineHeight: {
    range: THEME_RANGES.codeLineHeight,
    read: (token) => token.code.lineHeight,
    write: (token, value) => (token.code.lineHeight = value),
  },
  codeFontSize: {
    range: THEME_RANGES.codeFontSize,
    read: (token) => token.code.fontSize,
    write: (token, value) => (token.code.fontSize = value),
  },
  codePadding: {
    range: THEME_RANGES.codePadding,
    read: (token) => token.code.paddingBlock,
    write: (token, value) => (token.code.paddingBlock = value),
  },
  tablePadding: {
    range: THEME_RANGES.tablePadding,
    read: (token) => token.table.paddingBlock,
    write: (token, value) => (token.table.paddingBlock = value),
  },
  imageMarginTop: {
    range: THEME_RANGES.imageMarginTop,
    read: (token) => token.image.marginTop,
    write: (token, value) => (token.image.marginTop = value),
  },
  imageMarginBottom: {
    range: THEME_RANGES.imageMarginBottom,
    read: (token) => token.image.marginBottom,
    write: (token, value) => (token.image.marginBottom = value),
  },
  pagePadding: {
    range: THEME_RANGES.pagePadding,
    read: (token) => token.page.paddingLeft,
    write: (token, value) => (token.page.paddingLeft = value),
  },
  borderRadius: {
    range: THEME_RANGES.borderRadius,
    read: (token) => token.quote.borderRadius,
    write: (token, value) => (token.quote.borderRadius = value),
  },
}

describe('validateThemeToken：合法输入', () => {
  it('默认主题 token 通过校验', () => {
    expect(() => validateThemeToken(validToken())).not.toThrow()
  })

  it('theme token 版本保持为 1', () => {
    expect(THEME_TOKEN_VERSION).toBe(1)
  })

  it('返回值的 id 与 name 去掉首尾空白', () => {
    const token = withToken((input) => {
      input.id = '  custom  '
      input.name = '  自定义  '
    })
    const result = validateThemeToken(token)
    expect(result.id).toBe('custom')
    expect(result.name).toBe('自定义')
  })

  it('未知字段不会出现在返回值里', () => {
    const token = { ...validToken(), extra: 'dropped' }
    expect(validateThemeToken(token)).not.toHaveProperty('extra')
  })

  it('与输入深相等（不含未知字段时）', () => {
    expect(validateThemeToken(validToken())).toEqual(validToken())
  })
})

describe('validateThemeToken：根结构', () => {
  it.each([null, undefined, 'theme', 42, [], [1]])('拒绝非对象输入 %#', (input) => {
    expect(failure(input)).toContain('theme 必须是对象')
  })

  it.each(['text', 'quote', 'code', 'table', 'image', 'divider', 'page'])(
    '缺少 %s 分组时报错',
    (group) => {
      const token = validToken() as unknown as Record<string, unknown>
      delete token[group]
      expect(failure(token)).toContain(`theme.${group} 必须是对象`)
    }
  )

  it('id 为空字符串时报错', () => {
    expect(failure(withToken((token) => (token.id = '   ')))).toBe('theme.id 必须是非空字符串')
  })

  it('name 不是字符串时报错', () => {
    expect(failure(withToken((token) => (token.name = 1 as never)))).toBe(
      'theme.name 必须是非空字符串'
    )
  })

  it('builtin 不是布尔值时报错', () => {
    expect(failure(withToken((token) => (token.builtin = 'yes' as never)))).toBe(
      'theme.builtin 必须是布尔值'
    )
  })
})

describe('validateThemeToken：数值区间边界', () => {
  for (const [name, field] of Object.entries(NUMERIC_FIELDS)) {
    it(`${name} 接受最小值与最大值`, () => {
      const min = validateThemeToken(withToken((token) => field.write(token, field.range.min)))
      const max = validateThemeToken(withToken((token) => field.write(token, field.range.max)))
      expect(field.read(min)).toBe(field.range.min)
      expect(field.read(max)).toBe(field.range.max)
    })

    it(`${name} 拒绝低于最小值`, () => {
      expect(failure(withToken((token) => field.write(token, field.range.min - 1)))).toContain(
        `必须在 ${field.range.min} 到 ${field.range.max} 之间`
      )
    })

    it(`${name} 拒绝高于最大值`, () => {
      expect(failure(withToken((token) => field.write(token, field.range.max + 1)))).toContain(
        `必须在 ${field.range.min} 到 ${field.range.max} 之间`
      )
    })

    if (field.range.integer) {
      it(`${name} 拒绝非整数`, () => {
        expect(failure(withToken((token) => field.write(token, field.range.min + 0.5)))).toContain(
          '必须是整数'
        )
      })
    } else {
      it(`${name} 接受区间内小数`, () => {
        expect(() =>
          validateThemeToken(withToken((token) => field.write(token, field.range.min + 0.01)))
        ).not.toThrow()
      })
    }
  }

  it('拒绝非数字', () => {
    expect(failure(withToken((token) => (token.text.fontSize = '14' as never)))).toBe(
      'theme.text.fontSize 必须是数字'
    )
  })

  it('拒绝 NaN 与 Infinity', () => {
    expect(failure(withToken((token) => (token.text.fontSize = Number.NaN)))).toBe(
      'theme.text.fontSize 必须是数字'
    )
    expect(failure(withToken((token) => (token.text.fontSize = Number.POSITIVE_INFINITY)))).toBe(
      'theme.text.fontSize 必须是数字'
    )
  })

  it('step 只是界面滑杆步长，不参与校验', () => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.text.lineHeight = 1.03)))
    ).not.toThrow()
  })

  it('每个区间自身 min < max 且 step > 0', () => {
    for (const [name, range] of Object.entries(THEME_RANGES)) {
      expect(range.min, name).toBeLessThan(range.max)
      expect(range.step, name).toBeGreaterThan(0)
    }
  })
})

describe('validateThemeToken：颜色', () => {
  const colorFields: Array<[string, (token: ThemeToken) => void]> = [
    ['text.color', (token) => (token.text.color = 'red')],
    ['text.secondaryColor', (token) => (token.text.secondaryColor = 'red')],
    ['primary', (token) => (token.primary = 'red')],
    ['borderColor', (token) => (token.borderColor = 'red')],
    ['headingColor', (token) => (token.headingColor = 'red')],
    ['quote.backgroundColor', (token) => (token.quote.backgroundColor = 'red')],
    ['code.inlineBackgroundColor', (token) => (token.code.inlineBackgroundColor = 'red')],
    ['table.headerBackgroundColor', (token) => (token.table.headerBackgroundColor = 'red')],
    ['divider.borderTopColor', (token) => (token.divider.borderTopColor = 'red')],
  ]

  it.each(colorFields)('%s 拒绝非十六进制颜色', (path, mutate) => {
    expect(failure(withToken(mutate))).toContain(`${path} 必须是 #rrggbb 或 #rgb 颜色`)
  })

  it.each(['#abc', '#AABBCC', '#123456'])('接受颜色 %s', (color) => {
    expect(() => validateThemeToken(withToken((token) => (token.primary = color)))).not.toThrow()
  })

  it.each(['#abcd', '#12345', '#1234567', 'rgb(0,0,0)'])('拒绝颜色 %s', (color) => {
    expect(failure(withToken((token) => (token.primary = color)))).toContain('必须是 #rrggbb')
  })

  it('颜色首尾空白被去掉', () => {
    const result = validateThemeToken(withToken((token) => (token.primary = '  #abcdef  ')))
    expect(result.primary).toBe('#abcdef')
  })
})

describe('validateThemeToken：可选字段与默认值', () => {
  it('page.backgroundColor 缺省为 undefined', () => {
    const token = withToken((input) => delete input.page.backgroundColor)
    expect(validateThemeToken(token).page.backgroundColor).toBeUndefined()
  })

  it.each([null, ''])('page.backgroundColor 为 %s 时归一为 undefined', (value) => {
    const token = withToken((input) => (input.page.backgroundColor = value as never))
    expect(validateThemeToken(token).page.backgroundColor).toBeUndefined()
  })

  it('page.backgroundColor 非法时报错', () => {
    expect(failure(withToken((token) => (token.page.backgroundColor = 'white')))).toContain(
      'theme.page.backgroundColor'
    )
  })

  it('code.backgroundColor 缺省、空值与非法值', () => {
    expect(
      validateThemeToken(withToken((token) => delete token.code.backgroundColor)).code
        .backgroundColor
    ).toBeUndefined()
    expect(
      validateThemeToken(withToken((token) => (token.code.backgroundColor = ''))).code
        .backgroundColor
    ).toBeUndefined()
    expect(failure(withToken((token) => (token.code.backgroundColor = 'transparent')))).toContain(
      'theme.code.backgroundColor'
    )
  })

  it('quote.decoration 缺省为 bar', () => {
    const token = withToken((input) => {
      delete (input.quote as { decoration?: ThemeToken['quote']['decoration'] }).decoration
    })
    expect(validateThemeToken(token).quote.decoration).toBe('bar')
  })

  it('quote.decoration 只接受 none 与 bar', () => {
    expect(failure(withToken((token) => (token.quote.decoration = 'left' as never)))).toContain(
      '必须是 none / bar 之一'
    )
  })

  it('code.captionDivider 缺省时补 solid 样式且颜色为空', () => {
    const token = withToken((input) => {
      delete (input.code as { captionDivider?: ThemeToken['code']['captionDivider'] })
        .captionDivider
    })
    expect(validateThemeToken(token).code.captionDivider).toEqual({ borderBottomStyle: 'solid' })
  })

  it('code.captionDivider.borderBottomStyle 缺省为 solid', () => {
    const token = withToken((input) => {
      input.code.captionDivider = {} as ThemeToken['code']['captionDivider']
    })
    expect(validateThemeToken(token).code.captionDivider.borderBottomStyle).toBe('solid')
  })
})

describe('validateThemeToken：枚举', () => {
  it.each(HLJS_THEME_VALUES)('接受 hljsTheme %s', (value) => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.code.hljsTheme = value)))
    ).not.toThrow()
  })

  it('拒绝未知 hljsTheme', () => {
    expect(failure(withToken((token) => (token.code.hljsTheme = 'monokai')))).toContain(
      'theme.code.hljsTheme 必须是'
    )
  })

  it.each(CODE_BORDER_STYLE_VALUES)('接受代码边框样式 %s', (value) => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.code.borderStyle = value)))
    ).not.toThrow()
  })

  it('拒绝未知代码边框样式', () => {
    expect(failure(withToken((token) => (token.code.borderStyle = 'dotted' as never)))).toContain(
      'theme.code.borderStyle'
    )
  })

  it('标题对齐只接受 left 与 center', () => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.h2.textAlign = 'center')))
    ).not.toThrow()
    expect(failure(withToken((token) => (token.h2.textAlign = 'right' as never)))).toBe(
      'theme.h2.textAlign 必须是 left / center 之一'
    )
  })

  it.each(['none', 'bar', 'underline', 'bracket'])('接受标题装饰 %s', (value) => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.h3.decoration = value as never)))
    ).not.toThrow()
  })

  it('拒绝未知标题装饰', () => {
    expect(failure(withToken((token) => (token.h6.decoration = 'dot' as never)))).toContain(
      'theme.h6.decoration'
    )
  })

  it('分割线样式只接受 solid / dashed / none', () => {
    expect(() =>
      validateThemeToken(withToken((token) => (token.divider.borderTopStyle = 'dashed')))
    ).not.toThrow()
    expect(
      failure(withToken((token) => (token.divider.borderTopStyle = 'double' as never)))
    ).toContain('theme.divider.borderTopStyle')
  })
})

describe('validateThemeToken：标题分组', () => {
  it.each(HEADING_KEYS)('%s 缺失时整组校验失败', (key) => {
    const token = validToken() as unknown as Record<string, unknown>
    delete token[key]
    expect(failure(token)).toContain(`theme.${key} 必须是对象`)
  })

  it.each(HEADING_KEYS)('%s 的 fontSize 使用 12–40 区间', (key) => {
    expect(failure(withToken((token) => (token[key].fontSize = 11)))).toContain(
      `theme.${key}.fontSize 必须在 12 到 40 之间`
    )
  })
})
