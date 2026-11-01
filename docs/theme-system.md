# 主题系统方案

主题系统分两层：token 是可调接口，theme.css 是主题自己的样式实现。主题在数据层是不可变快照；简单调整只改前端草稿，保存后生成新主题；要改变 token 表达不了的排版，就导入完整主题包。

## 目标与非目标

**目标**

- A/B 主题各自拥有排版与装饰，但共用同一套 token 接口。
- 主题是不可变快照；调整 token 或 CSS 生成新主题，不原地修改历史主题。
- 用户可以在当前主题上调整字号、行高、间距、颜色、边框与圆角，预览实时生效。
- 自定义主题可以带自己的 CSS 和 token 默认值，按固定规则接入。
- 预览与导出共用同一套 token 和 theme.css，导出仍能落到微信可接受的内联样式。

**非目标**

- 不做应用内 CSS 编辑器。
- 不把每个元素的 margin/padding/border 都做进 token。
- 不改变文章内容的 HTML 结构；theme.css 只能作用于已有文章元素。
- 不引入外部字体、远程图片或 `@import`。

## 两层模型

```text
Theme A                          Theme B
  token 默认值 A                   token 默认值 B
  theme.css A                      theme.css B
        \                          /
         \                        /
          +---- 统一 token 接口 ---+
                     |
              用户简单调整 token
```

- token 是稳定的公共接口，约 20 个字段。
- theme.css 是主题实现，负责 token 表达不了的布局与逐元素盒模型。
- 文章只保存 `theme_id`，指向一个不可变主题快照；主题调整生成新主题，不修改旧快照，因此已有文章不会被静默改版。

## 主题快照与编辑会话

数据层保存不可变主题，前端用编辑草稿承担实时预览。

```text
data layer                         editor session
theme A: token + css        <----   draft A' = A + 用户改动
article.theme_id = A                 预览和复制使用 A'
                                     |
                             save -> 新建 theme B
                                     article.theme_id = B
                             cancel -> 丢弃 A'，文章仍用 A
```

规则：

- 编辑 token 只改渲染进程内存草稿，不写数据库。
- 预览和复制使用当前草稿，保证所见即所得；复制不会自动把草稿落库。
- 保存时创建新主题 id，复制源主题的 CSS 与 token，只把当前文章的 `theme_id` 切到新主题；其他文章不变。
- 主题列表只展示已落库的主题；草稿状态显示「未保存修改」，不提前混入列表。
- 未保存时切换主题或离开，提示丢弃；保存失败回退到原主题。
- 选中已有主题是可变的文章绑定：更新 `articles.theme_id`，不改主题快照。
- v1 不提供「批量应用到引用旧主题的文章」；后续可加显式动作，不允许静默替换。

## Token 契约

### 顶层结构

标题不再有 `heading` 包装，h1–h6 直接放在 Token 顶层。每个标题层级结构一致：

```ts
type HeadingLevel = {
  fontSize: number
  color?: string // 缺省回退 text.color
  textAlign: 'left' | 'center'
  decoration: 'none' | 'bar' | 'underline' | 'bracket'
  marginTop: number
  marginBottom: number
}
```

完整默认值：

```json
{
  "id": "default",
  "name": "清简",
  "builtin": true,
  "text": {
    "fontSize": 16,
    "secondaryFontSize": 14,
    "lineHeight": 1.75,
    "letterSpacing": 0.03,
    "marginBottom": 12,
    "color": "#333333",
    "secondaryColor": "#6b7280"
  },
  "primary": "#5e7b6f",
  "backgroundColor": "#f6f8fa",
  "borderColor": "#d0d7de",
  "borderRadius": 4,
  "h1": {
    "fontSize": 22,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h2": {
    "fontSize": 20,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h3": {
    "fontSize": 18,
    "textAlign": "left",
    "decoration": "bar",
    "marginTop": 24,
    "marginBottom": 12
  },
  "h4": {
    "fontSize": 16,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "h5": {
    "fontSize": 14,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "h6": {
    "fontSize": 14,
    "textAlign": "left",
    "decoration": "none",
    "marginTop": 20,
    "marginBottom": 8
  },
  "quote": {
    "padding": 12
  },
  "code": {
    "hljsTheme": "github",
    "lineHeight": 1.6,
    "padding": 16
  },
  "table": {
    "padding": 8
  },
  "image": {
    "marginTop": 16,
    "marginBottom": 16
  },
  "divider": {
    "borderTopStyle": "solid"
  }
}
```

### 字段与范围

| 字段                     | 默认                                 | 范围 / 值                        | 说明                                            |
| ------------------------ | ------------------------------------ | -------------------------------- | ----------------------------------------------- |
| `text.fontSize`          | 16px                                 | 14–18                            | 正文、列表、引用、h4–h6 的回落字号              |
| `text.secondaryFontSize` | 14px                                 | 12–16                            | 代码、表格、图注、上下标                        |
| `text.lineHeight`        | 1.75                                 | 1.5–2.2                          | 正文、列表、引用行高                            |
| `text.letterSpacing`     | 0.03em                               | 0–0.1                            | 正文基础字距                                    |
| `text.marginBottom`      | 12px                                 | 4–20                             | 段落、列表、引用、代码块、表格、figure 的段后距 |
| `text.color`             | #333333                              | 颜色                             | 正文主色，标题颜色缺省回退此值                  |
| `text.secondaryColor`    | #6b7280                              | 颜色                             | 弱化文字色，当前用于图注                        |
| `primary`                | #5e7b6f                              | 颜色                             | 标题装饰与引用左边条                            |
| `backgroundColor`        | #f6f8fa                              | 颜色                             | 引用、代码、行内代码、表头背景                  |
| `borderColor`            | #d0d7de                              | 颜色                             | 表格边框、分割线                                |
| `borderRadius`           | 4px                                  | 0–12                             | 引用、代码、图片圆角                            |
| `h1–h3.fontSize`         | 22 / 20 / 18                         | 18–26 / 16–22 / 16–20            | 标题字号                                        |
| `h4–h6.fontSize`         | 16 / 14 / 14                         | 12–20                            | 标题字号                                        |
| 各级 `textAlign`         | left                                 | left / center                    | 标题对齐                                        |
| 各级 `decoration`        | bar / bar / bar / none / none / none | none / bar / underline / bracket | 标题装饰                                        |
| 各级 `marginTop`         | 24 / 24 / 24 / 20 / 20 / 20          | 12–36                            | 标题上外边距                                    |
| 各级 `marginBottom`      | 12 / 12 / 12 / 8 / 8 / 8             | 8–24                             | 标题下外边距                                    |
| `quote.padding`          | 12px                                 | 8–20                             | 引用块内边距                                    |
| `code.hljsTheme`         | github                               | 主题名                           | highlight.js 语法色主题                         |
| `code.lineHeight`        | 1.6                                  | 1.4–2.0                          | 代码块行高                                      |
| `code.padding`           | 16px                                 | 8–20                             | 代码块内边距                                    |
| `table.padding`          | 8px                                  | 4–12                             | th / td 单元格内边距                            |
| `image.marginTop`        | 16px                                 | 8–24                             | 图片上外边距                                    |
| `image.marginBottom`     | 16px                                 | 8–24                             | 图片下外边距                                    |
| `divider.borderTopStyle` | solid                                | solid / dotted / none            | 分割线样式                                      |

标题颜色可选：`h1.color` 到 `h6.color` 未填时使用 `text.color`；填了只覆盖该层级。

### 标题装饰

| 值          | 生成样式                                                  |
| ----------- | --------------------------------------------------------- |
| `none`      | 无边框与额外内边距                                        |
| `bar`       | `border-left: 3px solid primary`，`padding-left: 12px`    |
| `underline` | `border-bottom: 2px solid primary`，`padding-bottom: 6px` |
| `bracket`   | 左右各 `2px solid primary`，`padding: 0 10px`             |

装饰只用真实边框，不用伪元素；微信会剥离伪元素。

### CSS 变量契约

主题 CSS 只能引用以下类型变量：

```text
--fucha-primary
--fucha-background-color
--fucha-border-color
--fucha-border-radius
--fucha-text-font-size
--fucha-text-secondary-font-size
--fucha-text-line-height
--fucha-text-letter-spacing
--fucha-text-margin-bottom
--fucha-text-color
--fucha-text-secondary-color
--fucha-h1-font-size ... --fucha-h6-font-size
--fucha-h1-color ... --fucha-h6-color
--fucha-h1-text-align ... --fucha-h6-text-align
--fucha-h1-margin-top ... --fucha-h6-margin-bottom
--fucha-quote-padding
--fucha-code-line-height
--fucha-code-padding
--fucha-table-padding
--fucha-image-margin-top
--fucha-image-margin-bottom
--fucha-divider-border-top-style
```

`hljsTheme` 不是 CSS 变量，由导出/预览直接选择语法主题。

## 样式归属与元素盒模型

应用维护一份 `base.css`，覆盖正文默认排版、引用、代码、表格、图片、分割线与微信安全属性，全部引用 token 变量。

主题的 `theme.css` 只写差异。加载顺序固定为 `base.css` → 装饰规则 → hljs 语法色 → `theme.css`，同选择器后写覆盖，主题永远有最终决定权。

逐元素 margin/padding/border 不进入 token，写在 theme.css：

| 范围                | 元素                                                                                                |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| 完整盒模型          | `p`、`h1`–`h6`、`ul`、`ol`、`li`、`blockquote`、`pre`、`table`、`figure`、`figcaption`、`img`、`hr` |
| 仅 padding + border | `th`、`td`（table-cell 的 margin 不生效）                                                           |
| 不开放盒模型        | `a`、`strong`、`em`、`b`、`i`、`u`、`s`、行内 `code`、`sup`、`sub`、`svg`                           |

`img` 左右外边距固定为 `auto`，theme.css 控制上下外边距。

## Theme CSS 契约

`theme.css` 只能使用元素、类与后代选择器：

```css
h2 { ... }
pre code { ... }
.hljs-keyword { ... }
```

禁止：

- 伪类与伪元素：`:hover`、`::before`、`:first-child`
- `@` 规则：`@media`、`@import`、`@font-face`、`@keyframes`、`@layer`
- `!important`
- 外部资源：`url(http...)`、远程字体与图片
- token 契约之外的 `var(--fucha-*)`
- 微信不支持的属性：`position`、`float`、`grid`、`flex` 布局等

导入时做 fail-closed 静态校验：任何一条不通过就拒绝整个主题包，并给出行号与原因，不做部分导入。

## 主题包与导入导出

主题包使用 zip：

```text
my-theme.fucha-theme
  theme.json
  theme.css
```

`theme.json`：

```json
{
  "id": "my-theme",
  "name": "我的主题",
  "version": "1.0.0",
  "tokenVersion": 1,
  "token": { "...": "完整 token 默认值" }
}
```

- 内置主题与自定义主题共用同一结构；当前内置「清简」（id `default`）与「书卷」（id `serif`），只读，升级时新增主题 id，旧 id 保留，避免历史文章换样。
- 自定义主题导入后，token 快照与 CSS 存入本地 SQLite；同一 id 或内置 id 已存在时拒绝导入，更新主题要使用新 id。
- 导出主题时把当前 token 和 CSS 重新打包成同样的 zip；内置主题导出时 token 的 `builtin` 置为 false，导入后成为普通自定义主题。不导出文章内容。
- 自定义主题只允许 CSS 与 token，不允许注入 HTML 或脚本。

## 预览与导出

```text
preview:
  token -> .article-body CSS 变量
  base.css + theme.css -> 注入预览

export:
  token -> 具体值变量表
  base.css + theme.css -> 解析 var()
  -> juice 内联
  -> 微信属性过滤
```

- 预览不解析 `var()`，直接用浏览器变量。
- 导出必须把所有 `var(--fucha-*)` 替换成具体值，再交给 juice；juice 不解析 CSS 变量。
- 预览和复制使用当前编辑草稿；保存只影响主题落库与文章 `theme_id`，不阻塞预览。
- 导出前仍执行正文归一：去重复首标题、清引用末段距、外链降级。
- 预览注入时统一加 `.article-body` 作用域；导出由 juice 直接作用于正文子树。

## 存储

文章仍只保存 `theme_id`，指向不可变主题快照。`themes` 表保存：

| 字段              | 用途                                                                |
| ----------------- | ------------------------------------------------------------------- |
| `id`              | 主题 id，全局唯一；不能与内置主题 id 冲突                           |
| `name`            | 显示名，可改名                                                      |
| `token`           | 该主题快照的 token                                                  |
| `css`             | theme.css 全文                                                      |
| `token_version`   | token 接口版本，当前为 1                                            |
| `source_theme_id` | 来源主题 id，可空；只作血缘记录，不参与渲染与导出                   |
| `sort`            | 自定义主题排序                                                      |
| `created_at`      | 快照创建时间                                                        |
| `updated_at`      | 元信息最近修改时间；`token` 与 `css` 不可变，改名与排序会更新此字段 |

`source_theme_id` 在从主题包直接导入、来源主题已被删除或保存时未指定来源时为空；来源可以是内置主题 id，因此不做外键，删除来源主题时由应用把引用置空。它只回答「这个主题从哪个主题调整而来」，预览、复制与导出都不读取该字段。

内置主题不写入 `themes`，继续由代码提供；内置主题升级使用新 id，旧 id 在代码中保留。自定义主题的 token 与 CSS 进库。保存调整生成新行，不更新旧行；只有名称、排序这类元信息允许更新，并同步 `updated_at`。删除主题前检查 `articles.theme_id` 引用：有引用时拒绝删除或要求先迁移文章，不静默回退。

## M2 面板边界

- 面板只编辑 token：颜色、字号、行高、间距、标题六级、引用/代码/表格/图片内距、圆角、分割线。
- 面板按颜色、正文、标题、组件分组；同一时间只展示一组，预览始终在面板下方可见。
- 面板不提供逐元素 margin/padding/border 编辑，也不提供 CSS 编辑器。
- 自定义主题通过导入/导出主题包完成；管理面板列出自定义主题，可应用、导出、重命名与删除，并展示来源。
- 编辑 token 为会话草稿，预览实时更新；保存时创建新主题并切换当前文章，不修改源主题。
- 未保存修改时切换主题或离开，提示丢弃；保存失败回退原主题。
- 复制使用当前可见草稿；主题落库与文章绑定仍需保存。
- 保存后主题列表立即出现新主题；其他引用源主题的文章保持不变。
- v1 不提供批量替换引用主题。

## 风险与待确认

- 主题列表会随保存增长；v1 用名称、来源主题和创建时间辨认，批量清理后置。
- 内置主题升级必须新增 id，旧 id 保留；否则历史文章会换样。
- 删除被文章引用的主题必须拒绝或先迁移文章，不做静默回退。
- 主题 CSS 的静态校验成本较高；v1 先限定最小选择器与属性集合，后续按需求扩展。
- 自定义主题 CSS 可能破坏微信兼容性；导入时 fail-closed，运行时不静默修正。
- `tokenVersion` 用于接口升级；旧主题包需要兼容迁移或拒绝导入。
- 主题是否允许新增 HTML 包装结构：当前方案不允许，只允许 CSS；如果以后要支持布局模板，需要单独设计 HTML 模板契约。
