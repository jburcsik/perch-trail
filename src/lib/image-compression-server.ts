import sharp from 'sharp'

// Server-side upload compression with sharp, same WebP and 1200px profile as the
// client compressor. Used when approval moves a request photo into house-images.
export const SERVER_COMPRESSION = {
  longEdge: 1200,
  quality: 75,
} as const

// Shared with image-compression.ts through the dependency-free leaf.
export { COMPRESSED_IMAGE_EXT, COMPRESSED_IMAGE_CONTENT_TYPE, UPLOAD_FILE_OPTIONS } from './image-upload-contract'

/** Auto-rotate from EXIF, resize to the long edge without upscaling, encode WebP. */
export async function compressImageServer(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize(SERVER_COMPRESSION.longEdge, SERVER_COMPRESSION.longEdge, {
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: SERVER_COMPRESSION.quality })
    .toBuffer()
}
