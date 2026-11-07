// Upload storage contract shared by the client and server compressors. This
// module imports nothing so either side can re-export it without pulling in the
// other's library. Uploads are always WebP; call sites build the storage path
// and content type from these values, never from the source file.
export const COMPRESSED_IMAGE_EXT = 'webp'
export const COMPRESSED_IMAGE_CONTENT_TYPE = 'image/webp'

// Storage paths never change under a given object, so a year-long cache is
// correct. Every upload call site passes this object (upload-call-site-guard.ts).
export const UPLOAD_FILE_OPTIONS = {
  cacheControl: '31536000',
  contentType: COMPRESSED_IMAGE_CONTENT_TYPE,
} as const
