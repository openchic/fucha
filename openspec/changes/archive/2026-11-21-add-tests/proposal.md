## Why

现有 231 条自动化断言只存在于两个「临时」脚本里：没有 `test` 脚本、没有 CI、pre-commit 只跑 lint-staged，回归只能靠人记得手动执行；同时 8 个 hook、13 个组件和 `normalize`/`rspress`/`parseCssRules` 等模块零断言。新增测试也没有标准落点，继续往自建 harness 里堆会变成负资产。

## What Changes

- 引入 Vitest 作为单元与组件测试运行器：纯逻辑跑 node 环境，hooks 与组件跑 jsdom + Testing Library。
- 引入 Playwright `_electron` 承载需要真实 Chromium、真实计算样式、真实 SQLite 与网络行为的集成测试；它复用项目自带的 Electron 二进制，不下载额外浏览器。
- 建立测试分层与目录约定：`tests/unit`、`tests/dom`、`tests/e2e` 与 `tests/fixtures`，并新增 `tsconfig.test.json` 纳入 typecheck 与 lint。
- 统一命令入口：`test`（秒级单元/组件）、`verify`（编译并运行 Electron 集成测试）、`check`（typecheck + lint + test + verify）。
- 把现有 `verify-main` / `verify-renderer` 断言按领域迁移到 Vitest 或 Playwright，Parity 达成后删除自建 runner；迁移期间保留双通路且都保持绿色。
- 补齐零覆盖模块与交互：`normalizeArticleDom`、`normalizeRspress*`、`parseCssRules`、`withoutThemeRootRules`、`previewStyleVariables`、全部 hooks、全部组件。
- 为主进程增加仅测试可用的 userData 路径覆盖缝，供 E2E 隔离数据库，生产行为不变。
- 新增 pre-commit 执行 `pnpm test`；集成测试不进提交钩子。
- **BREAKING**（仅开发流程）：`scripts/verify-main.ts`、`scripts/verify-renderer.ts`、`verify-runtime.ts`、`build-verify.mjs` 最终删除，手动 `npx electron out/verify-*.cjs` 的用法由 `pnpm verify` 取代。

## Capabilities

### New Capabilities
- `test-harness`: 测试分层、运行器与命令约定、环境隔离、覆盖范围要求、自动化接线与迁移完成标准。

### Modified Capabilities

无。现有 spec 描述产品行为，本变更不改变任何用户可见行为；主进程的 userData 覆盖缝仅测试可用，不影响正常运行路径。

## Impact

- 依赖：新增 `vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`@testing-library/jest-dom`、`@playwright/test`。
- 配置：新增 `vitest.config.ts`、`playwright.config.ts`、`tsconfig.test.json`；`package.json` 增加脚本；`.husky/pre-commit` 增加测试门禁。
- 代码：测试落点新增 `tests/`；`src/main/db.ts` 与 `src/main/index.ts` 增加测试路径覆盖；`scripts/verify-*` 迁移完成后删除。
- 文档：`README.md` 或 `AGENTS.md` 增加测试命令说明；`docs/` 不新增产品行为描述。
