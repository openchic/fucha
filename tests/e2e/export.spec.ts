import { expectPassing, test } from './fixtures'

test('导出结构、代码块契约与来源行', async ({ checks }) => {
  expectPassing(await checks.run(['export']))
})
