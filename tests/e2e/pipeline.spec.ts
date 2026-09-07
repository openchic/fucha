import { expectPassing, test } from './fixtures'

test.describe('渲染管线', () => {
  test('净化移除脚本、事件与危险协议', async ({ checks }) => {
    expectPassing(await checks.run(['sanitize']))
  })

  test('内嵌 SVG 保留矢量内容并清理危险资源', async ({ checks }) => {
    expectPassing(await checks.run(['svg']))
  })

  test('正文提取与站点适配', async ({ checks }) => {
    expectPassing(await checks.run(['extract']))
  })

  test('Rspress 代码块与提示容器归一', async ({ checks }) => {
    expectPassing(await checks.run(['rspress']))
  })

  test('预览图片路径映射与占位', async ({ checks }) => {
    expectPassing(await checks.run(['images']))
  })
})
