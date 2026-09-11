## Context

依赖 change 1 的 Article 契约、净化管道与预览态宿主。本 change 对应里程碑 M1，核心风险在"预览与导出两条渲染路径的一致性"，设计围绕这个风险展开。

## Goals / Non-Goals

**Goals:**

- 预览即公众号所见效果（同源 CSS 生成）
- 导出产物粘进公众号后台不改格式
- 兼容性清单可重跑，作为回归基线

**Non-Goals:**

- 主题编辑面板与自定义主题持久化（change 3）
- 素材库 API、多平台导出
- 提取质量优化（change 1 范畴）

## Decisions

**CSS 生成函数单源，双输出。** 一个纯函数 `generateCss(token)` 内部先产出声明表（属性 → 值），再按路径物化：预览路径物化为 CSS 变量注入容器；导出路径直接输出带具体值的样式表喂给 juice。禁止在组件里手写样式字面量绕过生成函数——这是一致性的唯一保证。备选两套样式各自维护：必然漂移，否。

**高亮选 highlight.js 而非 shiki。** hljs 同步、体积轻一个量级，输出 class 由 juice 统一内联成 style，最终效果与 shiki 等价（微信只认内联样式，TextMate 级高亮精度在这里收益趋零）。`codeTheme` 字段存 hljs 主题名。

**图片 base64 内联放导出管道末端。** 已下载（status=done）的图转 data URI；超 5MB 或 failed 的跳过并降级为占位。不在净化阶段做，保持 Article.html 可复用于两条路径。

**微信降级分两层。** 结构层在净化白名单（change 1 已建）保证不放 iframe 等黑名单进管道；样式层在导出前过微信安全属性表——白名单外的属性（position、float、grid 等）剔除，等价能力（代码块横向滚动）用微信安全的写法生成。两层各自可单测。

**来源行在导出时附加，不在预览渲染。** 来源信息预览态已固定展示于元信息栏（change 1），导出产物末尾自动附脚注式来源行；两处内容同源于 Article，避免双份维护。

**剪贴板走主进程写 HTML 格式。** 渲染进程 Clipboard API 写 text/html 在 Electron 下可行，但主进程 clipboard.writeHtml 保证格式与跨平台行为一致，复用 saveFile 通道落盘。备选渲染进程 API：行为差异不可控，否。

**兼容性清单落 docs/，产物示例落 artifacts。** 清单本身是流程资产（每项含验证步骤与预期），bad case 样张存仓库便于规则变化时对比。

## Risks / Trade-offs

- [juice 对复杂选择器内联不全] → 生成函数只输出元素级选择器（h1、p、blockquote、pre code、table 等），不生成嵌套与伪类，从源头避开
- [微信编辑器对 base64 大图转存失败] → 单图 5MB 上限 + 清单项实测，超限降级占位
- [深色模式下微信客户端改写代码块配色] → 清单专项实测，必要时代码块配色选微信深色模式不反转的安全组合
- [hljs 语言自动检测误判] → 常用语言子集显式注册（按标记语言序：ts/js/py/go/rust/bash/json/yaml/html/css/sql），检测失败落纯文本

## Migration Plan

绿地叠加，无迁移。回滚即移除 theme/ 与 export.ts，预览退回 change 1 的基线样式。

## Open Questions

无。
