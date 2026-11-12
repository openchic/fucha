# 浮槎（fú chá）

把一个链接，变成一篇可以直接发进公众号的文章。

Electron + React + TypeScript。需求与变更走 openspec 的 spec-driven 流程（见 AGENTS.md），设计与架构见 docs/design.md。

## Recommended IDE Setup

- [VSCode](https://code.visualstudio.com/) + [ESLint](https://marketplace.visualstudio.com/items?itemName=dbaeumer.vscode-eslint) + [Prettier](https://marketplace.visualstudio.com/items?itemName=esbenp.prettier-vscode)

## Project Setup

### Install

```bash
$ pnpm install
```

### Development

```bash
$ pnpm dev
```

渲染端改动走 HMR；解析与净化管线更新会自动重载并重新生成当前文章；主进程与 preload 改动自动重建并重启 Electron。

### Test

```bash
# 单元与组件测试（Vitest，秒级）
$ pnpm test

# 真实 Electron 中的集成测试（先构建应用，再跑 Playwright）
$ pnpm verify

# 全量：类型检查 + lint + 单元/组件测试
$ pnpm check
```

测试分层：`tests/unit`（纯逻辑）、`tests/dom`（jsdom + Testing Library）、`tests/e2e`（Playwright 启动真实 Electron）。提交前会自动执行 lint 与 `pnpm test`。

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
