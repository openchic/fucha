## 1. Token 契约与主题实现

- [x] 1.1 ThemeToken v1：h1–h6 顶层、可选标题色回退正文色、字段名对齐 CSS；校验与范围同步更新
- [x] 1.2 内置主题 `default` 与 `serif`：各自 token 默认值 + theme.css，加载时校验 token 与 CSS
- [x] 1.3 应用级 `base.css`：正文、引用、代码、表格、图片、分割线全部只引用 token 变量
- [x] 1.4 主题 CSS 契约与 fail-closed 校验：选择器、属性白名单、变量白名单、`!important`、外部资源、注入字符，错误带行号
- [x] 1.5 CSS 管线合流：预览作用域与变量、导出变量解析、装饰规则与 hljs 语法色顺序，预览/导出共用同一份 CSS

## 2. 存储与 IPC

- [x] 2.1 schema v4：`themes` 增加 `css`、`token_version`、`source_theme_id`，v1–v4 顺序迁移
- [x] 2.2 主题仓储改为不可变快照：create / get / list / rename / delete；同 id 拒绝、内置 id 保护、被文章引用拒绝删除、删除来源时置空
- [x] 2.3 主进程领域 IPC 与 preload：主题、偏好、文章快照、主题包导入导出
- [x] 2.4 文章快照与主题绑定：提取后 upsert、图片状态替换、切换主题只更新 `theme_id`

## 3. 面板与草稿

- [x] 3.1 主题库合并：内置 + 自定义，自定义存储不可用时只用内置
- [x] 3.2 当前文章主题恢复：优先文章 `theme_id`，否则 `theme.active`，未知 id 回退 default
- [x] 3.3 编辑面板：颜色/正文/标题/组件分组，取色器、滑杆、六级标题与可选颜色，实时预览
- [x] 3.4 会话草稿：不落盘、复制使用草稿、另存为生成新主题并只切换当前文章
- [x] 3.5 未保存提示与失败回退：切换/取消/离开确认，保存错误可读
- [x] 3.6 自定义主题管理：应用、导出、重命名、删除，展示来源

## 4. 主题包

- [x] 4.1 zip 读写：stored 写出，stored/deflate 读入，拒绝加密、zip64、路径穿越、超限、重复文件与 CRC 错误
- [x] 4.2 主题包生成与解析：`theme.json` + `theme.css`，id/name 与 token 一致，内置导出转普通主题
- [x] 4.3 导入 fail-closed 并写入自定义主题表；不自动切换当前文章

## 5. 验证与文档

- [x] 5.1 `verify-main`：schema v4、主题快照、引用保护、zip 与主题包往返、非法包拒绝
- [x] 5.2 `verify-renderer`：token 校验、CSS 契约与行号、预览/导出计算样式一致、导出无变量
- [x] 5.3 typecheck 与 lint 全绿
- [x] 5.4 真实 Electron 窗口验收：主题切换、serif 渲染、草稿滑杆、另存为、重启恢复、重命名、引用删除保护、复制
- [x] 5.5 同步 `docs/theme-system.md`、`docs/local-store.md`、`docs/design.md`，删除方案文档中的迁移节
- [ ] 5.6 公众号后台实机粘贴与新主题样张复核（并入 M1 清单的人工项）
