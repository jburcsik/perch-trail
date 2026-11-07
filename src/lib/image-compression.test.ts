// browser-image-compression needs a Worker and canvas, so it is mocked; these
// assert the wrapper passes the upload profile and returns the compressed file.
const imageCompressionMock = jest.fn()
jest.mock('browser-image-compression', () => ({
  __esModule: true,
  default: (...args: unknown[]) => imageCompressionMock(...args),
}))

import {
  compressImageForUpload,
  UPLOAD_COMPRESSION_OPTIONS,
  COMPRESSED_IMAGE_EXT,
  COMPRESSED_IMAGE_CONTENT_TYPE,
  UPLOAD_FILE_OPTIONS,
} from './image-compression'

describe('UPLOAD_COMPRESSION_OPTIONS', () => {
  it('locks the upload profile: 1200px long edge, about 150kB, WebP', () => {
    expect(UPLOAD_COMPRESSION_OPTIONS).toEqual({
      maxWidthOrHeight: 1200,
      maxSizeMB: 0.15,
      fileType: 'image/webp',
      useWebWorker: true,
    })
  })
})

describe('compressImageForUpload', () => {
  beforeEach(() => {
    imageCompressionMock.mockReset()
  })

  it('runs the file through browser-image-compression with the upload profile options', async () => {
    const original = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const compressed = new File(['y'], 'photo.jpg', { type: 'image/webp' })
    imageCompressionMock.mockResolvedValue(compressed)

    await compressImageForUpload(original)

    expect(imageCompressionMock).toHaveBeenCalledWith(original, UPLOAD_COMPRESSION_OPTIONS)
  })

  it('returns the compressed result, not the original file', async () => {
    const original = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    const compressed = new File(['y'], 'photo.jpg', { type: 'image/webp' })
    imageCompressionMock.mockResolvedValue(compressed)

    const result = await compressImageForUpload(original)

    expect(result).toBe(compressed)
    expect(result).not.toBe(original)
  })

  it('propagates a compression failure rather than silently falling back to the original', async () => {
    const original = new File(['x'], 'photo.jpg', { type: 'image/jpeg' })
    imageCompressionMock.mockRejectedValue(new Error('canvas boom'))

    await expect(compressImageForUpload(original)).rejects.toThrow('canvas boom')
  })
})

describe('compressed-output constants', () => {
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

  it('contentType matches COMPRESSED_IMAGE_CONTENT_TYPE, not a re-typed literal', () => {
    expect(UPLOAD_FILE_OPTIONS.contentType).toBe(COMPRESSED_IMAGE_CONTENT_TYPE)
  })
})
