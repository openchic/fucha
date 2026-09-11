## Context

绿地项目，electron-vite 脚手架已就位（main / preload / renderer 三进程骨架），架构边界见 docs/DESIGN.md。本 change 对应里程碑 M0。

## Goals / Non-Goals

**Goals:**

- 打通"输入链接 → 抓取 → 提取 → 净化 → 只读预览"主链路
- 落定跨进程数据契约（Article / ImageAsset）与 IPC 面
- 微信公众号文章可用（data-src 取图、Referer 下载、验证码抛错）
- 二十个不同类型链接的提取正确率验证

**Non-Goals:**

- 主题系统、内联导出、剪贴板（change 2）
- 隐藏 BrowserWindow 二级兜底、通用站点适配系统
- 正文编辑、图片重试退避、素材库

## Decisions

**抓取放主进程，原生 fetch，IPC 单入口。** 渲染进程 fetch 受同源策略限制，主进程不受；备选 Electron `net` 模块能力等价但类型与测试不如原生 fetch 直接。失败按"网络不可达 / 超时 / 目标拒绝 / 验证码"四类抛出，错误对象跨 IPC 可序列化。

**提取与净化放渲染进程。** 渲染进程本身有 DOM，`DOMParser` 转 Document 后跑 Readability，随后 DOMPurify 净化，净化后的 HTML 才进 React 状态。备选主进程 jsdom：多一份 DOM 实现、多内存，否。净化紧贴解析入口，保证进入预览的数据源已安全。

**契约与 IPC 面集中在 shared/types.ts。** Article / ImageAsset 类型与 IPC 方法签名同文件维护，preload 经 contextBridge 暴露单一命名空间。备选分散定义（主渲染各写一份）：漂移风险，否。

**微信适配用最小域名表（profiles.ts）。** 每个域名一组配置：图片属性映射（src → data-src）、下载请求头（Referer）。验证码页按内容特征识别后走统一错误分类。备选通用适配配置系统：现阶段无第二个站点证明其形状，否——等真实需求出现再泛化。

**图片按文章归档 userData，状态机三值。** 目录 `userData/article-cache/<文章hash>/`，图片以内容 hash 命名实现复用；`ImageAsset.status` 为 pending / done / failed 三值，下载失败保留 originalUrl 降级展示。下载并发限制 3，单图超时，失败不重试（M0 不做退避）。

**界面用单一状态机，不引路由。** idle / loading / preview / error 四态，loading 内部细分为请求、解析、下载三个阶段，阶段由主进程进度事件推送。备选 react-router：单窗口单流程，否。

**M0 预览用最小可读样式基线。** 目的是验证提取正确性，不是还原排版；主题渲染是 change 2 的事，本期样式刻意从简。

## Risks / Trade-offs

- [微信图片带 Referer 仍可能失败] → status=failed 加占位展示，预览不阻断
- [Readability 对部分站点提取错位] → 二十链接验证清单先行，bad case 沉淀进 profiles 域名表
- [源页面嵌入 iframe 或大图拖慢渲染] → 净化白名单移除 iframe，下载限并发加超时
- [验证码特征误判] → 特征识别宁窄勿宽，误判走通用错误路径，不误伤正常文章

## Migration Plan

绿地无迁移。回滚即删除新增文件，脚手架不受影响。

## Open Questions

无。预览样式基线、图片复用粒度均已在决策中定值。
