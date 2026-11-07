/**
 * @jest-environment node
 */
// Mocked so approveEditRequest can run without Supabase / Resend.
const serviceClientMock = jest.fn()
jest.mock('./supabase-admin', () => ({ serviceClient: () => serviceClientMock() }))
jest.mock('./email', () => ({ sendEmail: jest.fn(async () => ({ id: 'email-1' })) }))

import sharp from 'sharp'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  welcomeEmailHtml,
  welcomeEmailText,
  editApprovedEmailHtml,
  nextEditApprovalState,
  AUTO_APPROVE_THRESHOLD,
  approveEditRequest,
  moveRequestPhotoToHouseImages,
} from './approval'

const base = {
  name: 'Rosa Vance',
  profileUrl: 'https://perchtrail.example/h/ABC12',
  editUrl: 'https://perchtrail.example/h/ABC12?edit=ZZZZ',
  editCode: 'ZZZZ',
}

describe('welcomeEmailHtml', () => {
  it('keeps only the edit button: no public-page link, no access-code box', () => {
    const html = welcomeEmailHtml(base)
    expect(html).toContain(base.editUrl)
    expect(html).toContain('Edit your profile')
    expect(html).not.toContain('Your public page')
    expect(html).not.toContain('Your access code')
  })

  it('tells the steward the link is private and not to share it', () => {
    const html = welcomeEmailHtml(base).toLowerCase()
    expect(html).toContain('private edit link')
    expect(html).toContain('keep it to yourself')
  })

  it('frames saving as going live, without exposing review/approval mechanics', () => {
    const html = welcomeEmailHtml(base)
    expect(html).toContain('put it on the map')
    expect(html).not.toContain('approved')
  })

  it('escapes HTML in the recipient name to prevent injection', () => {
    const html = welcomeEmailHtml({ ...base, name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('greets the user by name', () => {
    const html = welcomeEmailHtml(base)
    expect(html).toContain('Hi Rosa Vance,')
  })

  it('uses the shared branded shell', () => {
    const html = welcomeEmailHtml(base)
    expect(html).toContain('email-logo-horizontal.png')
    expect(html).toContain('#fdf6ec')
    expect(html).toContain('#fde68a')
  })
})

describe('editApprovedEmailHtml', () => {
  it('contains the CTA hrefs and greeting text', () => {
    const html = editApprovedEmailHtml(base)
    expect(html).toContain('Hi Rosa Vance,')
    expect(html).toContain(base.profileUrl)
    expect(html).toContain(base.editUrl)
    expect(html).toContain('See your profile')
    expect(html).toContain('Your update is live')
  })

  it('escapes HTML in the recipient name', () => {
    const html = editApprovedEmailHtml({ ...base, name: '<script>alert(1)</script>' })
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('uses the shared branded shell', () => {
    const html = editApprovedEmailHtml(base)
    expect(html).toContain('email-logo-horizontal.png')
  })
})

describe('nextEditApprovalState', () => {
  it('increments the counter', () => {
    const r = nextEditApprovalState({ consecutiveApprovedEdits: 0, autoApproveEdits: false })
    expect(r.count).toBe(1)
  })

  it('does not flip auto-approve on below the threshold', () => {
    const r = nextEditApprovalState({ consecutiveApprovedEdits: 1, autoApproveEdits: false })
    expect(r.count).toBe(2)
    expect(r.autoApproveNowOn).toBe(false)
    expect(r.autoApproveAfter).toBe(false)
  })

  it(`flips auto-approve on when the counter first reaches ${AUTO_APPROVE_THRESHOLD}`, () => {
    const r = nextEditApprovalState({
      consecutiveApprovedEdits: AUTO_APPROVE_THRESHOLD - 1,
      autoApproveEdits: false,
    })
    expect(r.count).toBe(AUTO_APPROVE_THRESHOLD)
    expect(r.autoApproveNowOn).toBe(true)
    expect(r.autoApproveAfter).toBe(true)
  })

  it('does not "re-flip" if auto-approve was already on', () => {
    const r = nextEditApprovalState({ consecutiveApprovedEdits: 10, autoApproveEdits: true })
    expect(r.autoApproveNowOn).toBe(false)
    expect(r.autoApproveAfter).toBe(true)
  })

  it('keeps counter moving past the threshold without further flips', () => {
    const r = nextEditApprovalState({
      consecutiveApprovedEdits: AUTO_APPROVE_THRESHOLD + 2,
      autoApproveEdits: true,
    })
    expect(r.count).toBe(AUTO_APPROVE_THRESHOLD + 3)
    expect(r.autoApproveNowOn).toBe(false)
    expect(r.autoApproveAfter).toBe(true)
  })

  it(`the threshold is exactly ${AUTO_APPROVE_THRESHOLD}`, () => {
    expect(AUTO_APPROVE_THRESHOLD).toBe(3)
  })
})

describe('welcomeEmailText', () => {
  it('keeps the edit link but drops the public URL and access code', () => {
    const text = welcomeEmailText(base)
    expect(text).toContain(base.editUrl)
    expect(text).not.toContain('Your public page')
    expect(text).not.toContain('Access code:')
    expect(text.toLowerCase()).toContain('private edit link')
  })

  it('does not contain HTML tags', () => {
    const text = welcomeEmailText(base)
    expect(text).not.toMatch(/<[a-z]+/i)
  })
})

describe('approveEditRequest merges an edit into a live house', () => {
  function wire(house: Record<string, unknown>, capturedHouseUpdates: Array<Record<string, unknown>>) {
    const req = {
      id: 'req-1',
      status: 'pending',
      type: 'edit',
      target_qr_code_id: 'TEST1',
      payload: { bio: 'Filled in at last.' },
    }
    serviceClientMock.mockReturnValue({
      from: (table: string) => {
        if (table === 'profile_requests') {
          return {
            select: () => ({
              eq: (col: string) => {
                // origin lookup (new_profile) chains .eq().eq().maybeSingle()
                if (col === 'type') {
                  return { eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null }) }) }) }
                }
                return { single: async () => ({ data: req, error: null }) }
              },
            }),
            update: () => ({ eq: async () => ({ error: null }) }),
          }
        }
        if (table === 'houses') {
          return {
            select: () => ({ eq: () => ({ single: async () => ({ data: house, error: null }) }) }),
            update: (patch: Record<string, unknown>) => {
              capturedHouseUpdates.push(patch)
              return { eq: async () => ({ error: null }) }
            },
          }
        }
        throw new Error(`unexpected table ${table}`)
      },
    })
  }

  it('merges the payload and bumps the counter, never touching suspension', async () => {
    const updates: Array<Record<string, unknown>> = []
    wire({ consecutive_approved_edits: 0, auto_approve_edits: false, pending_edit_id: 'req-1' }, updates)
    const res = await approveEditRequest('req-1', 'admin-1')
    expect(res.ok).toBe(true)
    expect(updates[0].bio).toBe('Filled in at last.')
    expect(updates[0].consecutive_approved_edits).toBe(1)
    // Edits only target live houses, so no suspension state is written.
    expect('suspended_at' in updates[0]).toBe(false)
  })

  it('flips auto_approve_edits on once the trust threshold is reached', async () => {
    const updates: Array<Record<string, unknown>> = []
    wire({ consecutive_approved_edits: 2, auto_approve_edits: false, pending_edit_id: 'req-1' }, updates)
    const res = await approveEditRequest('req-1', 'admin-1')
    expect(res.ok).toBe(true)
    expect(updates[0].consecutive_approved_edits).toBe(3)
    expect(updates[0].auto_approve_edits).toBe(true)
  })
})

// A promoted street dot keeps a unique claim on its code after its house is deleted.
import { pickUnusedQrCode } from './approval'

function pickerClient(opts: {
  codes: Array<{ id: string; edit_code: string }>
  houses: string[]
  markerHeld: (string | null)[]
}): SupabaseClient {
  return {
    from: (table: string) => {
      if (table === 'qr_codes') {
        return { select: () => ({ is: () => ({ order: () => ({ limit: async () => ({ data: opts.codes, error: null }) }) }) }) }
      }
      if (table === 'houses') {
        return { select: async () => ({ data: opts.houses.map((id) => ({ qr_code_id: id })), error: null }) }
      }
      if (table === 'map_markers') {
        return { select: () => ({ not: async () => ({ data: opts.markerHeld.map((id) => ({ promoted_qr_code_id: id })), error: null }) }) }
      }
      throw new Error(`unexpected table ${table}`)
    },
  } as unknown as SupabaseClient
}

describe('pickUnusedQrCode', () => {
  const CODES = [
    { id: 'AAA11', edit_code: 'E1' },
    { id: 'BBB22', edit_code: 'E2' },
    { id: 'CCC33', edit_code: 'E3' },
  ]

  it('skips codes used by houses', async () => {
    const pick = await pickUnusedQrCode(pickerClient({ codes: CODES, houses: ['AAA11'], markerHeld: [] }))
    if ('err' in pick) throw new Error(`expected a code, got ${pick.err}`)
    expect(pick.code.id).toBe('BBB22')
  })

  it('skips codes held by promoted markers even when no house exists', async () => {
    // AAA11's house was hard-deleted but a marker still holds the code.
    const pick = await pickUnusedQrCode(pickerClient({ codes: CODES, houses: ['BBB22'], markerHeld: ['AAA11'] }))
    if ('err' in pick) throw new Error(`expected a code, got ${pick.err}`)
    expect(pick.code.id).toBe('CCC33')
  })

  it('reports exhaustion when houses + markers hold everything', async () => {
    const pick = await pickUnusedQrCode(pickerClient({ codes: CODES, houses: ['AAA11', 'BBB22'], markerHeld: ['CCC33'] }))
    expect('err' in pick && pick.err).toBe('no_unused_qr_codes')
  })
})

// Real sharp against a synthetic image, so these assert on actual compressed output.
describe('moveRequestPhotoToHouseImages (server-side compression)', () => {
  let sourcePng: Buffer

  beforeAll(async () => {
    sourcePng = await sharp({
      create: { width: 2000, height: 1500, channels: 3, background: { r: 90, g: 60, b: 30 } },
    })
      .png()
      .toBuffer()
  })

  type UploadMock = jest.Mock<Promise<unknown>, [string, Buffer, unknown]>
  function clientWithUpload(uploadMock: UploadMock): SupabaseClient {
    return {
      storage: {
        from: (bucket: string) => {
          if (bucket === 'request-photos') {
            return {
              download: async () => ({ data: new Blob([new Uint8Array(sourcePng)], { type: 'image/png' }), error: null }),
            }
          }
          if (bucket === 'house-images') {
            return {
              upload: uploadMock,
              getPublicUrl: (path: string) => ({ data: { publicUrl: `https://cdn.example.com/house-images/${path}` } }),
            }
          }
          throw new Error(`unexpected bucket ${bucket}`)
        },
      },
    } as unknown as SupabaseClient
  }

  it('compresses the downloaded photo, uploads it as WebP with a one-year cacheControl, and returns a .webp path', async () => {
    const uploadMock: UploadMock = jest.fn(async (_path: string, _body: Buffer, _options: unknown) => ({ data: { path: 'ignored' }, error: null }))
    const supabase = clientWithUpload(uploadMock)

    const result = await moveRequestPhotoToHouseImages(supabase, 'req-1/original.jpg', 'QR1')

    if ('err' in result) throw new Error(`expected success, got ${result.err}`)
    expect(result.storage_path).toBe('QR1/1.webp')
    expect(result.image_url).toContain('QR1/1.webp')

    expect(uploadMock).toHaveBeenCalledTimes(1)
    const [path, body, options] = uploadMock.mock.calls[0]
    expect(path).toBe('QR1/1.webp')
    expect(options).toEqual({ contentType: 'image/webp', cacheControl: '31536000', upsert: true })

    // The uploaded body is the compressed WebP output, not the original PNG bytes.
    expect(Buffer.isBuffer(body)).toBe(true)
    expect(body.length).toBeGreaterThan(0)
    expect(Buffer.compare(body, sourcePng)).not.toBe(0)
    const meta = await sharp(body).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(1200) // 2000x1500 long edge capped at 1200
  })

  it('builds the .webp path from the qr code regardless of the source photo extension', async () => {
    const uploadMock: UploadMock = jest.fn(async (_path: string, _body: Buffer, _options: unknown) => ({ data: { path: 'ignored' }, error: null }))
    const supabase = clientWithUpload(uploadMock)

    const result = await moveRequestPhotoToHouseImages(supabase, 'req-1/original.png', 'QR2')

    if ('err' in result) throw new Error(`expected success, got ${result.err}`)
    expect(result.storage_path).toBe('QR2/1.webp')
  })

  it('surfaces a download failure without attempting to upload', async () => {
    const uploadMock = jest.fn()
    const supabase = {
      storage: {
        from: (bucket: string) => {
          if (bucket === 'request-photos') {
            return { download: async () => ({ data: null, error: { message: 'not found' } }) }
          }
          if (bucket === 'house-images') return { upload: uploadMock }
          throw new Error(`unexpected bucket ${bucket}`)
        },
      },
    } as unknown as SupabaseClient

    const result = await moveRequestPhotoToHouseImages(supabase, 'req-1/gone.jpg', 'QR3')

    expect('err' in result && result.err).toContain('photo download failed')
    expect(uploadMock).not.toHaveBeenCalled()
  })

  it('surfaces an upload failure with its message', async () => {
    const uploadMock: UploadMock = jest.fn(async (_path: string, _body: Buffer, _options: unknown) => ({ data: null, error: { message: 'bucket full' } }))
    const supabase = clientWithUpload(uploadMock)

    const result = await moveRequestPhotoToHouseImages(supabase, 'req-1/original.jpg', 'QR4')

    expect('err' in result && result.err).toBe('photo upload failed: bucket full')
  })
})
