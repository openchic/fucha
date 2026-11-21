## Context

现有验证依赖两个自建脚本：`scripts/verify-main.ts` 与 `scripts/verify-renderer.ts`，由 `scripts/verify-runtime.ts` 在隐藏窗口里执行渲染侧断言，`build-verify.mjs` 用 esbuild 打包后手动以 `npx electron` 运行。断言以自定义 `check(name, pass)` 收集，没有分组、超时、重试与覆盖率。项目基于 electron-vite（Vite 7）、React 19、pnpm，`@shared` 与 `@renderer` 通过构建别名解析；`src/main/db.ts` 默认从 `app.getPath('userData')` 取数据库路径，并允许传入显式路径。参见 proposal.md 的动机与 specs/test-harness 的要求。

## Goals / Non-Goals

**Goals:**

- 用标准运行器替换自建 runner，同时保住现有 231 条断言的行为覆盖。
- 让纯逻辑测试在没有 DOM 和图形界面的环境中秒级完成。
- 让依赖真实计算样式、SQLite、协议与网络的断言继续在真实 Electron 里执行。
- 为 hooks 与组件提供可读的交互断言能力。

**Non-Goals:**

- 不追求覆盖率百分比门槛，不为了数字补低价值断言。
- 不改产品行为；唯一的源码改动是测试专用 userData 覆盖缝。
- 不在本 change 内做视觉回归截图比对。
- 不把集成测试塞进提交流程。

## Decisions

### 运行器：Vitest（单元/组件）+ Playwright `_electron`（集成）

Vitest 与现有 Vite 配置、别名、TS 转换同源，组件测试可直接用 Testing Library；Playwright 的 Electron 支持用项目自带的 Electron 二进制启动应用，不需要 `playwright install` 下载浏览器，且自带超时、重试、trace 与 worker 隔离。

备选：`node:test` 零依赖但组件测试要手写 `react-dom` 挂载与事件派发，8 个 hooks、13 个组件的边际成本过高；Jest 需要额外的 TS/ESM 转换配置，与 Vite 生态重复；WebdriverIO 的 Electron 支持已边缘化。

### DOM 环境：jsdom

Testing Library 对 jsdom 的兼容面最稳。备选 happy-dom 更快，但在当前体量下节省的时间不可感知，兼容风险不值得换。

### 保真度边界：计算样式、SQLite、协议、网络只在 Playwright 中测

导出与预览的计算样式一致性、`app://` 路径穿越、schema 迁移、图片下载失败矩阵必须在真实 Chromium 与真实主进程里跑。模拟 DOM 没有布局引擎，`getComputedStyle` 的结果不可信。备选：用 Playwright 的 Chromium 浏览器模式打开预览页面——但它缺少 preload 与 IPC，抓取和存储链路跑不通。

### 目录与命名

```
tests/unit/**/*.test.ts        node 环境，纯逻辑
tests/dom/**/*.test.tsx        jsdom + Testing Library
tests/e2e/**/*.spec.ts         Playwright Electron
tests/fixtures/**              三类来源的 HTML、主题包、损坏 zip
tests/setup/dom.ts             jest-dom 匹配器
tests/setup/fake-api.ts        类型化的 window.api 假实现
```

Vitest 的 `include` 限定为 `tests/unit` 与 `tests/dom`，Playwright 的 `testDir` 限定为 `tests/e2e`，避免两边都认领 `*.spec.ts`。理由：默认 glob 会让同一文件被两个 runner 抢跑，症状隐蔽。

### 集成测试跑构建产物而不是 dev server

`pnpm verify` 先执行 `electron-vite build`，再让 Playwright 启动 `out/main/index.js`。理由：构建产物才是发布路径，能同时拦住别名、external、preload 打包问题；dev server 下的行为差异会掩盖这类缺陷。

### 数据隔离：环境变量覆盖 userData，仅测试可用

主进程在启动早期读取一个专用环境变量，存在时调用 `app.setPath('userData', ...)`；不存在时保持现状。备选：Chromium 的 `--user-data-dir` 开关——它不改变 `app.getPath('userData')`；备选：只在 harness 里注入 `initLocalStore(path)`——但 E2E 启动的是完整应用，无法注入。

### 网络夹具：进程内 HTTP 服务，不 mock `net`

沿用现有 harness 的做法，在测试进程里起临时 HTTP 服务提供文章、图片、404、超时与重定向。理由：`fetchArticle` 走 Electron `net`，mock 掉就测不到真实的请求头、重定向和超时行为。

### 假 `window.api` 与 preload 契约对齐

`tests/setup/fake-api.ts` 实现完整的 API 接口，并新增一个契约用例：把 fake 的键集合与 `src/preload/index.d.ts` 声明的接口逐键比对。理由：手写 fake 会随 preload 增删悄悄漂移，组件测试会因此变绿但失真。

### 覆盖率只观察，不设门槛

`@vitest/coverage-v8` 仅统计 `src/shared/` 与 `src/renderer/src/pipeline/`，用于发现遗漏，不设全局阈值。界面层用覆盖矩阵逐项验收。理由：百分比门槛会诱导写无意义断言。

### 断言风格：结构断言而非整文件快照

导出 HTML 含哈希与时间戳，快照会持续产生噪音。沿用现有的正则与结构检查，按契约分组成用例。时间相关断言只验证排序与计数。

## Risks / Trade-offs

- [jsdom 与真实浏览器行为差异] → 所有依赖布局与计算样式的断言只在 Playwright 中写；jsdom 用例只断言 DOM 结构、属性与事件。
- [Playwright 对 Electron 的兼容随版本漂移] → 在 P0 先写一条启动冒烟用例验证链路，再批量迁移；版本随 Electron 39 固定。
- [迁移过程丢失断言] → 迁移清单按旧断言编号逐条登记新归属，断言数量作为完成判据之一。
- [测试时长增长拖慢反馈] → 单元/组件套件预算 10 秒内，集成套件预算 2 分钟内；超预算按领域拆分并行。
- [假 `window.api` 与 preload 漂移] → 契约用例如上，preload 接口变化时必须同步失败。
- [Node 版本不一致]（声明 24，实际 22.21）→ 测试工具链不依赖 `node:sqlite`（该部分在 Electron 内运行）；在文档中记录可用版本范围。

## Migration Plan

1. P0：安装依赖、三份配置、命令与 hooks；写纯逻辑用例。旧 harness 不动，双通路全绿。
2. P1：hooks 与组件用例；同样不改旧 harness。
3. P2：接入 Playwright，按领域迁移 `verify-main` / `verify-renderer`；每迁移一个领域，在迁移清单登记对照关系；全部对照完成后删除 `scripts/verify-*.ts`、`build-verify.mjs` 与 `out/verify-*` 产物。
4. 回滚：删除旧脚本前任何一步都可直接回退到旧 harness（P0–P2 期间旧通路始终保留）。删除动作单独一次提交，便于恢复。

## Open Questions

- 是否接入持续集成工作流（平台与是否启用矩阵）不影响测试体系本身，可在 P3 单独决定。
