import { deflateRawSync } from 'zlib'
import { describe, expect, it } from 'vitest'
import { createZip, readZip } from '../../src/main/zip'

const END_OF_CENTRAL = 0x06054b50

function endOffset(zip: Buffer): number {
  for (let index = zip.length - 22; index >= 0; index -= 1) {
    if (zip.readUInt32LE(index) === END_OF_CENTRAL) return index
  }
  throw new Error('测试夹具缺少 zip 结束记录')
}

function centralOffset(zip: Buffer): number {
  return zip.readUInt32LE(endOffset(zip) + 16)
}

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc ^= byte
    for (let bit = 0; bit < 8; bit += 1) {
      crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

/** 构造一个使用 deflate 压缩的 zip；用于覆盖 inflate 读取路径 */
function createDeflateZip(name: string, raw: Buffer, declaredSize = raw.length): Buffer {
  const nameBytes = Buffer.from(name, 'utf8')
  const data = deflateRawSync(raw)
  const checksum = crc32(raw)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0800, 6)
  local.writeUInt16LE(8, 8)
  local.writeUInt32LE(checksum, 14)
  local.writeUInt32LE(data.length, 18)
  local.writeUInt32LE(declaredSize, 22)
  local.writeUInt16LE(nameBytes.length, 26)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt32LE(checksum, 16)
  central.writeUInt32LE(data.length, 20)
  central.writeUInt32LE(declaredSize, 24)
  central.writeUInt16LE(nameBytes.length, 28)

  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL, 0)
  end.writeUInt16LE(1, 8)
  end.writeUInt16LE(1, 10)
  end.writeUInt32LE(central.length + nameBytes.length, 12)
  end.writeUInt32LE(local.length + nameBytes.length + data.length, 16)

  return Buffer.concat([local, nameBytes, data, central, nameBytes, end])
}

describe('createZip / readZip：往返', () => {
  it('读出写入的多个文件', () => {
    const zip = createZip([
      { name: 'theme.json', data: Buffer.from('{"a":1}') },
      { name: 'theme.css', data: Buffer.from('h1 { color: #000; }') },
    ])
    const entries = readZip(zip)
    expect(entries.size).toBe(2)
    expect(entries.get('theme.json')?.toString('utf8')).toBe('{"a":1}')
    expect(entries.get('theme.css')?.toString('utf8')).toBe('h1 { color: #000; }')
  })

  it('保留 UTF-8 文件名', () => {
    const zip = createZip([{ name: '主题/说明.txt', data: Buffer.from('你好') }])
    expect(readZip(zip).get('主题/说明.txt')?.toString('utf8')).toBe('你好')
  })

  it('支持空文件内容', () => {
    const zip = createZip([{ name: 'empty.txt', data: Buffer.alloc(0) }])
    expect(readZip(zip).get('empty.txt')?.length).toBe(0)
  })

  it('空条目列表可往返', () => {
    expect(readZip(createZip([])).size).toBe(0)
  })

  it('二进制内容逐字节一致', () => {
    const raw = Buffer.from(Array.from({ length: 256 }, (_, index) => index))
    const zip = createZip([{ name: 'bytes.bin', data: raw }])
    expect(readZip(zip).get('bytes.bin')).toEqual(raw)
  })

  it('较大的 stored 内容保持一致', () => {
    const raw = Buffer.alloc(100 * 1024, 0x5a)
    const zip = createZip([{ name: 'big.bin', data: raw }])
    expect(readZip(zip).get('big.bin')).toEqual(raw)
  })

  it('支持 deflate 压缩的条目', () => {
    const raw = Buffer.from('压缩内容'.repeat(100))
    expect(readZip(createDeflateZip('deflated.txt', raw)).get('deflated.txt')).toEqual(raw)
  })
})

describe('readZip：畸形输入', () => {
  it('拒绝过短的 buffer', () => {
    expect(() => readZip(Buffer.alloc(10))).toThrow('不是有效的 zip 文件')
  })

  it('拒绝非 zip 内容', () => {
    expect(() => readZip(Buffer.from('this is definitely not a zip file at all'))).toThrow(
      '不是有效的 zip 文件'
    )
  })

  it('拒绝被截断的文件', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    expect(() => readZip(zip.subarray(0, zip.length - 10))).toThrow('不是有效的 zip 文件')
  })

  it('拒绝重复文件名', () => {
    const zip = createZip([
      { name: 'dup.txt', data: Buffer.from('a') },
      { name: 'dup.txt', data: Buffer.from('b') },
    ])
    expect(() => readZip(zip)).toThrow('主题包存在重复文件')
  })

  it('拒绝中央目录偏移越界', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt32LE(0x7ffffff0, endOffset(zip) + 16)
    expect(() => readZip(zip)).toThrow('zip 中央目录损坏')
  })

  it('拒绝本地目录签名损坏', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt32LE(0, 0)
    expect(() => readZip(zip)).toThrow('zip 本地目录损坏')
  })

  it('拒绝加密条目', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt16LE(1, centralOffset(zip) + 8)
    expect(() => readZip(zip)).toThrow('主题包不能加密')
  })

  it('拒绝不支持的压缩方式', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt16LE(12, centralOffset(zip) + 10)
    expect(() => readZip(zip)).toThrow('主题包使用了不支持的压缩方式')
  })

  it('拒绝 zip64 大小标记', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt32LE(0xffffffff, centralOffset(zip) + 24)
    expect(() => readZip(zip)).toThrow('主题包不能使用 zip64')
  })

  it('拒绝超过 1MB 的条目', () => {
    const zip = createZip([{ name: 'huge.bin', data: Buffer.alloc(1024 * 1024 + 1) }])
    expect(() => readZip(zip)).toThrow('主题包文件过大')
  })

  it('拒绝解压后超出上限的压缩炸弹', () => {
    const raw = Buffer.alloc(1024 * 1024 + 1)
    const zip = createDeflateZip('bomb.bin', raw, 64)
    expect(() => readZip(zip)).toThrow()
  })

  it('拒绝 CRC 不匹配的内容', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    const localOffset = zip.readUInt32LE(centralOffset(zip) + 42)
    const localNameLength = zip.readUInt16LE(localOffset + 26)
    const dataStart = localOffset + 30 + localNameLength
    zip[dataStart] = 0xff
    expect(() => readZip(zip)).toThrow('主题包文件校验失败')
  })

  it('拒绝声明大小与实际不符的内容', () => {
    const zip = createZip([{ name: 'a.txt', data: Buffer.from('abc') }])
    zip.writeUInt32LE(4, centralOffset(zip) + 24)
    expect(() => readZip(zip)).toThrow('主题包文件大小不符')
  })
})

describe('readZip：路径安全', () => {
  it.each(['../evil.txt', 'a/../../evil.txt', '/etc/passwd', 'a\\b.txt', '', 'a//b.txt'])(
    '拒绝非法文件名 %j',
    (name) => {
      const zip = createZip([{ name, data: Buffer.from('x') }])
      expect(() => readZip(zip)).toThrow('主题包路径不合法')
    }
  )

  it('允许合法的子目录路径', () => {
    const zip = createZip([{ name: 'assets/theme.css', data: Buffer.from('x') }])
    expect(readZip(zip).has('assets/theme.css')).toBe(true)
  })
})
