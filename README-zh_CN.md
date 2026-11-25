<div align="center">
  <img src="build/macos-icon.svg" width="112" height="112" alt="浮槎">
  <h1>浮槎（fú chá）</h1>
  <p>把一个网页链接变成一篇可直接发布的公众号文章。</p>
  <p>简体中文&nbsp;&nbsp;|&nbsp;&nbsp;<a href="README.md">English</a></p>
</div>

浮槎把一个网页链接变成一篇可直接粘贴到微信公众号编辑器的文章。选择主题、预览排版，再复制到公众号。处理过的文章会保存在本地，方便再次打开。

## 怎么用

1. 粘贴网页文章链接，点击「生成预览」。
2. 选择排版主题，查看文章效果。
3. 复制文章，粘贴到微信公众号编辑器。

配色、字号和间距可以在设置里调整，也可以选择跟随系统、浅色或深色外观。

## 本地开发

```bash
pnpm install
pnpm dev
```

渲染端支持热更新；主进程和 preload 的改动会自动重启 Electron。

## 测试

| 命令             | 检查内容                             |
| ---------------- | ------------------------------------ |
| `pnpm typecheck` | 类型检查（Node、渲染层与测试）       |
| `pnpm lint`      | ESLint                               |
| `pnpm test`      | 单元与组件测试                       |
| `pnpm test:e2e`  | 构建后在真实 Electron 中运行集成测试 |

## 打包

| 平台      | 命令                 |
| --------- | -------------------- |
| macOS     | `pnpm build:mac`     |
| macOS Dev | `pnpm build:mac:dev` |
| Windows   | `pnpm build:win`     |
| Linux     | `pnpm build:linux`   |

## 发版

发布流程、签名与公证、凭据配置和失败重试见[发布说明](docs/release.md)。

## 项目文档

- [设计与架构](docs/design.md)
- [排版主题](docs/theme-system.md)
- [本地存储](docs/local-store.md)

## 许可证

[GNU GPL v3](LICENSE)
