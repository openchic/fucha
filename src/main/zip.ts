import { inflateRawSync } from 'zlib'

const LOCAL_HEADER = 0x04034b50
const CENTRAL_HEADER = 0x02014b50
const END_OF_CENTRAL = 0x06054b50
const UTF8_FLAG = 0x0800
const MAX_ENTRY_BYTES = 1024 * 1024

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function crc32(data: Buffer): number {
  let crc = 0xffffffff
  for (const byte of data) {
    crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

export type ZipEntry = {
  name: string
  data: Buffer
}

/** 只写 stored（不压缩）的 zip，主题包只有两个文本文件，不值得引入依赖 */
export function createZip(entries: ZipEntry[]): Buffer {
  const localParts: Buffer[] = []
  const centralParts: Buffer[] = []
  let offset = 0

  for (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const data = entry.data
    const checksum = crc32(data)

    const local = Buffer.alloc(30)
    local.writeUInt32LE(LOCAL_HEADER, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(UTF8_FLAG, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(0, 10)
    local.writeUInt16LE(0x21, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(data.length, 18)
    local.writeUInt32LE(data.length, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const central = Buffer.alloc(46)
    central.writeUInt32LE(CENTRAL_HEADER, 0)
    central.writeUInt16LE(20, 4)
    central.writeUInt16LE(20, 6)
    central.writeUInt16LE(UTF8_FLAG, 8)
    central.writeUInt16LE(0, 10)
    central.writeUInt16LE(0, 12)
    central.writeUInt16LE(0x21, 14)
    central.writeUInt32LE(checksum, 16)
    central.writeUInt32LE(data.length, 20)
    central.writeUInt32LE(data.length, 24)
    central.writeUInt16LE(name.length, 28)
    central.writeUInt16LE(0, 30)
    central.writeUInt16LE(0, 32)
    central.writeUInt16LE(0, 34)
    central.writeUInt16LE(0, 36)
    central.writeUInt32LE(0, 38)
    central.writeUInt32LE(offset, 42)

    localParts.push(local, name, data)
    centralParts.push(central, name)
    offset += local.length + name.length + data.length
  }

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(END_OF_CENTRAL, 0)
  end.writeUInt16LE(0, 4)
  end.writeUInt16LE(0, 6)
  end.writeUInt16LE(entries.length, 8)
  end.writeUInt16LE(entries.length, 10)
  end.writeUInt32LE(centralSize, 12)
  end.writeUInt32LE(offset, 16)
  end.writeUInt16LE(0, 20)

  return Buffer.concat([...localParts, ...centralParts, end])
}

function findEnd(buffer: Buffer): number {
  const min = Math.max(0, buffer.length - 65557)
  for (let index = buffer.length - 22; index >= min; index -= 1) {
    if (buffer.readUInt32LE(index) !== END_OF_CENTRAL) continue
    const commentLength = buffer.readUInt16LE(index + 20)
    if (index + 22 + commentLength === buffer.length) return index
  }
  throw new Error('不是有效的 zip 文件')
}

function safeName(name: string): boolean {
  if (!name || name.startsWith('/') || name.includes('\\')) return false
  return name.split('/').every((part) => part !== '..' && part !== '')
}

/** 读取主题包；只接受 stored 或 deflate，拒绝加密、zip64 与路径穿越 */
export function readZip(buffer: Buffer): Map<string, Buffer> {
  if (buffer.length < 22) throw new Error('不是有效的 zip 文件')
  const end = findEnd(buffer)
  const count = buffer.readUInt16LE(end + 10)
  const centralSize = buffer.readUInt32LE(end + 12)
  const centralOffset = buffer.readUInt32LE(end + 16)
  if (centralOffset + centralSize > buffer.length) throw new Error('zip 中央目录损坏')

  const entries = new Map<string, Buffer>()
  let cursor = centralOffset

  for (let index = 0; index < count; index += 1) {
    if (cursor + 46 > buffer.length) throw new Error('zip 中央目录损坏')
    if (buffer.readUInt32LE(cursor) !== CENTRAL_HEADER) throw new Error('zip 中央目录损坏')
    const flags = buffer.readUInt16LE(cursor + 8)
    const method = buffer.readUInt16LE(cursor + 10)
    const checksum = buffer.readUInt32LE(cursor + 16)
    const compressedSize = buffer.readUInt32LE(cursor + 20)
    const uncompressedSize = buffer.readUInt32LE(cursor + 24)
    const nameLength = buffer.readUInt16LE(cursor + 28)
    const extraLength = buffer.readUInt16LE(cursor + 30)
    const commentLength = buffer.readUInt16LE(cursor + 32)
    const localOffset = buffer.readUInt32LE(cursor + 42)
    const name = buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString('utf8')

    if (flags & 0x1) throw new Error('主题包不能加密')
    if (method !== 0 && method !== 8) throw new Error('主题包使用了不支持的压缩方式')
    if (compressedSize === 0xffffffff || uncompressedSize === 0xffffffff) {
      throw new Error('主题包不能使用 zip64')
    }
    if (uncompressedSize > MAX_ENTRY_BYTES) throw new Error(`主题包文件过大：${name}`)
    if (!safeName(name)) throw new Error(`主题包路径不合法：${name}`)
    if (entries.has(name)) throw new Error(`主题包存在重复文件：${name}`)

    if (localOffset + 30 > buffer.length) throw new Error('zip 本地目录损坏')
    if (buffer.readUInt32LE(localOffset) !== LOCAL_HEADER) throw new Error('zip 本地目录损坏')
    const localNameLength = buffer.readUInt16LE(localOffset + 26)
    const localExtraLength = buffer.readUInt16LE(localOffset + 28)
    const dataStart = localOffset + 30 + localNameLength + localExtraLength
    if (dataStart + compressedSize > buffer.length) throw new Error('zip 文件数据损坏')
    const raw = buffer.subarray(dataStart, dataStart + compressedSize)
    const data =
      method === 0
        ? Buffer.from(raw)
        : inflateRawSync(raw, { maxOutputLength: MAX_ENTRY_BYTES + 1 })

    if (data.length !== uncompressedSize) throw new Error(`主题包文件大小不符：${name}`)
    if (crc32(data) !== checksum) throw new Error(`主题包文件校验失败：${name}`)
    entries.set(name, data)

    cursor += 46 + nameLength + extraLength + commentLength
  }

  return entries
}
