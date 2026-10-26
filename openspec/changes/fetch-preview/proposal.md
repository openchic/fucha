## Why

浮槎的核心链路是"链接进、公众号文章出"，M0 先打通前半段：粘贴链接，抓取、提取、净化，右侧出现可读的正文预览。没有这一步，主题与导出（M1/M2）都无从谈起。

## What Changes

- 新增主进程抓取 IPC（`fetchArticle`）：原生 fetch 拉取 HTML，带超时与错误抛出。
- 新增提取管道：`DOMParser` 转 Document，Readability 提取正文与元信息（标题、作者、发布时间），DOMPurify 净化后进入渲染；净化保留静态内嵌 SVG，剥离脚本、事件、外部引用与可执行/嵌入式内容。
- 新增图片下载 IPC（`downloadImages`）：正文图片落地 userData 按文章归档，记录 `ImageAsset.status`。
- 微信站点适配：图片真实地址取 `data-src`，下载带 Referer 绕防盗链，验证码页显式抛错。
- 新增界面四态：不设独立顶部栏，初始态在内容区展示品牌、左对齐输入框与生成按钮，回车与点击等价；加载态显示骨架屏与请求/解析两阶段；预览态在文章信息带展示标题、来源与「首页」，文章操作随对应能力追加，下方为只读正文，图片在后台下载并原位更新预览；失败态在原位报错，可返回首页或重试。
- 优化四态视觉层级：保持既有配色、测宽与交互，收敛品牌字标、表单比例、元信息间距、中性按钮及加载和错误状态；内容区使用单一白色背景与直角边界，窗口拖动统一由顶部区域触发，使界面更接近 macOS 原生应用的简洁观感。
- 验收标准：二十个不同类型链接（博客、文档站、微信公众号）提取正确率达标，预览可读。
- 元信息带省略全部图片状态与数量提示，不保留占位。
- 进一步参考 Apple 的排版与控件层次，保留白色单栏与品牌绿，增加浮槎帆形字标、统一线性图标，将预览操作与完整标题分行；补齐链接清除、地址补全、就地校验、加载取消及不展示图片状态的精简元信息。换链接不在预览内提供，改链接统一回「首页」在初始态重新输入。

不在本 change 范围：主题系统、内联样式导出与剪贴板（change 2），主题面板与持久化（change 3）。

## Capabilities

### New Capabilities

- `article-fetch`: 主进程抓取文章 HTML，含错误处理与微信站点适配（data-src、Referer、验证码抛错）。
- `article-extract`: 从抓取的 HTML 提取正文与元信息，DOMPurify 净化，产出 Article 数据契约。
- `image-assets`: 正文图片下载、状态跟踪与 userData 归档清理。
- `preview-ui`: 应用四态界面——初始态（输入框加生成按钮）、加载态（骨架屏与请求/解析两阶段）、只读预览态（横向元信息带、顶部文章操作预留位、正文）、失败态（原位报错可重试）。

### Modified Capabilities

（无，绿地项目，首批 capabilities）

## Impact

- 新依赖：`@mozilla/readability`、`dompurify`。
- 代码：`src/main/ipc.ts`（新增）、`src/main/index.ts`（窗口加载）、`src/preload/index.ts`（暴露 IPC）、`src/renderer/src/views/`（ComposeView、ArticleMeta）、`src/renderer/src/pipeline/`（extract、sanitize、images）、`src/shared/types.ts`（数据契约与 IPC 签名）。
- 后续 change 2 依赖本 change 产出的 Article 契约与 ArticleMeta 信息带宿主。
