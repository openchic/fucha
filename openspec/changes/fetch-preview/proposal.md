## Why

浮槎的核心链路是"链接进、公众号文章出"，M0 先打通前半段：粘贴链接，抓取、提取、净化，右侧出现可读的正文预览。没有这一步，主题与导出（M1/M2）都无从谈起。

## What Changes

- 新增主进程抓取 IPC（`fetchArticle`）：原生 fetch 拉取 HTML，带超时与错误抛出。
- 新增提取管道：`DOMParser` 转 Document，Readability 提取正文与元信息（标题、作者、发布时间），DOMPurify 净化后进入渲染。
- 新增图片下载 IPC（`downloadImages`）：正文图片落地 userData 按文章归档，记录 `ImageAsset.status`。
- 微信站点适配：图片真实地址取 `data-src`，下载带 Referer 绕防盗链，验证码页显式抛错。
- 新增两个界面状态：初始态（居中单输入框）、加载态（区分请求/解析/下载图片）、预览态（左侧元信息栏，右侧只读正文预览）。
- 验收标准：二十个不同类型链接（博客、文档站、微信公众号）提取正确率达标，预览可读。

不在本 change 范围：主题系统、内联样式导出与剪贴板（change 2），主题面板与持久化（change 3）。

## Capabilities

### New Capabilities

- `article-fetch`: 主进程抓取文章 HTML，含错误处理与微信站点适配（data-src、Referer、验证码抛错）。
- `article-extract`: 从抓取的 HTML 提取正文与元信息，DOMPurify 净化，产出 Article 数据契约。
- `image-assets`: 正文图片下载、状态跟踪与 userData 归档清理。
- `preview-ui`: 应用三态界面——输入框态、加载态、只读预览态（元信息栏 + 正文）。

### Modified Capabilities

（无，绿地项目，首批 capabilities）

## Impact

- 新依赖：`@mozilla/readability`、`dompurify`。
- 代码：`src/main/ipc.ts`（新增）、`src/main/index.ts`（窗口加载）、`src/preload/index.ts`（暴露 IPC）、`src/renderer/src/views/`（ComposeView、PreviewView）、`src/renderer/src/pipeline/`（extract、sanitize、images）、`shared/types.ts`（数据契约与 IPC 签名）。
- 后续 change 2 依赖本 change 产出的 Article 契约与 PreviewView 宿主。
