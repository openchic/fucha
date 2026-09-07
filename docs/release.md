# 发布流程

发布由 [release.yml](../.github/workflows/release.yml) 驱动，采用「手动准备 → 更新日志 PR 审核 → 合并后发布」，不由标签推送触发。日志生成和草稿 PR 使用 [release-bits changelog action](https://github.com/openchic/release-bits)；项目只保留一个发布脚本 [release.mjs](../scripts/release.mjs)，负责合并校验、临时版本、macOS 签名公证、产物核验和发布重试。

## 流程

1. 在 `main` 上手动运行 Release，选择 `major`、`minor` 或 `patch`。工作流读取 `package.json` 的基础版本，交给 release-bits 按最近发布标签生成中英文增量说明；首次发布使用完整历史，不发送源码或 diff。
2. action 自动创建 `changelogs/v<版本>` 草稿 PR，**只修改根目录 `changelogs.json`，不修改应用版本或创建标签**。重复运行幂等复用已有 PR、分支和草稿，不覆盖人工编辑；PR 关闭后自动删除发布分支。
3. 审核双语内容，将 PR 标为 ready 并合并。**合并即批准构建发布**。日志生成后如有应用代码变化，需关闭旧 PR 后重新准备。
4. 校验代码快照；测试由可复用的 [test.yml](../.github/workflows/test.yml) 运行（`main` 的 push 也会自动触发同一工作流），依次执行类型检查、Lint、单元与组件测试和真实 Electron 集成测试。仅在各构建工作目录临时设置候选版本，打包 macOS Universal DMG、Windows x64 NSIS 安装包和 Linux x64 AppImage。macOS 使用 electron-builder 内置流程：临时钥匙串导入 Developer ID 证书，开启 hardened runtime 签名 App 和 DMG；App 由 `@electron/notarize` 公证并装订票据，DMG 由 `notarytool` 提交公证并装订；脚本只写临时 API Key 文件，并用 `codesign`、`stapler validate`、`spctl` 验签。
5. 三端安装包全部成功并上传 Artifact 后，核验名称、大小与 SHA-256；将正式版本写入 `package.json`，将最终双语日志与产物信息写入 `changelogs.json`，**最后创建一笔发布提交，并原子推送提交和 `v<版本>` 标签**。构建、公证或上传 Artifact 失败都不会留下版本提交和标签；不覆盖期间新增的 `main` 提交。
6. 创建或更新 GitHub Release，上传三端安装包。Release 正文只使用英文说明，并附三端直接下载链接；Actions 摘要也提供 Release 与下载链接。

## 失败重试

Artifact 保留 30 天。上传 Release 失败时选择 **Re-run failed jobs**，复用成功构建的精确 Artifact ID；若最终提交和标签已存在，先核对来源与产物校验值，只补齐 Release，不重复提交或移动标签。不要重新构建后覆盖同版本的已记录安装包。

本地打包不会自动发布，Debug 包不进入 Release，Windows 当前未签名。

## changelogs.json

按版本倒序的数组。正式条目使用 `version`、`published_at`、`notes.zh-CN`、`notes.en`；三端产物记录在 `assets.macos/windows/linux`，每项包含 `name`、`size`、`sha256`。release-bits 草稿包含 `version`、`notes`、`source_sha`，递增模式另含 `version_type`，不写审核字段；合并 PR 即确认，正式发布时去除草稿字段，历史条目保持不变。

## 仓库设置

- 允许 GitHub Actions 创建 Pull Request。
- Workflow 权限不能强制只读；准备任务使用 `contents: write`、`pull-requests: write`，发布任务使用 `contents: write`。
- 若启用了 `main` 分支保护或 `v*` 标签保护，允许 `github-actions[bot]` 推送发布提交、创建标签并删除 `changelogs/*` 分支。
- 若组织限制了可运行的 Actions，允许 `openchic/release-bits`。

## Secrets

| Secret                              | 内容                                                         |
| ----------------------------------- | ------------------------------------------------------------ |
| `LLM_API_KEY`                       | Gemini API Key，供 release-bits action 生成增量中英文日志    |
| `DEVELOPER_ID_CERTIFICATE_P12`      | 含私钥的 Developer ID Application 证书（P12 的 Base64）      |
| `DEVELOPER_ID_CERTIFICATE_PASSWORD` | P12 导出密码                                                 |
| `APPLE_API_KEY`                     | App Store Connect API 的 `.p8` 私钥内容（不是路径或 Base64） |
| `APPLE_API_KEY_ID`                  | API Key ID                                                   |
| `APPLE_API_ISSUER_ID`               | API Issuer ID                                                |

证书和 App Store Connect API Key 是团队级凭据，同一 Apple Developer 团队下可以跨 App 复用；Bundle ID、版本号和产物命名各自维护。

公开仓库可以直接使用组织级 Secrets。GitHub Free 的私有仓库不能读取组织级 Secrets，需要配置仓库级 Secrets 或升级组织计划。

浮槎不使用 clean-mac 的 provisioning profile、Xcode 签名变量或网站通知。证书由 electron-builder 导入临时钥匙串并清理，公证私钥在脚本结束时删除；凭据缺失、签名或公证失败均阻止发布。

## 依赖修正

构建依赖中限定 `app-builder-lib@26.18.0` 使用 `@electron/get@5.1.0`，修正其调用新版下载缓存 API、却依赖旧版下载器造成的打包错误。
