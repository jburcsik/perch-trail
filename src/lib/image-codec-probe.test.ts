/**
 * @jest-environment node
 */
import { probeImageCodec } from './image-codec-probe'

describe('probeImageCodec', () => {
  it('is ok when sharp can actually decode and re-encode a real pixel', async () => {
    await expect(probeImageCodec()).resolves.toEqual({ ok: true })
  })
})
