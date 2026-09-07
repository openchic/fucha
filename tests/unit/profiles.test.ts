import { describe, expect, it } from 'vitest'
import { looksLikeCaptcha, matchProfile } from '@shared/profiles'

describe('matchProfile：域名匹配', () => {
  it('精确匹配微信文章域名', () => {
    const profile = matchProfile('https://mp.weixin.qq.com/s/abc')
    expect(profile?.imageSourceAttr).toBe('data-src')
    expect(profile?.revealSelectors).toEqual(['#js_content'])
  })

  it('匹配子域名', () => {
    expect(matchProfile('https://sub.weixin.qq.com/s/abc')).toBeDefined()
  })

  it('匹配微信图片域名且不带正文适配', () => {
    const profile = matchProfile('https://mmbiz.qpic.cn/mmbiz_png/abc/0')
    expect(profile).toBeDefined()
    expect(profile?.imageSourceAttr).toBeUndefined()
    expect(profile?.imageHeaders).toEqual({ Referer: 'https://mp.weixin.qq.com/' })
    expect(profile?.captchaSignatures).toEqual([])
  })

  it('匹配 MDN 并携带提取后移除规则', () => {
    expect(
      matchProfile('https://developer.mozilla.org/en-US/docs/Web/API')?.postDropSelectors
    ).toEqual(['.baseline-indicator'])
  })

  it('匹配 nodejs.org 并携带提取前移除规则', () => {
    expect(matchProfile('https://nodejs.org/api/fs.html')?.dropSelectors).toEqual(['.code-toolbar'])
  })

  it('匹配 joshwcomeau.com', () => {
    expect(matchProfile('https://www.joshwcomeau.com/css/')?.dropSelectors).toEqual([
      '[data-demo-unit]',
    ])
  })

  it('域名大小写不敏感', () => {
    expect(matchProfile('https://MP.WEIXIN.QQ.COM/s/abc')).toBeDefined()
  })

  it('忽略端口号', () => {
    expect(matchProfile('https://mp.weixin.qq.com:8443/s/abc')).toBeDefined()
  })

  it('拒绝后缀伪装域名', () => {
    expect(matchProfile('https://mp.weixin.qq.com.evil.test/s/abc')).toBeUndefined()
  })

  it('拒绝仅路径包含站点的 URL', () => {
    expect(matchProfile('https://evil.test/mp.weixin.qq.com/s/abc')).toBeUndefined()
  })

  it('未配置的域名返回 undefined', () => {
    expect(matchProfile('https://example.com/article')).toBeUndefined()
  })

  it.each(['', 'not a url', '/relative/path', 'mailto:a@b.test'])(
    '无法解析的输入 %s 返回 undefined',
    (input) => {
      expect(matchProfile(input)).toBeUndefined()
    }
  )
})

describe('looksLikeCaptcha', () => {
  it('命中微信验证码特征', () => {
    expect(looksLikeCaptcha('<p>环境异常，请完成验证</p>', 'https://mp.weixin.qq.com/s/abc')).toBe(
      true
    )
  })

  it('未命中特征时返回 false', () => {
    expect(looksLikeCaptcha('<p>正常文章正文</p>', 'https://mp.weixin.qq.com/s/abc')).toBe(false)
  })

  it('空页面返回 false', () => {
    expect(looksLikeCaptcha('', 'https://mp.weixin.qq.com/s/abc')).toBe(false)
  })

  it('只做精确子串匹配，不做模糊匹配', () => {
    expect(looksLikeCaptcha('环境异', 'https://mp.weixin.qq.com/s/abc')).toBe(false)
  })

  it('未配置的站点一律返回 false', () => {
    expect(looksLikeCaptcha('环境异常', 'https://example.com/article')).toBe(false)
  })

  it('微信图片域名不带验证码特征', () => {
    expect(looksLikeCaptcha('环境异常', 'https://mmbiz.qpic.cn/a.png')).toBe(false)
  })
})
