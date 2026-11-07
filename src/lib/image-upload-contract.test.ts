import { COMPRESSED_IMAGE_EXT, COMPRESSED_IMAGE_CONTENT_TYPE, UPLOAD_FILE_OPTIONS } from './image-upload-contract'

// The shared contract for both compression engines; it imports nothing.
describe('image-upload-contract', () => {
  it('compressed uploads are always WebP', () => {
    expect(COMPRESSED_IMAGE_EXT).toBe('webp')
    expect(COMPRESSED_IMAGE_CONTENT_TYPE).toBe('image/webp')
  })

  it('pairs the one-year cacheControl with the WebP contentType', () => {
    expect(UPLOAD_FILE_OPTIONS).toEqual({
      cacheControl: '31536000',
      contentType: 'image/webp',
    })
  })

  it('contentType is COMPRESSED_IMAGE_CONTENT_TYPE, not a re-typed literal', () => {
    expect(UPLOAD_FILE_OPTIONS.contentType).toBe(COMPRESSED_IMAGE_CONTENT_TYPE)
  })
})
