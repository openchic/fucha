## 1. 基础设施

- [x] 1.1 安装 `vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`@testing-library/jest-dom`；验证：`pnpm install` 成功，解析版本为 Vitest 5.1 / jsdom 31，与 Vite 7、React 19、Electron 39 兼容（`@playwright/test` 随 4.1 安装）
- [x] 1.2 新增 `vitest.config.ts`，用 projects 区分 `unit`（node）与 `dom`（jsdom），`include` 限定 `tests/unit` 与 `tests/dom`；验证：`pnpm test` 可启动并正确加载别名 `@shared` / `@renderer`
- [x] 1.3 新增 `tsconfig.test.json` 覆盖 `tests/**` 与源码，接入 `typecheck`；验证：`pnpm typecheck:test` 通过，且缺失声明或写错类型时能报错
- [x] 1.4 新增 `tests/setup/dom.ts`（jest-dom 匹配器）与 `tests/setup/fake-api.ts`（完整 `window.api` 假实现）；验证：`tests/unit/api-contract.test.ts` 比对 fake 键集合与 `AppApi`，preload 增删时编译失败
- [x] 1.5 `package.json` 增加 `test`、`test:watch`、`test:coverage`、`check`（`verify` 随 4.1 增加）；验证：`pnpm test`、`pnpm typecheck`、`pnpm lint` 三条命令全绿
- [x] 1.6 确认 `tests/**` 被 eslint 覆盖且规则与源码一致；验证：`pnpm lint` 对测试目录执行 import/order 与类型导入规则并已修正

## 2. 纯逻辑单元测试

- [x] 2.1 `tests/unit/theme-token.test.ts`：数值区间取 `min-1/min/max/max+1` 四个边界、非法枚举、缺字段、未知字段、标题装饰与代码边框样式合法值；验证：182 条用例通过
- [x] 2.2 `tests/unit/theme-css.test.ts`：`parseCssRules` 处理嵌套、注释、空规则与畸形输入；`validateThemeCss` 拦截白名单外属性、`expression()`、`url()`、`!important` 与非法 `display`；`scopeCss` 覆盖逗号分组；`resolveThemeVariables` 覆盖缺失变量与非递归替换；验证：91 条用例通过
- [x] 2.3 `tests/unit/profiles.test.ts`：子域、端口、大小写、非法 URL、后缀伪装域名的站点匹配与验证码关键词识别；验证：27 条用例通过，每个 profile 分支至少一条
- [x] 2.4 `tests/unit/zip.test.ts`：往返、deflate、空文件、UTF-8 文件名、截断、CRC 损坏、大小不符、加密、zip64、重复条目、路径穿越与解压炸弹；验证：27 条用例通过，畸形输入均显式抛错
- [x] 2.5 `tests/unit/window-size.test.ts`：工作区大于默认值、小于默认值、恰好相等与极小值；验证：8 条用例通过，结果始终不超过工作区
- [x] 2.6 `tests/unit/presets.test.ts`：三套内置主题均通过自身校验与 CSS 白名单、H1/H2 同款且 H3–H6 同款、两档必须不同、代码块背景显式；id/名称契约与 `src/shared/builtin-themes.ts` 一致；验证：29 条用例通过
- [x] 2.7 配置覆盖率只观察 `src/shared/` 与 `src/renderer/src/pipeline/`，不设门槛；验证：`pnpm test:coverage` 输出两目录报告，当前 shared 96%、theme-css 99%、profiles 100%

## 3. hooks 与组件测试

- [x] 3.1 `tests/setup/fake-api.ts` 提供类型化假 `window.api` 与 `installFakeApi` 注入，hooks 用 `renderHook`、组件用 `render`；验证：`tests/unit/api-contract.test.ts` 与全部 hooks 用例均通过注入的假实现运行
- [x] 3.2 `useArticlePreview`：快照优先、快照缺失/异常回退网络、抓取与提取错误分类、图片失败降级、刷新失败保留旧预览、旧请求晚到不覆盖新结果；验证：13 条用例通过
- [x] 3.3 `useArticleTheme` 与 `useThemeLibrary`：文章主题优先、偏好回退、未知主题回落、存储异常降级、自定义主题合并、切换写入文章与偏好；验证：14 条用例通过
- [x] 3.4 `useArticleHistory`、`useArticleExport`、`useConfirm`：加载与失败、刷新、复制成功与失败、提示清理、确认队列、Esc/遮罩取消、焦点回归与陷阱；验证：19 条用例通过，失败分支不产生未处理 rejection
- [x] 3.5 `useSidebarCollapsed` 与 `useIsFullscreen`：持久化初值、切换写入、⌘B/Ctrl+B 与输入框豁免、resize/媒体查询重算、卸载清理；验证：16 条用例通过
- [x] 3.6 `Dropdown` 与 `Tooltip`：展开/收起、方向键与 Home/End、Esc 焦点回归、外部点击、动作项、aria 关联与快捷键；验证：16 条用例通过，键盘路径均有断言
- [x] 3.7 `ConfirmDialog` 经 `ConfirmProvider` 覆盖焦点陷阱，`Segmented` 覆盖 aria 选中与切换，`NumberInput` 覆盖步进、键入提交、钳制、步长归整、Esc 放弃；验证：27 条用例通过
- [x] 3.8 `ThemePanel`：分组切换、标题层级隔离、重置脏标记、颜色选择器、对比度警告；验证：12 条用例通过（设置页主题列表 7 条与编辑器 8 条见 `ThemeList` / `ThemeEditor` 用例）
- [x] 3.9 `Home`、`New`、`Preview`、`Settings` 页面级：空态、历史列表、删除确认、路由跳转、URL 校验、加载/错误/预览态与主题切换、侧栏收起；验证：32 条用例通过

## 4. Playwright 集成测试与迁移

- [x] 4.1 安装 `@playwright/test`，新增 `playwright.config.ts` 与 `pnpm verify` 脚本，`testDir` 限定 `tests/e2e`，`verify` 先构建再启动 `out/main/index.js`；验证：`tests/e2e/smoke.spec.ts` 5 条通过，`pnpm verify` 先构建再启动
- [x] 4.2 复用主进程已有的 `--user-data-dir` 覆盖（`src/main/index.ts:10-15`），未设置时行为不变；验证：smoke 断言 `app.getPath('userData')` 等于测试临时目录
- [x] 4.3 建立迁移清单 `openspec/changes/add-tests/migration.md`，逐条登记 234 条旧断言与新用例归属；验证：当前 131 条已迁移、103 条待迁移，无未归属项
- [x] 4.4 迁移抓取与协议断言：抓取分类、图片下载与缓存复用、`app://` 取图与路径穿越、导出内联与占位、剪贴板；站点适配与验证码判定归入 `tests/unit/profiles.test.ts`；验证：main 相关断言已勾选，`tests/e2e/fetch.spec.ts` 16 条通过
- [x] 4.5 迁移主进程存储断言到 `tests/unit/store.test.ts`（schema 与索引、v6–v11 迁移、偏好、主题 CRUD 与引用保护、文章历史与级联删除），主题包到 `tests/unit/theme-package.test.ts`，损坏降级与抓取不阻断到 `tests/e2e/storage.spec.ts`；验证：37 + 15 + 1 条通过，缓存目录清理项转 4.12
- [x] 4.6 迁移渲染管线断言到 `tests/e2e/support/checks/renderer.ts` 的 sanitize/svg/extract/rspress/images 五组，由 `tests/e2e/pipeline.spec.ts` 聚合断言；验证：5 个 spec 通过，组内结果 11/18/17/5/4 条
- [x] 4.7 迁移主题与导出断言到 theme/export 两组，由 `tests/e2e/theme.spec.ts` 与 `tests/e2e/export.spec.ts` 聚合；验证：68 + 29 条结果通过，计算样式一致性断言包含在内
- [x] 补齐零覆盖模块用例：`normalizeArticleDom`（8 条）、`normalizeRspress*`（5 条）、`previewStyleVariables`（5 条）新增用例；`parseCssRules` / `withoutThemeRootRules` 已由 `tests/unit/theme-css.test.ts` 覆盖；验证：18 条新用例通过
- [x] 补齐导出契约回归：旧快照 SVG、3+ 列表格、代码逐行 `max-content`、列表 `p`、NBSP、引用 `section` 在 export 组内；5MB 图片占位在 `tests/e2e/fetch.spec.ts`；20px 平台留白在 theme 组；验证：对应断言全部通过
- [x] 4.12 迁移「删除文章不清缓存目录」断言到 `tests/e2e/history.spec.ts`；验证：删除后缓存文件仍存在
- [x] 4.10 删除 `scripts/verify-main.ts`、`scripts/verify-renderer.ts`、`scripts/verify-runtime.ts`、`scripts/verify-renderer.html`、`scripts/build-verify.mjs` 与 `out/verify-*`；验证：`pnpm verify` 全绿，迁移清单无未归属项，删除动作单独提交
- [x] 4.11 设置页主题编辑器（`Settings/Themes/Editor.tsx`）：名称校验、名称冲突提示、保存与取消路径；验证：保存与取消各至少 3 条用例

## 5. 收尾

- [x] 提交门禁：`.husky/pre-commit` 执行 lint-staged 后跑 `pnpm test`，不运行集成测试；验证：用例失败时提交被阻止
- [x] 5.2 更新 `README.md` 与 `AGENTS.md` 的测试命令与分层说明；验证：文档中的命令逐条可执行
- [x] 5.3 全量验证：`pnpm check` 通过（Vitest 585 条 / 3.7 秒），`pnpm verify` 通过（Playwright 30 条 / 14.2 秒），均在预算内
- [x] 5.4 决定不接入 CI：本机 `pnpm verify` 作为集成回归入口；Playwright 已具备无头运行条件，需要时再补工作流
- [x] 5.5 E2E 黄金路径：`tests/e2e/golden-path.spec.ts` 覆盖输入链接 → 抓取 → 预览 → 复制 → 历史入库；验证：单条用例通过 3–5 条（输入 URL → 抓取 → 预览 → 切主题 → 导出复制 → 历史记录）；验证：每条路径可独立重复运行
