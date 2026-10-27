# AGENTS.md

## 项目概览

fucha —— 基于 Electron + React + TypeScript 的桌面应用。

## 代码规范

代码规范按 `code-style` skill 执行。与本文冲突时以本文为准，样式上本项目走 Tailwind，不是 CSS Modules。

## 样式约定

应用壳的单元素样式写 Tailwind 工具类；`app.css` 只留 `@theme` token、元素级重置、伪元素与关键帧、滚动条、窗口拖动这类平台标记，以及被多个组件或多重状态复用的规则。文章正文与导出样式不经 Tailwind，只由 ThemeToken 决定，见 `docs/DESIGN.md` 的配色节。存量按改动收敛，不为此单开全量重写。

## 开发调试

验证界面与交互一律启动本地应用（`pnpm dev`）在真实窗口里操作，不用浏览器打开 dev server 页面替代：那里没有 preload 暴露的 IPC，抓取、预览与错误态都跑不通。

## OpenSpec 变更管理规则

### 1. Change 边界

- 除非用户明确要求，不要把后续需求混入当前 change。
- 后续改动默认归入当前相关且尚未归档的 change，并同步更新该 change 的 `proposal`、`spec`、`design`、`tasks` 文档。
- 只有满足以下任一条件时才创建新 change：
  - 用户明确要求新建 change；
  - 当前 change 与该改动无关；
  - 当前 change 已归档。
- 创建新 change 前，先归档其他尚未归档的 change。

### 2. 归档

- 归档前自动将 delta spec 同步到主规格（`openspec/specs/`），并确认同步结果。
- 每次归档后，提交归档文档及相关变更。

### 3. Bug 的 Spec 规范

- Bug 的 spec 必须记录：已确认的用户可见现象、根因、最终处理约束。
- 排查日志、临时诊断代码、失败的试改只保留在 `design` 或归档记录中，不混入长期规格。

### 4. Explore → Fast-forward → Apply 流程

- `openspec-explore` 阶段只探索并确认方案，不写实现代码。
- 用户确认 proposal 后结束 Explore，切换到 fast-forward 和 apply 流程：连续生成剩余文档（specs、design、tasks）、实现代码并完成必要验证，直到代码写完。
- 除非遇到需求歧义、设计冲突或错误，否则不逐项请求确认。
