import imageCompression from 'browser-image-compression'

// Client-side upload profile: every upload is normalised to WebP at 1200px
// before it reaches storage.
export const UPLOAD_COMPRESSION_OPTIONS = {
  maxWidthOrHeight: 1200,
  maxSizeMB: 0.15,
  fileType: 'image/webp',
  useWebWorker: true,
} as const

// Shared with image-compression-server.ts through the dependency-free leaf.
export { COMPRESSED_IMAGE_EXT, COMPRESSED_IMAGE_CONTENT_TYPE, UPLOAD_FILE_OPTIONS } from './image-upload-contract'

/** Compress a selected photo to the upload profile. Always re-encodes, so every
 * stored object is WebP. Throws on failure; callers treat that as an upload failure. */
export async function compressImageForUpload(file: File): Promise<File> {
  return imageCompression(file, UPLOAD_COMPRESSION_OPTIONS)
}
