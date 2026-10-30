## Purpose

通过主进程抓取目标链接的页面 HTML，为提取管道提供原始输入。抓取是整条链路的入口，错误必须可区分、微信站点必须可用。

## ADDED Requirements

### Requirement: 抓取链接返回页面 HTML

系统 SHALL 通过主进程抓取用户提交的链接，返回页面 HTML 内容；所有失败路径 SHALL 以明确错误结束，不得静默返回空内容。

#### Scenario: 成功抓取

- **WHEN** 用户提交一个可公开访问的文章链接
- **THEN** 系统返回该页面的 HTML 内容

#### Scenario: 目标超时

- **WHEN** 目标服务器在限定时间内未响应
- **THEN** 抓取以超时错误结束，不无限等待

#### Scenario: 网络不可达

- **WHEN** 目标域名无法解析或连接被拒绝
- **THEN** 返回包含原因的错误

### Requirement: 错误按原因分类

抓取失败 SHALL 按原因分类（网络不可达、超时、目标拒绝、验证码拦截），下游界面 SHALL 能依据分类展示对应提示。

#### Scenario: 分类可辨

- **WHEN** 抓取因目标拒绝（非 2xx）而失败
- **THEN** 错误信息包含"目标拒绝"分类与状态码

### Requirement: 微信文章适配

对微信公众号文章，系统 SHALL 做站点级适配：图片真实地址以 `data-src` 为准；图片下载请求 SHALL 携带微信 Referer 以绕过防盗链；验证码或环境异常页 SHALL 显式抛错。正文图片域名 `mmbiz.qpic.cn` SHALL 与文章域名一样命中站点表；仅按文章域名匹配会使图片下载不带 Referer。

#### Scenario: data-src 取图

- **WHEN** 抓取的微信文章正文图片真实地址位于 data-src 属性
- **THEN** 产出的图片地址来自 data-src 而非占位 src

#### Scenario: 防盗链绕过

- **WHEN** 下载微信文章的图片，图片域名与文章域名不同
- **THEN** 请求按图片自身域名命中站点表并携带微信域名 Referer

#### Scenario: 验证码显式抛错

- **WHEN** 返回内容为验证码或环境异常页面
- **THEN** 抛出"需要验证"类错误，不返回空正文
