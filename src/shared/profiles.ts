// 站点适配：按域名配置抓取与图片下载的差异行为。微信必须，其余站点按需添加。

type SiteProfile = {
  /** 图片真实地址所在的属性（微信把 src 换成占位图，真实地址在 data-src） */
  imageSourceAttr?: string
  /** 图片下载需要附加的请求头（微信图片带 Referer 绕防盗链） */
  imageHeaders?: Record<string, string>
  /** 页面命中这些特征时判定为验证码/环境异常页，显式抛错而非返回空正文 */
  captchaSignatures: string[]
}

const WECHAT: SiteProfile = {
  imageSourceAttr: 'data-src',
  imageHeaders: { Referer: 'https://mp.weixin.qq.com/' },
  captchaSignatures: ['环境异常', '完成验证', '当前环境异常，完成验证后即可继续访问'],
}

const PROFILES: { hostSuffix: string; profile: SiteProfile }[] = [
  { hostSuffix: 'mp.weixin.qq.com', profile: WECHAT },
  { hostSuffix: 'weixin.qq.com', profile: WECHAT },
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
