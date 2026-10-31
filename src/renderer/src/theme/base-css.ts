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
  font-weight: 700;
  line-height: 1.4;
  text-align: var(--fucha-h1-text-align);
}

h2 {
  margin-top: var(--fucha-h2-margin-top);
  margin-bottom: var(--fucha-h2-margin-bottom);
  color: var(--fucha-h2-color);
  font-size: var(--fucha-h2-font-size);
  font-weight: 700;
  line-height: 1.4;
  text-align: var(--fucha-h2-text-align);
}

h3 {
  margin-top: var(--fucha-h3-margin-top);
  margin-bottom: var(--fucha-h3-margin-bottom);
  color: var(--fucha-h3-color);
  font-size: var(--fucha-h3-font-size);
  font-weight: 700;
  line-height: 1.4;
  text-align: var(--fucha-h3-text-align);
}

h4 {
  margin-top: var(--fucha-h4-margin-top);
  margin-bottom: var(--fucha-h4-margin-bottom);
  color: var(--fucha-h4-color);
  font-size: var(--fucha-h4-font-size);
  font-weight: 700;
  line-height: 1.5;
  text-align: var(--fucha-h4-text-align);
}

h5 {
  margin-top: var(--fucha-h5-margin-top);
  margin-bottom: var(--fucha-h5-margin-bottom);
  color: var(--fucha-h5-color);
  font-size: var(--fucha-h5-font-size);
  font-weight: 700;
  line-height: 1.5;
  text-align: var(--fucha-h5-text-align);
}

h6 {
  margin-top: var(--fucha-h6-margin-top);
  margin-bottom: var(--fucha-h6-margin-bottom);
  color: var(--fucha-h6-color);
  font-size: var(--fucha-h6-font-size);
  font-weight: 700;
  line-height: 1.5;
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
  padding: var(--fucha-quote-padding);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-font-size);
  line-height: var(--fucha-text-line-height);
  background-color: var(--fucha-background-color);
  border-left: 3px solid var(--fucha-primary);
  border-radius: var(--fucha-border-radius);
}

pre {
  margin: 0 0 var(--fucha-text-margin-bottom);
  padding: var(--fucha-code-padding);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-secondary-font-size);
  line-height: var(--fucha-code-line-height);
  background-color: var(--fucha-background-color);
  border-radius: var(--fucha-border-radius);
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

code {
  padding: 2px 4px;
  color: var(--fucha-text-color);
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: var(--fucha-text-secondary-font-size);
  background-color: var(--fucha-background-color);
  border-radius: var(--fucha-border-radius);
}

table {
  width: 100%;
  margin: 0 0 var(--fucha-text-margin-bottom);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-secondary-font-size);
  line-height: 1.6;
  border-collapse: collapse;
}

th {
  padding: var(--fucha-table-padding);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-secondary-font-size);
  font-weight: 600;
  line-height: 1.6;
  text-align: left;
  vertical-align: top;
  background-color: var(--fucha-background-color);
  border: 1px solid var(--fucha-border-color);
}

td {
  padding: var(--fucha-table-padding);
  color: var(--fucha-text-color);
  font-size: var(--fucha-text-secondary-font-size);
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
  border-radius: var(--fucha-border-radius);
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
  margin: 20px 0;
  border: none;
  border-top: 1px var(--fucha-divider-border-top-style) var(--fucha-border-color);
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
