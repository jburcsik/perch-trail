/**
 * @jest-environment node
 *
 * The failure half of the probe, in its own file because it has to poison the
 * sharp-backed module for the whole module registry. Mirrors the production
 * shape: the native library is missing, so loading the module throws.
 */
jest.mock('./image-compression-server', () => {
  throw new Error(
    'Could not load the "sharp" module using the linux-x64 runtime ERR_DLOPEN_FAILED: libvips-cpp.so.8.18.3: cannot open shared object file'
  )
})

import { probeImageCodec } from './image-codec-probe'

describe('probeImageCodec when the native library is missing', () => {
  it('reports not-ok with the loader error instead of throwing', async () => {
    const result = await probeImageCodec()
    expect(result.ok).toBe(false)
    expect(result.ok === false && result.detail).toContain('ERR_DLOPEN_FAILED')
  })
})
