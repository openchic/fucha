// 站点适配：按域名配置抓取与图片下载的差异行为。微信必须，其余站点按需添加。

type SiteProfile = {
  /** 图片真实地址所在的属性（微信把 src 换成占位图，真实地址在 data-src） */
  imageSourceAttr?: string
  /** 图片下载需要附加的请求头（微信图片带 Referer 绕防盗链） */
  imageHeaders?: Record<string, string>
  /** 正文容器在来源页被脚本预先隐藏，提取前需解除内联隐藏，否则 Readability 判为不可见 */
  revealSelectors?: string[]
  /** 提取前移除的导航或交互控件；不影响正文判定 */
  dropSelectors?: string[]
  /** 提取后移除的站点组件；参与正文判定，提前删会改变提取结果 */
  postDropSelectors?: string[]
  /** 页面命中这些特征时判定为验证码/环境异常页，显式抛错而非返回空正文 */
  captchaSignatures: string[]
}

const WECHAT_HEADERS = { Referer: 'https://mp.weixin.qq.com/' }

const WECHAT: SiteProfile = {
  imageSourceAttr: 'data-src',
  imageHeaders: WECHAT_HEADERS,
  revealSelectors: ['#js_content'],
  captchaSignatures: ['环境异常', '完成验证', '当前环境异常，完成验证后即可继续访问'],
}

/** 正文图片域名与文章页不同，下载时同样需要 Referer */
const WECHAT_IMAGE: SiteProfile = {
  imageHeaders: WECHAT_HEADERS,
  captchaSignatures: [],
}

const MDN: SiteProfile = {
  postDropSelectors: ['.baseline-indicator'],
  captchaSignatures: [],
}

const NODEJS: SiteProfile = {
  dropSelectors: ['.code-toolbar'],
  captchaSignatures: [],
}

const JOSH_COMEAU: SiteProfile = {
  dropSelectors: ['[data-demo-unit]'],
  captchaSignatures: [],
}

const PROFILES: { hostSuffix: string; profile: SiteProfile }[] = [
  { hostSuffix: 'mp.weixin.qq.com', profile: WECHAT },
  { hostSuffix: 'weixin.qq.com', profile: WECHAT },
  { hostSuffix: 'mmbiz.qpic.cn', profile: WECHAT_IMAGE },
  { hostSuffix: 'developer.mozilla.org', profile: MDN },
  { hostSuffix: 'nodejs.org', profile: NODEJS },
  { hostSuffix: 'joshwcomeau.com', profile: JOSH_COMEAU },
]

/** 按域名后缀匹配站点适配，未命中返回 undefined */
export function matchProfile(url: string): SiteProfile | undefined {
  let host: string
  try {
    host = new URL(url).hostname
  } catch {
    return undefined
  }
  return PROFILES.find((p) => host === p.hostSuffix || host.endsWith(`.${p.hostSuffix}`))?.profile
}

/** 验证码/环境异常页特征识别，宁窄勿宽：全部按精确子串匹配 */
export function looksLikeCaptcha(html: string, url: string): boolean {
  const profile = matchProfile(url)
  if (!profile) return false
  return profile.captchaSignatures.some((s) => html.includes(s))
}
