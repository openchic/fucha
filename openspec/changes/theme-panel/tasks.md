## 1. Token 契约与主题实现

- [x] 1.1 ThemeToken v1：h1–h6 顶层、可选标题色回退正文色、字段名对齐 CSS；校验与范围同步更新
- [x] 1.2 内置主题 `default` 与 `serif`：各自 token 默认值 + theme.css，加载时校验 token 与 CSS
- [x] 1.3 应用级 `base.css`：正文、引用、代码、表格、图片、分割线全部只引用 token 变量
- [x] 1.4 主题 CSS 契约与 fail-closed 校验：选择器、属性白名单、变量白名单、`!important`、外部资源、注入字符，错误带行号
- [x] 1.5 CSS 管线合流：预览作用域与变量、导出变量解析、装饰规则与 hljs 语法色顺序，预览/导出共用同一份 CSS

## 2. 存储与 IPC

- [x] 2.1 schema v4 主题字段：`themes` 增加 `css`、`token_version`、`source_theme_id`，迁移链随后由 local-store 续到 v5
- [x] 2.2 主题仓储：create / update / get / list / rename / delete；更新校验 token/CSS，同 id 拒绝、内置 id 保护、被文章引用拒绝删除、删除来源时置空
- [x] 2.3 主进程领域 IPC 与 preload：主题、偏好、文章快照、主题包导入导出
- [x] 2.4 文章快照与主题绑定：提取后 upsert、图片状态替换、切换主题只更新 `theme_id`
- [x] 2.5 `themes:update` IPC 与类型：`{ id, token, css }` 原地更新，返回新 `ThemeRecord`

## 3. 设置页与主题管理

- [x] 3.1 主题库合并：内置 + 自定义，自定义存储不可用时只用内置
- [x] 3.2 当前文章主题恢复：优先文章 `theme_id`，否则 `theme.active`，未知 id 回退 default
- [x] 3.3 主题配置控件：颜色/正文/标题/组件/代码分组，取色器、滑杆、六级标题与可选颜色
- [x] 3.4 设置页布局：`/settings` 兄弟布局、左侧设置导航与主题列表；内置只读、自定义编辑入口、新建/导入
- [x] 3.5 主题配置页：左侧固定示例文章预览、右侧 token 控件，草稿实时预览；示例不依赖当前文章
- [x] 3.6 自定义主题原地保存、另存为与完全自定义新建；内置只读只能另存为；引用文章同步换样
- [x] 3.7 未保存确认：离开配置页、主题管理或设置页时提示丢弃；保存错误可读
- [x] 3.8 主题下拉只保留名称与「主题管理」入口；历史栏右下角设置图标进入同一路由
- [x] 3.9 自定义主题管理：列表支持导入、导出、删除，配置页标题旁可改名并随保存提交；来源只记录在 `source_theme_id`，不在列表展示
- [x] 3.10 主题名称唯一：创建、另存为、导入与改名检查自定义主题及内置主题名称，重名拒绝并保留表单内容；验证：重名创建与改名均被拒，内置名称不可占用
- [x] 3.11 配置页排版：预览改为可选设备尺寸的手机视口（iPhone 18 Pro / iPhone 16 / iPhone SE / Pixel 7 / Galaxy S21，宽高随设备且受窗口限制，内部滚动），右侧检查器固定宽度、控件纵向排列、操作固定在底部；验证 1180/1440/1000 宽度、设备切换与 200ms 宽高过渡、实时预览、重名错误态
- [x] 3.12 代码语法主题：新增代码 tab，提供语法主题 Dropdown、代码内距与代码行高（GitHub / Atom One Light / Xcode），示例代码同步高亮；hljsTheme 白名单校验，历史未知值读取时归一到 github
- [x] 3.13 次级字号收窄：只控制图注与上下标，代码块、行内代码与表格改为正文 0.875 倍；滑杆注明用途，文档同步
- [x] 3.14 表头底色独立：新增 `table.headerBackgroundColor`，颜色 tab 与块底色分开配置；旧主题读取回退 `backgroundColor`，内置主题补齐默认值
- [x] 3.15 分割线色独立：新增 `divider.borderTopColor`，颜色 tab 与边框色分开配置；旧主题读取回退 `borderColor`，内置主题补齐默认值
- [x] 3.16 单字段重置与样张补齐：控件偏离保存值时显示重置图标并只回退该字段；样张新增行内代码与上下标，验证块底色与次级字号
- [x] 3.17 精确输入、对比度提示与说明关联：引入 @uiw/react-color 的 Sketch 作为颜色弹层（关闭 alpha），文字色与相关底色低于 4.5:1 时行内提示，说明通过 aria-describedby 关联

## 4. 主题包

- [x] 4.1 zip 读写：stored 写出，stored/deflate 读入，拒绝加密、zip64、路径穿越、超限、重复文件与 CRC 错误
- [x] 4.2 主题包生成与解析：`theme.json` + `theme.css`，id/name 与 token 一致，内置导出转普通主题
- [x] 4.3 导入 fail-closed 并写入自定义主题表；不自动切换当前文章

## 5. 验证与文档

- [x] 5.1 `verify-main`：schema v5、主题 create/update、名称唯一、引用保护、zip 与主题包往返、非法包拒绝
- [x] 5.2 `verify-renderer`：token 校验、CSS 契约与行号、预览/导出计算样式一致、导出无变量
- [x] 5.3 typecheck 与 lint 全绿
- [x] 5.4 真实 Electron 窗口验收：设置页新建/另存为、示例预览实时更新、自定义原地保存与文章同步、编辑页改名、引用删除保护、返回文章加载
- [x] 5.5 同步 `docs/theme-system.md`、`docs/local-store.md`、`docs/design.md`
- [ ] 5.6 公众号后台实机粘贴与新主题样张复核（并入 M1 清单的人工项）
