## 1. 契约与骨架

- [x] 1.1 安装 @mozilla/readability、dompurify（含类型）与 tailwindcss、@tailwindcss/vite，确认类型在两个 tsconfig（node/web）下均可解析
- [x] 1.2 建 src/shared/types.ts：Article、ImageAsset（status 三值）、抓取错误四分类、IPC 方法签名（fetchArticle、downloadImages）及其可序列化结果类型，并通过 npm run typecheck
- [x] 1.3 preload 经 contextBridge 暴露单一命名空间，主进程建 ipc.ts 空实现接线，验证渲染进程可调用并拿到类型提示
- [x] 1.4 安全基线：确认 sandbox 开启下 preload 的 contextBridge 与 IPC 可用；验证：应用正常启动且 IPC 调用成功
- [x] 1.5 注册 `fucha://` 自定义协议由主进程服务本地图片；验证：dev 与打包后预览中的本地图片均可显示

## 2. 抓取（article-fetch）

- [x] 2.1 主进程实现 fetchArticle：原生 fetch 加超时，失败按网络不可达 / 超时 / 目标拒绝 / 验证码四类抛出可序列化错误；验证：对一个 404 链接与一个不可达域名分别得到对应分类
- [ ] 2.2 建 profiles.ts 最小域名表：微信域名的图片属性映射（src → data-src）与下载请求头（Referer）；验证：真实微信文章链接抓取后图片地址来自 data-src
- [x] 2.3 微信验证码 / 环境异常页特征识别，命中走"需要验证"错误；验证：构造样例 HTML 命中，正常文章不误伤

## 3. 提取与净化（article-extract）

- [x] 3.1 渲染进程 DOMParser 转 Document 后跑 Readability，产出正文与元信息；正文过短或为空标记提取失败；验证：样例文章页提取出标题与正文，站点首页返回失败
- [x] 3.2 DOMPurify 白名单净化：移除 script、事件属性、javascript: 链接与 iframe，保留段落 / 标题 / 列表 / 引用 / 代码块 / 表格 / 图片语义结构；验证：注入样例净化单测通过
- [x] 3.3 组装 Article：标题、作者、发布时间、cover、来源 URL、净化后 html 与 images 数组；验证：缺失元信息时字段留空不报错
- [x] 3.4 内嵌 SVG：白名单保留静态图形、渐变、文本与安全 presentation 样式，提取前把页面级及 SVG 内部 `<style>`/class 中的安全声明按属性合并到图形，再剥离源码样式、脚本、事件、动画、外部引用、位图与 `foreignObject`，预览限制最大宽度；验证：D2 图表与 class 上色的 rect 计算色正确、静态 SVG 正常渲染、恶意样例全部失效

## 4. 图片（image-assets）

- [x] 4.1 主进程实现 downloadImages：并发限 3、单图超时、支持按域名附加请求头，结果回写 status；验证：混合有效与失效图片的链接，done 与 failed 各归其位
- [x] 4.2 文章按 hash 归档 userData/article-cache/，图片以内容 hash 命名实现复用，并发下载的索引写入串行化；验证：多图同批下载后第二次提交无新增网络请求
- [x] 4.3 下载失败图片保留 originalUrl 降级展示；验证：含失效图片的文章预览正常出稿，失效图显示占位
- [x] 4.4 SVG 图片识别：下载后保留 `.svg` 扩展名，本地协议返回 `image/svg+xml`；验证：SVG 样例落盘、协议内容类型与预览显示均正确

## 5. 界面（preview-ui）

- [x] 5.1 四态状态机（idle / loading / preview / error）与初始态：顶部品牌命令栏与左对齐输入区，输入框（占位「请输入一个链接」）紧挨「生成」按钮，回车与点击等价，处理期间按钮禁用；验证：两种提交方式均进入 loading、缩到最小宽度不横向溢出
- [x] 5.2 加载态：提交后顶部命令栏保留紧凑输入区，正文区域显示骨架屏，两阶段提示（正在请求 / 正在解析）以小字标注在骨架屏内，由渲染流程驱动，生成按钮处理期间禁用；验证：命令栏位置稳定、两阶段依次出现
- [x] 5.3 预览态：骨架屏原地淡出为只读正文；正文上方横向元信息带（标题、来源链接、作者、发布时间、图片下载状态，来源与作者固定可见，来源显示主机名并保留完整链接），顶部命令栏右侧预留文章操作区域（控件后续 change 填充）；紧凑输入区可再次提交并直接回到加载态；验证：预览内容不可编辑、命令栏自加载起保持稳定、重新提交可走通
- [ ] 5.4 最小可读样式基线（正文排版从简，为主题渲染留位）；验证：二十链接样张目视可读
- [x] 5.5 应用壳样式：接入 Tailwind（styles/app.css 作 @theme 载体），主色 #8fae96（焦点环、生成按钮、激活态）、深灰绿命令栏、浅灰绿骨架屏、实底按钮配深色文字；六条基调（留白分组不画框、色彩克制、底色分层不投影、动效短且尊重减少动态效果设置、字号底盘 14/13/16-20/12、控件圆角 8px）；验证：界面无默认灰残留，应用配色与文章预览样式互不影响
- [x] 5.6 错误态：正文区域在骨架屏原位展示分类错误并提供重试；验证：提交不可达链接后可一键重试

## 6. 验收

- [ ] 6.1 二十个不同类型链接（博客、文档站、微信公众号）验证清单跑一遍，记录提取正确率与 bad case；bad case 沉淀进 profiles.ts
- [x] 6.2 npm run typecheck 与 npm run lint 全绿，Electron 安全基线核对（contextIsolation、sandbox 开启，nodeIntegration 关闭）
