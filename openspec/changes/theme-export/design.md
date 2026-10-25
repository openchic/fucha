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

机制与常量以 docs/DESIGN.md 的「主题系统」「导出」为准，本文只保留本 change 特有的取舍：

**CSS 生成函数单源，双输出。** 备选两套样式各自维护：必然漂移，否。

**高亮选 highlight.js 而非 shiki。** 同步、体积轻，微信只认内联样式，TextMate 级高亮精度收益趋零。

**图片 base64 放导出末端。** 不在净化阶段做，保持 Article.html 可复用于预览与导出；超限或失败降级占位。

**微信降级分两层。** 结构层白名单与样式层属性表各自可单测。

**来源行只在导出时附加。** 与预览元信息栏同源于 Article，避免双份维护。

**剪贴板走主进程写 HTML，落盘复用 saveFile 通道。** 渲染进程 Clipboard API 的跨平台行为不可控，否。

**主题选择本期只展示当前预设。** 自定义列表与编辑入口由下一 change 扩展。

**兼容性清单与 bad case 样张落仓库。** 清单是流程资产，每项含验证步骤与预期，规则一变可快速重跑；样张存 artifacts 便于对比。

## Risks / Trade-offs

- [juice 对复杂选择器内联不全] → 生成函数只输出元素级选择器（h1、p、blockquote、pre code、table 等），不生成嵌套与伪类，从源头避开
- [微信编辑器对 base64 大图转存失败] → 单图 5MB 上限 + 清单项实测，超限降级占位
- [深色模式下微信客户端改写代码块配色] → 清单专项实测，必要时代码块配色选微信深色模式不反转的安全组合
- [hljs 语言自动检测误判] → 常用语言子集显式注册（按标记语言序：ts/js/py/go/rust/bash/json/yaml/html/css/sql），检测失败落纯文本

## Migration Plan

绿地叠加，无迁移。回滚即移除 theme/ 与 export.ts，预览退回 change 1 的基线样式。

## Open Questions

无。
