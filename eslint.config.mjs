import config from '@vainjs/eslint-config/react'

/** @type {import("eslint").Linter.Config[]} */
export default [
  ...config,
  { ignores: ['out/**', 'dist/**'] },
  {
    rules: {
      // React 19 用自动运行时（tsconfig 里 jsx: react-jsx），JSX 不需要 React 在作用域内
      'react/react-in-jsx-scope': 'off',
    },
  },
]
