import type { SupabaseClient } from '@supabase/supabase-js'

// QR id and edit-code reservation, shared by the admin new-house and quick-add
// flows (browser) and the recovery route (server), so it uses Web Crypto.

// Unambiguous alphabet: no 0, O, 1, I or L.
const CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'

// Largest multiple of CHARS.length below 256; bytes at or above it are
// rejected so every character is equally likely.
const UNBIASED_LIMIT = 256 - (256 % CHARS.length)

export function generateRandomCode(length: number): string {
  let code = ''
  const bytes = new Uint8Array(length * 2)
  while (code.length < length) {
    globalThis.crypto.getRandomValues(bytes)
    for (const b of bytes) {
      if (b < UNBIASED_LIMIT) code += CHARS[b % CHARS.length]
      if (code.length === length) break
    }
  }
  return code
}

/**
 * Insert a fresh qr_codes row, retrying up to 3 times on unique collisions.
 * Returns { id, editCode } or { err: 'exhausted' | 'insert_failed' }.
 */
export async function reserveQrCode(supabase: SupabaseClient) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const id = generateRandomCode(5)
    const editCode = generateRandomCode(4)
    const { error } = await supabase.from('qr_codes').insert({ id, edit_code: editCode })
    if (!error) return { id, editCode } as const
    if (error.code !== '23505') return { err: 'insert_failed' } as const
  }
  return { err: 'exhausted' } as const
}
