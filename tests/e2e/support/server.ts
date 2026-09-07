import type { AddressInfo } from 'node:net'
import { createServer } from 'node:http'

const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)
const SVG = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><rect width="10" height="10" fill="#a8b9f0"/></svg>'
)

export type FixtureServer = {
  url: string
  hits: Map<string, number>
  close: () => Promise<void>
}

/** 本地 HTTP 夹具：文章、重定向、错误、图片与超大图片 */
export async function startFixtureServer(): Promise<FixtureServer> {
  const hits = new Map<string, number>()
  const server = createServer((request, response) => {
    const { pathname } = new URL(request.url ?? '/', 'http://127.0.0.1')
    hits.set(pathname, (hits.get(pathname) ?? 0) + 1)

    const png = (body: Buffer) => {
      response.writeHead(200, { 'content-type': 'image/png' }).end(body)
    }

    switch (pathname) {
      case '/article':
        response
          .writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
          .end(
            '<!doctype html><html><head><title>示例文章</title></head><body><article><h1>示例文章</h1><p>' +
              '这是一段足够长的正文内容，用于让 Readability 判定为文章主体。'.repeat(12) +
              '</p></article></body></html>'
          )
        return
      case '/redirect':
        response.writeHead(302, { location: '/article' }).end()
        return
      case '/404':
        response.writeHead(404, { 'content-type': 'text/html' }).end('<h1>missing</h1>')
        return
      case '/data.json':
        response.writeHead(200, { 'content-type': 'application/json' }).end('{"a":1}')
        return
      case '/image.png':
        png(PNG)
        return
      case '/image-as.png':
        response.writeHead(200, { 'content-type': 'application/octet-stream' }).end(PNG)
        return
      case '/image.svg':
        response.writeHead(200, { 'content-type': 'image/svg+xml' }).end(SVG)
        return
      case '/huge.png':
        png(Buffer.alloc(6 * 1024 * 1024))
        return
      case '/broken.png':
        response.writeHead(500, { 'content-type': 'text/html' }).end('error')
        return
      default:
        response.writeHead(404, { 'content-type': 'text/html' }).end('not found')
    }
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    hits,
    close: () =>
      new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve()))
      ),
  }
}

export { PNG, SVG }
