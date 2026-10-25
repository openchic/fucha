## Why

浮槎的核心链路是"链接进、公众号文章出"，M0 先打通前半段：粘贴链接，抓取、提取、净化，右侧出现可读的正文预览。没有这一步，主题与导出（M1/M2）都无从谈起。

## What Changes

- 新增主进程抓取 IPC（`fetchArticle`）：原生 fetch 拉取 HTML，带超时与错误抛出。
- 新增提取管道：`DOMParser` 转 Document，Readability 提取正文与元信息（标题、作者、发布时间），DOMPurify 净化后进入渲染；净化保留静态内嵌 SVG，剥离脚本、事件、外部引用与可执行/嵌入式内容。
- 新增图片下载 IPC（`downloadImages`）：正文图片落地 userData 按文章归档，记录 `ImageAsset.status`。
- 微信站点适配：图片真实地址取 `data-src`，下载带 Referer 绕防盗链，验证码页显式抛错。
- 新增界面四态：初始态（顶部品牌命令栏、左对齐输入框与生成按钮，回车与点击等价）、加载态（顶部保留紧凑输入区，正文区域显示骨架屏，标注请求/解析两阶段）、预览态（顶部命令栏预留文章操作，正文上方显示横向元信息带与只读正文，图片在后台下载并更新元信息状态）、失败态（正文区域原位报错可重试）。
- 验收标准：二十个不同类型链接（博客、文档站、微信公众号）提取正确率达标，预览可读。

不在本 change 范围：主题系统、内联样式导出与剪贴板（change 2），主题面板与持久化（change 3）。

## Capabilities

### New Capabilities

- `article-fetch`: 主进程抓取文章 HTML，含错误处理与微信站点适配（data-src、Referer、验证码抛错）。
- `article-extract`: 从抓取的 HTML 提取正文与元信息，DOMPurify 净化，产出 Article 数据契约。
- `image-assets`: 正文图片下载、状态跟踪与 userData 归档清理。
- `preview-ui`: 应用四态界面——初始态（输入框加生成按钮）、加载态（骨架屏与请求/解析两阶段）、只读预览态（横向元信息带、图片下载状态、顶部文章操作预留位、正文）、失败态（原位报错可重试）。

### Modified Capabilities

（无，绿地项目，首批 capabilities）

## Impact

- 新依赖：`@mozilla/readability`、`dompurify`。
- 代码：`src/main/ipc.ts`（新增）、`src/main/index.ts`（窗口加载）、`src/preload/index.ts`（暴露 IPC）、`src/renderer/src/views/`（ComposeView、PreviewView）、`src/renderer/src/pipeline/`（extract、sanitize、images）、`src/shared/types.ts`（数据契约与 IPC 签名）。
- 后续 change 2 依赖本 change 产出的 Article 契约与 PreviewView 宿主。
