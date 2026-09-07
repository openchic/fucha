<div align="center">
  <img src="build/macos-icon.svg" width="112" height="112" alt="Fucha">
  <h1>浮槎 (fú chá)</h1>
  <p>Turn a web link into a publish-ready WeChat article.</p>
  <p>English&nbsp;&nbsp;|&nbsp;&nbsp;<a href="README-zh_CN.md">简体中文</a></p>
</div>

Fucha turns a web article into a formatted article you can paste into the WeChat Official Account editor. Choose a theme, preview the typography, and copy the result. Extracted articles are stored locally for later.

## Usage

1. Paste an article URL and choose **Generate preview**.
2. Pick a typography theme and review the result.
3. Copy the article into the WeChat editor.

Theme colors, type sizes, and spacing can be customized in Settings.

## Development

```bash
pnpm install
pnpm dev
```

The renderer hot-reloads; main-process and preload changes restart Electron automatically.

## Testing

| Command          | What it does                                                 |
| ---------------- | ------------------------------------------------------------ |
| `pnpm typecheck` | Type checking for Node, renderer and tests                   |
| `pnpm lint`      | ESLint                                                       |
| `pnpm test`      | Unit and component tests                                     |
| `pnpm test:e2e`  | Builds the app, then runs integration tests in real Electron |

## Packaging

| Platform    | Command                |
| ----------- | ---------------------- |
| macOS       | `pnpm build:mac`       |
| macOS Debug | `pnpm build:mac:debug` |
| Windows     | `pnpm build:win`       |
| Linux       | `pnpm build:linux`     |

## Release

See the [release guide](docs/release.md) for the review-gated workflow, signing and notarization, required secrets, and retry behavior.

## Documentation

- [Design and architecture](docs/design.md)
- [Typography themes](docs/theme-system.md)
- [Local storage](docs/local-store.md)
- [Development conventions and agent rules](AGENTS.md)

## License

[GNU GPL v3](LICENSE)
