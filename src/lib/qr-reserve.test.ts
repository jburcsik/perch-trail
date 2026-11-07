import { generateRandomCode, reserveQrCode } from './qr-reserve'
import type { SupabaseClient } from '@supabase/supabase-js'

function clientWith(insertResults: Array<{ code?: string } | null>): { client: SupabaseClient; inserts: Array<Record<string, unknown>> } {
  const inserts: Array<Record<string, unknown>> = []
  let call = 0
  const client = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        if (table !== 'qr_codes') throw new Error(`unexpected table ${table}`)
        inserts.push(row)
        const r = insertResults[call++]
        return { error: r === null ? null : { code: r?.code ?? '500', message: 'x' } }
      },
    }),
  } as unknown as SupabaseClient
  return { client, inserts }
}

describe('generateRandomCode', () => {
  it('makes codes of the requested length from the unambiguous alphabet', () => {
    const code = generateRandomCode(5)
    expect(code).toHaveLength(5)
    expect(code).toMatch(/^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]+$/)
  })

  it('uses every character of the alphabet and does not repeat across draws', () => {
    const codes = new Set<string>()
    const seen = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const code = generateRandomCode(4)
      codes.add(code)
      for (const c of code) seen.add(c)
    }
    expect(seen.size).toBe(31)
    expect(codes.size).toBeGreaterThan(1990)
  })
})

describe('reserveQrCode', () => {
  it('inserts a 5-char id + 4-char edit code and returns them', async () => {
    const { client, inserts } = clientWith([null])
    const res = await reserveQrCode(client)
    expect('id' in res && res.id).toHaveLength(5)
    expect('id' in res && res.editCode).toHaveLength(4)
    expect(inserts).toHaveLength(1)
  })

  it('retries on unique-collision (23505) up to 3 attempts', async () => {
    const { client, inserts } = clientWith([{ code: '23505' }, { code: '23505' }, null])
    const res = await reserveQrCode(client)
    expect('id' in res).toBe(true)
    expect(inserts).toHaveLength(3)
  })

  it('gives up after 3 collisions', async () => {
    const { client } = clientWith([{ code: '23505' }, { code: '23505' }, { code: '23505' }])
    const res = await reserveQrCode(client)
    expect('err' in res && res.err).toBe('exhausted')
  })

  it('stops immediately on a non-collision error', async () => {
    const { client, inserts } = clientWith([{ code: '42501' }])
    const res = await reserveQrCode(client)
    expect('err' in res && res.err).toBe('insert_failed')
    expect(inserts).toHaveLength(1)
  })
})
