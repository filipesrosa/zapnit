import { Jimp } from 'jimp'
import { createRequire } from 'module'
import type { QRCode } from 'jsqr'

const _require = createRequire(import.meta.url)
const jsQR = _require('jsqr') as (data: Uint8ClampedArray, width: number, height: number) => QRCode | null

export async function decodeQRCode(imageBuffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(imageBuffer)
  const { data, width, height } = image.bitmap
  const code = jsQR(new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength), width, height)
  return code?.data ?? null
}
