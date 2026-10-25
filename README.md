# 浮槎（fú chá）

把一个链接，变成一篇可以直接发进公众号的文章。

Electron + React + TypeScript。需求与变更走 openspec 的 spec-driven 流程（见 AGENTS.md），设计与架构见 docs/DESIGN.md。

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

### Build

```bash
# For windows
$ pnpm build:win

# For macOS
$ pnpm build:mac

# For Linux
$ pnpm build:linux
```
