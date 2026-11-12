## 1. 基础设施

- [ ] 1.1 安装 `vitest`、`@vitest/coverage-v8`、`jsdom`、`@testing-library/react`、`@testing-library/dom`、`@testing-library/user-event`、`@testing-library/jest-dom`、`@playwright/test`；验证：`pnpm install` 成功，解析版本与 Vite 7、React 19、Electron 39 兼容，并在 `package.json` 记录固定范围
- [ ] 1.2 新增 `vitest.config.ts`，用 projects 区分 `unit`（node）与 `dom`（jsdom），`include` 限定 `tests/unit` 与 `tests/dom`；验证：`pnpm test` 可启动并正确加载别名 `@shared` / `@renderer`
- [ ] 1.3 新增 `tsconfig.test.json` 覆盖 `tests/**` 与 `src/**`，接入 `typecheck`；验证：`pnpm typecheck:test` 在空测试目录下通过，且故意写错类型时能报错
- [ ] 1.4 新增 `tests/setup/dom.ts`（jest-dom 匹配器）与 `tests/setup/fake-api.ts`（完整 `window.api` 假实现）；验证：一个契约用例比对 fake 键集合与 `src/preload/index.d.ts` 声明，preload 增删时该用例失败
- [ ] 1.5 `package.json` 增加 `test`、`test:watch`、`test:coverage`、`verify`、`check`；验证：`pnpm test`、`pnpm typecheck`、`pnpm lint` 三条命令全绿
- [ ] 1.6 确认 `tests/**` 被 eslint 覆盖且规则与源码一致；验证：在测试里刻意写入 `any` 或未使用变量时 `pnpm lint` 报错

## 2. 纯逻辑单元测试

- [ ] 2.1 `tests/unit/theme-token.test.ts`：数值区间取 `min-1/min/max/max+1` 四个边界、非法枚举、缺字段、未知字段、标题装饰与代码边框样式合法值；验证：`pnpm test` 通过，用例不少于 45 条
- [ ] 2.2 `tests/unit/theme-css.test.ts`：`parseCssRules` 处理嵌套、注释、空规则与畸形输入；`validateThemeCss` 拦截白名单外属性、`expression()`、`url(javascript:)`、`!important` 与非法 `display`；`scopeCss` 覆盖逗号分组与多层选择器；`resolveThemeVariables` 覆盖覆盖顺序、缺失与循环引用；验证：用例不少于 60 条且全部通过
- [ ] 2.3 `tests/unit/profiles.test.ts`：子域、端口、大小写、非法 URL 的站点匹配与验证码关键词识别；验证：每个 profile 分支至少一条用例
- [ ] 2.4 `tests/unit/zip.test.ts`：往返、空文件、UTF-8 文件名、截断、CRC 损坏、解压膨胀超限、重复条目；验证：畸形输入均被判为失败而不是抛出未捕获异常
- [ ] 2.5 `tests/unit/window-size.test.ts`：workArea 小于默认值、小于最小值、恰好相等与异常值；验证：返回尺寸始终不小于最小值且不超过 workArea
- [ ] 2.6 `tests/unit/presets.test.ts`：三套内置主题均通过自身校验、H1/H2 同款且 H3–H6 同款、两档必须不同、CSS 不含变量、代码块背景显式；内置主题 id/名称契约与 `src/shared/builtin-themes.ts` 一致；验证：任一预设改错字段时用例失败
- [ ] 2.7 配置覆盖率只观察 `src/shared/` 与 `src/renderer/src/pipeline/`，不设门槛；验证：`pnpm test:coverage` 输出两个目录的报告

## 3. hooks 与组件测试

- [ ] 3.1 建立 `renderHook` 与 `render` 辅助，注入 fake `window.api`，覆盖成功、失败与清理三种路径；验证：辅助自身有冒烟用例
- [ ] 3.2 `useArticlePreview`：抓取→下载→落库的顺序、连续两次抓取只认最后一次、失败分支回退；验证：竞态用例通过且不产生重复存储调用
- [ ] 3.3 `useArticleTheme` 与 `useThemeLibrary`：文章主题优先、偏好回退、乐观更新失败回滚、内置与自定义主题合并覆盖规则；验证：覆盖矩阵中每条规则一条用例
- [ ] 3.4 `useArticleHistory`、`useArticleExport`、`useConfirm`：加载与删除、复制成功与失败提示、确认队列与取消；验证：失败不产生未处理 rejection
- [ ] 3.5 `useSidebarCollapsed` 与 `useIsFullscreen`：持久化初值、切换写入、全屏监听注册与卸载；验证：卸载后监听器被移除
- [ ] 3.6 `Dropdown`、`Popover`、`Tooltip`：方向键与 Enter/Esc、点击外部关闭、延迟开关、焦点回归；验证：键盘路径全部有断言
- [ ] 3.7 `ConfirmDialog`、`Segmented`、`NumberInput`：焦点陷阱、roving tabindex 与 `aria-checked`、数值钳制与非法输入；验证：受控与非受控两种用法均覆盖
- [ ] 3.8 `ThemePanel` 与设置页主题编辑器：分组、重置、脏标记、保存校验与名称冲突提示；验证：保存与取消路径各至少三条用例
- [ ] 3.9 `Home`、`New`、`Preview`、`Settings` 页面级冒烟：空态、错误态与路由跳转；验证：每个页面至少一条渲染与一条交互用例

## 4. Playwright 集成测试与迁移

- [ ] 4.1 新增 `playwright.config.ts`，`testDir` 限定 `tests/e2e`，`verify` 先构建再启动 `out/main/index.js`；验证：启动冒烟用例确认窗口打开、`window.api` 存在、页面无 console error
- [ ] 4.2 主进程增加测试专用 userData 覆盖（`src/main/db.ts`、`src/main/index.ts`），未设置时行为不变；验证：隔离用例证明两次运行写不同数据库，且默认路径不受影响
- [ ] 4.3 建立迁移清单 `openspec/changes/add-tests/migration.md`，逐条登记旧断言编号与新用例归属；验证：清单覆盖 `verify-main` 与 `verify-renderer` 的全部断言，无未归属项
- [ ] 4.4 迁移抓取与协议断言：站点分类、验证码识别、图片下载、`app://` 路径穿越、网络失败矩阵；验证：迁移清单对应项全部勾选
- [ ] 4.5 迁移主进程存储断言：schema 逐版本迁移、幂等、损坏与版本过高降级、偏好与主题 CRUD、引用保护、级联删除、主题包往返、zip 安全、窗口尺寸；验证：迁移清单对应项全部勾选
- [ ] 4.6 迁移渲染管线断言：提取、净化、SVG 保留、DOM 归一、代码块标题适配；验证：迁移清单对应项全部勾选
- [ ] 4.7 迁移主题与导出断言：token 校验、CSS 契约、预览与导出计算样式一致、导出结构契约、语法高亮；验证：迁移清单对应项全部勾选
- [ ] 4.8 补齐零覆盖模块用例：`normalizeArticleDom`、`normalizeRspressCodeBlocks`、`normalizeRspressCallouts`、`parseCssRules`、`withoutThemeRootRules`、`previewStyleVariables`；验证：六个模块各有正常与异常用例
- [ ] 4.9 补齐导出契约回归：旧快照兼容、3+ 列表格规则、代码逐行 `max-content`、列表 `p`、NBSP、引用 `section`、5MB 图片占位、20px 平台留白；验证：每条契约一条用例并全部通过
- [ ] 4.10 删除 `scripts/verify-main.ts`、`scripts/verify-renderer.ts`、`scripts/verify-runtime.ts`、`scripts/verify-renderer.html`、`scripts/build-verify.mjs` 与 `out/verify-*`；验证：`pnpm verify` 全绿，迁移清单无未归属项，删除动作单独提交

## 5. 收尾

- [ ] 5.1 新增 `.husky/pre-push` 执行 `pnpm test`，不运行集成测试；验证：故意让一个用例失败后推送被阻止
- [ ] 5.2 更新 `README.md` 与 `AGENTS.md` 的测试命令与分层说明；验证：文档中的命令逐条可执行
- [ ] 5.3 全量验证：`pnpm check` 通过，单元与组件套件在 10 秒内完成，集成套件在 2 分钟内完成
- [ ] 5.4 可选：新增 CI 工作流，Linux 使用 `xvfb-run` 执行集成测试；验证：工作流在推送时运行并通过
- [ ] 5.5 可选：E2E 黄金路径 3–5 条（输入 URL → 抓取 → 预览 → 切主题 → 导出复制 → 历史记录）；验证：每条路径可独立重复运行
