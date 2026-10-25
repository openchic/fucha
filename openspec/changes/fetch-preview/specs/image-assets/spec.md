## Purpose

下载正文图片到本地并跟踪状态，为预览展示与后续导出内联提供素材。下载失败不得影响预览主流程。

## ADDED Requirements

### Requirement: 图片下载与状态跟踪

文章提取完成后，系统 SHALL 下载正文图片到本地、按文章归档，并为每张图片维护状态（下载中、成功、失败）；成功的图片 SHALL 记录本地路径，失败的 SHALL 保留原始地址。

#### Scenario: 下载成功

- **WHEN** 一张正文图片成功下载
- **THEN** 该图片状态为成功且记录本地路径

#### Scenario: 下载失败

- **WHEN** 一张正文图片下载失败（防盗链、404、超时）
- **THEN** 该图片状态为失败且保留原始地址，不抛出阻断性错误

### Requirement: 下载不阻断预览

图片下载 SHALL 与正文预览解耦：预览先行展示，图片状态独立更新；下载缓慢或失败时预览不受阻塞。

#### Scenario: 慢图不阻塞

- **WHEN** 部分图片下载缓慢
- **THEN** 正文预览已先行展示，图片完成后自行更新

### Requirement: 归档与复用

已下载图片 SHALL 按文章归档存储；同一文章重复处理时 SHALL 复用已下载的图片，不重复下载。并发下载 SHALL 全部写入缓存索引，不得因读改写竞争丢失映射。

#### Scenario: 重复处理同一链接

- **WHEN** 用户再次提交已成功处理过的同一链接
- **THEN** 已下载的图片被复用，不发起重复下载

### Requirement: SVG 图片识别

正文 `<img>` 引用的 SVG SHALL 与其他位图一样下载并进入缓存；缓存文件 SHALL 保留 `.svg` 扩展名，本地协议 SHALL 以 `image/svg+xml` 返回，预览 SHALL 正常显示矢量图。曾出现 SVG 被存为 `.jpg` 且以 `image/jpeg` 返回，最终实现 SHALL 同时按响应内容类型与 URL 扩展名识别 SVG。

#### Scenario: SVG 图片进入缓存

- **WHEN** 正文图片地址指向 SVG，且响应类型为 `image/svg+xml`
- **THEN** 下载状态为成功，缓存文件名以 `.svg` 结尾

#### Scenario: SVG 通过本地协议显示

- **WHEN** 预览请求缓存中的 SVG
- **THEN** 响应 Content-Type 为 `image/svg+xml`，图片正常显示

### Requirement: 本地图片协议边界

已下载图片 SHALL 能通过 `fucha://img/<articleHash>/<file>` 读取；协议 SHALL 只服务对应文章缓存目录内的文件，路径穿越请求 SHALL 被拒绝。曾出现合法图片因缓存路径拼接顺序相反及文件 URL 读取失败而无法显示，最终实现 SHALL 以缓存目录为基准解析相对路径并直接读取文件字节。

#### Scenario: 已下载图片可显示

- **WHEN** 预览请求一张已下载且索引存在的图片
- **THEN** 协议返回图片字节与图片 Content-Type，不返回 403

#### Scenario: 路径穿越被拒绝

- **WHEN** 请求路径试图逃出文章缓存目录
- **THEN** 协议返回 403 或 404，不读取目录外文件
