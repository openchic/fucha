/** 正文基础排版；只引用 token 变量，主题 CSS 在此基础上写差异 */
export const BASE_CSS = `
p {
  margin: 0 0 var(--fucha-text-margin-bottom);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-font-size);
  line-height: var(--fucha-text-line-height);
  letter-spacing: var(--fucha-text-letter-spacing);
  word-break: break-word;
}

h1 {
  margin-top: var(--fucha-h1-margin-top);
  margin-bottom: var(--fucha-h1-margin-bottom);
  color: var(--fucha-h1-color);
  font-size: var(--fucha-h1-font-size);
  font-weight: var(--fucha-h1-font-weight);
  line-height: var(--fucha-h1-line-height);
  text-align: var(--fucha-h1-text-align);
}

h2 {
  margin-top: var(--fucha-h2-margin-top);
  margin-bottom: var(--fucha-h2-margin-bottom);
  color: var(--fucha-h2-color);
  font-size: var(--fucha-h2-font-size);
  font-weight: var(--fucha-h2-font-weight);
  line-height: var(--fucha-h2-line-height);
  text-align: var(--fucha-h2-text-align);
}

h3 {
  margin-top: var(--fucha-h3-margin-top);
  margin-bottom: var(--fucha-h3-margin-bottom);
  color: var(--fucha-h3-color);
  font-size: var(--fucha-h3-font-size);
  font-weight: var(--fucha-h3-font-weight);
  line-height: var(--fucha-h3-line-height);
  text-align: var(--fucha-h3-text-align);
}

h4 {
  margin-top: var(--fucha-h4-margin-top);
  margin-bottom: var(--fucha-h4-margin-bottom);
  color: var(--fucha-h4-color);
  font-size: var(--fucha-h4-font-size);
  font-weight: var(--fucha-h4-font-weight);
  line-height: var(--fucha-h4-line-height);
  text-align: var(--fucha-h4-text-align);
}

h5 {
  margin-top: var(--fucha-h5-margin-top);
  margin-bottom: var(--fucha-h5-margin-bottom);
  color: var(--fucha-h5-color);
  font-size: var(--fucha-h5-font-size);
  font-weight: var(--fucha-h5-font-weight);
  line-height: var(--fucha-h5-line-height);
  text-align: var(--fucha-h5-text-align);
}

h6 {
  margin-top: var(--fucha-h6-margin-top);
  margin-bottom: var(--fucha-h6-margin-bottom);
  color: var(--fucha-h6-color);
  font-size: var(--fucha-h6-font-size);
  font-weight: var(--fucha-h6-font-weight);
  line-height: var(--fucha-h6-line-height);
  text-align: var(--fucha-h6-text-align);
}

strong,
b {
  color: var(--fucha-text-color);
  font-weight: 700;
}

em,
i {
  color: var(--fucha-text-color);
  font-style: italic;
}

a {
  color: var(--fucha-text-color);
  text-decoration: underline;
}

ul {
  margin: 0 0 var(--fucha-text-margin-bottom);
  padding-left: 24px;
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-font-size);
  line-height: var(--fucha-text-line-height);
  list-style-type: disc;
}

ol {
  margin: 0 0 var(--fucha-text-margin-bottom);
  padding-left: 24px;
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-font-size);
  line-height: var(--fucha-text-line-height);
  list-style-type: decimal;
}

li {
  margin: 0 0 var(--fucha-text-list-gap);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-font-size);
  line-height: var(--fucha-text-line-height);
}

blockquote {
  margin: 0 0 var(--fucha-text-margin-bottom);
  padding: var(--fucha-quote-padding-block) var(--fucha-quote-padding-inline);
  color: var(--fucha-text-color);
  font-size: var(--fucha-quote-font-size);
  line-height: var(--fucha-text-line-height);
  background-color: var(--fucha-quote-background-color);
  border-left: 3px solid var(--fucha-primary);
  border-radius: var(--fucha-quote-border-radius);
}

blockquote p,
blockquote ul,
blockquote ol,
blockquote li {
  font-size: inherit;
  line-height: inherit;
}

blockquote > :last-child {
  margin-bottom: 0;
}

pre {
  margin: 0 0 var(--fucha-text-margin-bottom);
  padding: var(--fucha-code-padding-block) var(--fucha-code-padding-inline);
  color: var(--fucha-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fucha-code-font-size);
  line-height: var(--fucha-code-line-height);
  background-color: var(--fucha-code-background-color);
  border: 1px var(--fucha-code-border-style) var(--fucha-border-color);
  border-radius: var(--fucha-code-border-radius);
  overflow-x: auto;
  white-space: pre;
  word-break: normal;
}

pre code {
  padding: 0;
  color: inherit;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: inherit;
  line-height: inherit;
  background-color: transparent;
  border-radius: 0;
  white-space: inherit;
  word-break: normal;
}

figure.code-block {
  background-color: var(--fucha-code-background-color);
  border: 1px var(--fucha-code-border-style) var(--fucha-border-color);
  border-radius: var(--fucha-code-border-radius);
}

figure.code-block figcaption {
  margin: 0;
  padding: var(--fucha-code-padding-block) var(--fucha-code-padding-inline);
  color: var(--fucha-text-secondary-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fucha-text-secondary-font-size);
  line-height: 1.6;
  text-align: left;
  border-bottom: 1px solid var(--fucha-border-color);
}

figure.code-block pre {
  margin: 0;
  border: none;
  border-radius: 0 0 var(--fucha-code-border-radius) var(--fucha-code-border-radius);
}

code {
  padding: 2px 4px;
  color: var(--fucha-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.875em;
  background-color: var(--fucha-code-inline-background-color);
  border-radius: var(--fucha-code-inline-border-radius);
}

table {
  width: 100%;
  margin: 0 0 var(--fucha-text-margin-bottom);
  color: var(--fucha-text-color);
  font-size: 0.875em;
  line-height: 1.6;
  border-collapse: collapse;
}

figure.table-scroll {
  margin: 0 0 var(--fucha-text-margin-bottom);
  border: 1px solid var(--fucha-border-color);
  border-radius: var(--fucha-code-border-radius);
  overflow-x: auto;
}

figure.table-scroll table {
  margin: 0;
  width: 100%;
}

figure.table-scroll-wide table {
  min-width: 600px;
}

figure.table-scroll thead > tr:first-child > *,
figure.table-scroll tbody:first-child > tr:first-child > * {
  border-top: none;
}

figure.table-scroll tbody:last-child > tr:last-child > * {
  border-bottom: none;
}

figure.table-scroll tr > :first-child {
  border-left: none;
}

figure.table-scroll tr > :last-child {
  border-right: none;
}

th {
  padding: var(--fucha-table-padding-block) var(--fucha-table-padding-inline);
  color: var(--fucha-text-color);
  font-weight: 600;
  line-height: 1.6;
  text-align: left;
  vertical-align: top;
  background-color: var(--fucha-table-header-background-color);
  border: 1px solid var(--fucha-border-color);
}

td {
  padding: var(--fucha-table-padding-block) var(--fucha-table-padding-inline);
  color: var(--fucha-text-color);
  line-height: 1.6;
  text-align: left;
  vertical-align: top;
  border: 1px solid var(--fucha-border-color);
}

img {
  display: block;
  max-width: 100%;
  height: auto;
  margin: var(--fucha-image-margin-top) auto var(--fucha-image-margin-bottom);
  border-radius: var(--fucha-image-border-radius);
}

figure {
  margin: 0 0 var(--fucha-text-margin-bottom);
}

figcaption {
  margin: 4px 0 var(--fucha-image-margin-bottom);
  color: var(--fucha-text-secondary-color);
  font-size: var(--fucha-text-secondary-font-size);
  line-height: 1.6;
  text-align: center;
}

hr {
  height: 0;
  margin: var(--fucha-divider-margin-top) 0 var(--fucha-divider-margin-bottom);
  border: none;
  border-top: 1px var(--fucha-divider-border-top-style) var(--fucha-divider-border-top-color);
}

sup {
  font-size: var(--fucha-text-secondary-font-size);
  vertical-align: super;
}

sub {
  font-size: var(--fucha-text-secondary-font-size);
  vertical-align: sub;
}

svg {
  max-width: 100%;
  height: auto;
  vertical-align: middle;
}
`
