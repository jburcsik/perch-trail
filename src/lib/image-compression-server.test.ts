/**
 * @jest-environment node
 */
// Real sharp against synthetic images, so these assert on actual resize and encode output.
import sharp from 'sharp'
import {
  compressImageServer,
  SERVER_COMPRESSION,
  COMPRESSED_IMAGE_EXT,
  COMPRESSED_IMAGE_CONTENT_TYPE,
  UPLOAD_FILE_OPTIONS,
} from './image-compression-server'

async function makeTestImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 120, g: 80, b: 40 } },
  })
    .png()
    .toBuffer()
}

describe('compressImageServer', () => {
  it('encodes the output as WebP', async () => {
    const input = await makeTestImage(2000, 1500)
    const output = await compressImageServer(input)
    const meta = await sharp(output).metadata()
    expect(meta.format).toBe('webp')
  })

  it('caps a landscape image at 1200px on its long edge (width), preserving aspect ratio', async () => {
    const input = await makeTestImage(2400, 1200)
    const output = await compressImageServer(input)
    const meta = await sharp(output).metadata()
    expect(meta.width).toBe(1200)
    expect(meta.height).toBe(600)
  })

  it('caps a portrait image at 1200px on its long edge (height), preserving aspect ratio', async () => {
    const input = await makeTestImage(900, 1800)
    const output = await compressImageServer(input)
    const meta = await sharp(output).metadata()
    expect(meta.height).toBe(1200)
    expect(meta.width).toBe(600)
  })

  it('does not upscale a source already smaller than 1200px on its long edge', async () => {
    const input = await makeTestImage(400, 300)
    const output = await compressImageServer(input)
    const meta = await sharp(output).metadata()
    expect(meta.width).toBe(400)
    expect(meta.height).toBe(300)
  })

  it('shrinks a large source well under the 5MB upload cap', async () => {
    const input = await makeTestImage(4000, 3000)
    const output = await compressImageServer(input)
    expect(output.length).toBeLessThan(1 * 1024 * 1024)
  })
})

describe('compression profile constants', () => {
  it('mirrors the client compressor: 1200px long edge, WebP', () => {
    expect(SERVER_COMPRESSION.longEdge).toBe(1200)
  })

  it('locks the WebP quality at 75', () => {
    expect(SERVER_COMPRESSION.quality).toBe(75)
  })

  it('exposes the ext/contentType every call site must store the compressed output under', () => {
    expect(COMPRESSED_IMAGE_EXT).toBe('webp')
    expect(COMPRESSED_IMAGE_CONTENT_TYPE).toBe('image/webp')
  })
})

describe('UPLOAD_FILE_OPTIONS', () => {
  it('pairs the one-year cacheControl with the WebP contentType', () => {
    expect(UPLOAD_FILE_OPTIONS).toEqual({
      cacheControl: '31536000',
      contentType: 'image/webp',
    })
  })
})
