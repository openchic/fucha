# 浮槎（fú chá）

把一个网页链接变成一篇可直接发布的公众号文章。

<img src="build/macos-icon.svg" alt="浮槎图标" width="112" height="112">

## 怎么用

1. 粘贴网页文章链接，点击「生成预览」。
2. 选择排版主题，在浮槎里查看文章效果。
3. 点击复制，把排好版的文章粘贴到微信公众号编辑器。

可以使用内置主题，也可以在设置里自定义配色、字号和间距。处理过的文章会保存在本地，从侧栏就能重新打开。

## 本地开发

项目使用 Electron、React 和 TypeScript，通过 pnpm 管理依赖。

```bash
pnpm install
pnpm dev
```

渲染端支持热更新，主进程和 preload 的改动会自动重建并重启 Electron。

开发版与打包版分别使用独立的 [数据目录](docs/local-store.md#存储边界)。

## 测试

| 命令          | 检查内容                                                     |
| ------------- | ------------------------------------------------------------ |
| `pnpm test`   | 运行 `tests/unit` 和 `tests/dom` 下的单元与组件测试          |
| `pnpm check`  | 运行类型检查、Lint、单元与组件测试                           |
| `pnpm verify` | 构建应用，再用 Playwright 在真实 Electron 中运行 `tests/e2e` |

提交前会检查暂存区的代码，并运行 `pnpm test`。

## 打包

| 平台        | 命令                   |
| ----------- | ---------------------- |
| macOS       | `pnpm build:mac`       |
| macOS Debug | `pnpm build:mac:debug` |
| Windows     | `pnpm build:win`       |
| Linux       | `pnpm build:linux`     |

| 项目       | 正式版             | 开发版                               |
| ---------- | ------------------ | ------------------------------------ |
| macOS 应用 | `浮槎.app`         | `浮槎 Debug.app`（单独打包时）       |
| Bundle ID  | `com.ls63cc.fucha` | `com.ls63cc.fucha.dev`（单独打包时） |
| 数据目录   | `appData/fucha`    | `appData/fucha-dev`                  |
| 打包输出   | `dist/`            | `dist/debug/`                        |

`pnpm dev` 使用 Electron 开发运行时；独立 Debug 包通过构建模式固定开发身份，安装后也不会使用正式版数据目录。启动不迁移或删除已有数据。

## GitHub Release

[发布工作流](.github/workflows/release.yml) 参考 clean-mac，采用「手动准备 → 更新日志 PR 审核 → 合并后发布」，不由标签推送触发。

日志生成和草稿 PR 使用 [release-bits changelog action](https://github.com/openchic/release-bits)。项目只保留一个发布脚本 `scripts/release.mjs`，负责合并校验、临时版本、调用 electron-builder 完成 macOS 签名与公证、三端产物核验、版本提交与发布重试。Artifact 上传下载使用官方 `actions/upload-artifact` 和 `actions/download-artifact`，GitHub Release 使用 `gh` CLI。

1. 在 `main` 上点击运行 Release，选择 `major`、`minor` 或 `patch`。工作流读取 `package.json` 的基础版本，交给 release-bits 按最近发布标签生成中英文增量说明；首次发布使用完整历史，不发送源码或 diff。
2. action 自动创建 `changelogs/v<版本>` 草稿 PR，**只修改根目录 `changelogs.json`，不修改应用版本或创建标签**。重复点击幂等复用已有 PR、分支和草稿，不覆盖人工编辑或重复调用 Gemini；PR 关闭后自动删除发布分支。
3. 审核双语内容，将 PR 标为 ready 并合并。**合并即批准构建发布**。日志生成后如有应用代码变化，需关闭旧 PR 后重新准备；关闭时发布分支会自动删除。
4. 校验代码快照，运行 `pnpm check` 与真实 Electron 集成测试。仅在各构建工作目录临时设置候选版本，打包 macOS Universal DMG（Apple Silicon / Intel 通用）、Windows x64 NSIS 安装包、Linux x64 AppImage。macOS 使用 electron-builder 内置流程：临时钥匙串导入 Developer ID 证书，开启 hardened runtime 签名 App 和 DMG，再通过 `@electron/notarize` 提交 Apple 公证并装订 App 票据；脚本只写临时 API Key 文件，并用 `codesign`、`stapler validate`、`spctl` 验签。
5. 三端安装包全部成功并上传 Artifact 后，核验名称、大小与 SHA-256；将正式版本写入 `package.json`，将最终双语日志与产物信息写入 `changelogs.json`，**最后创建一笔发布提交，并原子推送提交和 `v<版本>` 标签**。构建、公证或上传 Artifact 失败都不会留下版本提交和标签；不覆盖期间新增的 `main` 提交。
6. 创建或更新 GitHub Release，上传三端安装包。Release changelog 只使用英文说明，并附三端直接下载链接；Actions 摘要也提供 Release 与下载链接。

Artifact 保留 30 天。上传 Release 失败时选择 **Re-run failed jobs**，复用成功构建的精确 Artifact ID；若最终提交和标签已存在，先核对来源与产物校验值，只补齐 Release，不重复提交或移动标签。不要重新构建后覆盖同版本的已记录安装包。

`changelogs.json` 与 clean-mac 一样是按版本倒序的数组，正式条目使用 `version`、`published_at`、`notes.zh-CN`、`notes.en`；为容纳三端，将单个 `asset` 扩展为 `assets.macos/windows/linux`，每项仍为 `name`、`size`、`sha256`。release-bits 草稿包含 `version`、`notes`、`source_sha`，递增模式另含 `version_type`，不写审核字段；合并 PR 即确认，正式发布时去除草稿字段，历史条目保持不变。

GitHub 仓库需允许 Actions 创建 PR，并允许发布机器人向 `main` 写入最终发布提交；若分支保护不允许，该步骤会停止，不会强制推送或绕过规则。准备任务使用 `contents: write`、`pull-requests: write`，发布任务仅使用 `contents: write`；其余任务只读。凭据沿用 clean-mac 的 Secret 命名，需在本仓库单独配置或授予组织 Secret 访问权：

| Secret                              | 内容                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `GEMINI_API_KEY`                    | Gemini API Key，供 release-bits action 生成增量中英文日志    |
| `DEVELOPER_ID_CERTIFICATE_P12`      | 含私钥的 Developer ID Application 证书（P12 的 Base64）      |
| `DEVELOPER_ID_CERTIFICATE_PASSWORD` | P12 导出密码                                                 |
| `APPLE_API_KEY`                     | App Store Connect API 的 `.p8` 私钥内容（不是路径或 Base64） |
| `APPLE_API_KEY_ID`                  | API Key ID                                                   |
| `APPLE_API_ISSUER_ID`               | API Issuer ID                                                |

浮槎不使用 clean-mac 的专属 provisioning profile、Xcode 签名变量或网站通知。证书由 electron-builder 导入临时钥匙串并清理，公证私钥在脚本结束时删除；凭据缺失、签名或公证失败均阻止发布。Windows 当前未签名；本地打包不会自动发布，Debug 包不进入 Release。

构建依赖中限定 `app-builder-lib@26.18.0` 使用 `@electron/get@5.1.0`，修正其调用新版下载缓存 API、却依赖旧版下载器造成的打包错误。

## 项目文档

- [设计与架构](docs/design.md)
- [排版主题](docs/theme-system.md)
- [本地存储](docs/local-store.md)
- [开发约定与 OpenSpec 变更流程](AGENTS.md)

## 许可证

[GNU GPL v3](LICENSE)
