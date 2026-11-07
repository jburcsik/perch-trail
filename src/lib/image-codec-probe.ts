// Liveness probe for the server image codec. sharp's native library can be
// missing from a deployed bundle with no build error, so the probe encodes one
// real pixel rather than only importing the module.

/** 1x1 transparent PNG: the smallest valid image sharp will decode. */
const ONE_PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
)

export type ImageCodecProbe = { ok: true } | { ok: false; detail: string }

export async function probeImageCodec(): Promise<ImageCodecProbe> {
  try {
    // Dynamic so a broken codec cannot take this module's importers down.
    const { compressImageServer } = await import('./image-compression-server')
    const out = await compressImageServer(ONE_PIXEL_PNG)
    if (!out || out.length === 0) return { ok: false, detail: 'sharp returned an empty buffer' }
    return { ok: true }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}
