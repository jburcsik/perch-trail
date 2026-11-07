#!/usr/bin/env node
/**
 * E2E fixture seed / reset: idempotent, service-role, current schema.
 *
 * The admin and steward Playwright specs anchor on one fixture house, TEST3
 * (slug orchard-lantern, edit code LIVE). supabase/seed.sql creates it along
 * with the rest of the demo trail; this script restores just that anchor to a
 * known-good state before a run, because the same local database also backs
 * manual testing and the row drifts (renamed, suspended, photos added).
 *
 * It only upserts the rows the suite needs and never touches anything else.
 * Run before the suite:
 *
 *     npm run test:seed
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL) plus a service-role key
 * (SUPABASE_SECRET_KEY or SUPABASE_SERVICE_ROLE_KEY), from the process
 * environment or .env.local.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(here, '..')

function loadEnvLocal() {
  const env = {}
  let raw = ''
  try {
    raw = readFileSync(resolve(root, '.env.local'), 'utf8')
  } catch {
    return env
  }
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const fileEnv = loadEnvLocal()
const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  fileEnv.NEXT_PUBLIC_SUPABASE_URL ||
  fileEnv.SUPABASE_URL
// Prefer a non-empty key from either name, across process env and .env.local.
const key = [
  process.env.SUPABASE_SECRET_KEY,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  fileEnv.SUPABASE_SECRET_KEY,
  fileEnv.SUPABASE_SERVICE_ROLE_KEY,
].find((v) => v && v.length > 20)

if (!url || !key) {
  console.error('[seed] Missing Supabase URL or service-role key (env or .env.local).')
  process.exit(1)
}
// The fixture edit codes are public, so this only ever runs against a local stack.
if (!/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?\/?$/.test(url) && process.env.SEED_ALLOW_REMOTE !== '1') {
  console.error(`[seed] Refusing to seed a non-local database (${url}). Set SEED_ALLOW_REMOTE=1 to override.`)
  process.exit(1)
}

const sb = createClient(url, key, { auth: { persistSession: false } })

/**
 * Canonical anchor fixture for the steward edit and image upload specs.
 * TEST3 = orchard-lantern: a stable LIVE house with edit code LIVE, on Orchard Row
 * in Maple Hollow. Must stay live, named, and under the 3-image limit.
 */
const TEST3 = {
  qr_code_id: 'TEST3',
  edit_code: 'LIVE',
  house: {
    slug: 'orchard-lantern',
    artist_name: 'Mara Linden',
    artist_bio:
      'Mara has lived on Orchard Row for eleven years and keeps two hives behind the bakery. She paints when the bees are asleep.',
    bio:
      'A lantern-yellow house with a copper roof, hung on the oldest apple tree on Orchard Row. Painted over three rainy Sundays, one coat per Sunday.',
    lat: 48.1562,
    lng: 11.5948,
    status: 'live',
    include_in_promo: true,
    tags: ['featured-artist'],
    archived_at: null,
    suspended_at: null,
    suspended_by: null,
    suspended_reason: null,
    pending_edit_id: null,
    bio_source_locale: 'en',
    artist_bio_source_locale: 'en',
  },
  // Photos 1 and 2 only, so the upload spec has a free slot.
  images: [
    { display_order: 1, image_url: '/fixtures/house-01.svg', storage_path: 'fixtures/house-01.svg' },
    { display_order: 2, image_url: '/fixtures/house-02.svg', storage_path: 'fixtures/house-02.svg' },
  ],
}

async function ensureQrCode(id, edit_code) {
  const { data: existing } = await sb.from('qr_codes').select('id, edit_code, retired_at').eq('id', id).maybeSingle()
  if (!existing) {
    const { error } = await sb.from('qr_codes').insert({ id, edit_code })
    if (error) throw new Error(`qr_codes insert ${id}: ${error.message}`)
    return `created (edit_code=${edit_code})`
  }
  if (existing.edit_code !== edit_code || existing.retired_at) {
    const { error } = await sb.from('qr_codes').update({ edit_code, retired_at: null, retired_reason: null }).eq('id', id)
    if (error) throw new Error(`qr_codes update ${id}: ${error.message}`)
    return `edit_code ${existing.edit_code} -> ${edit_code}`
  }
  return 'ok'
}

async function ensureHouse(qr_code_id, patch) {
  const { data: existing } = await sb.from('houses').select('qr_code_id').eq('qr_code_id', qr_code_id).maybeSingle()
  if (!existing) {
    const { error } = await sb
      .from('houses')
      .insert({ qr_code_id, claimed_at: new Date().toISOString(), updated_at: new Date().toISOString(), ...patch })
    if (error) throw new Error(`houses insert ${qr_code_id}: ${error.message}`)
    return 'created'
  }
  const { error } = await sb
    .from('houses')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('qr_code_id', qr_code_id)
  if (error) throw new Error(`houses update ${qr_code_id}: ${error.message}`)
  return 'restored'
}

async function ensureImages(qr_code_id, images) {
  // Reset to exactly the fixture set so the upload spec always finds a free slot.
  const { error: delErr } = await sb.from('house_images').delete().eq('qr_code_id', qr_code_id)
  if (delErr) throw new Error(`house_images delete ${qr_code_id}: ${delErr.message}`)
  const rows = images.map((img) => ({ qr_code_id, uploaded_by: 'admin', ...img }))
  const { error } = await sb.from('house_images').insert(rows)
  if (error) throw new Error(`house_images insert ${qr_code_id}: ${error.message}`)
  return `${rows.length} fixture image(s)`
}

async function main() {
  console.log('[seed] Restoring E2E anchor fixtures...')
  const qr = await ensureQrCode(TEST3.qr_code_id, TEST3.edit_code)
  console.log(`[seed]   qr_codes     ${TEST3.qr_code_id}: ${qr}`)
  const house = await ensureHouse(TEST3.qr_code_id, TEST3.house)
  console.log(`[seed]   houses       ${TEST3.qr_code_id} (${TEST3.house.slug}): ${house}`)
  const imgs = await ensureImages(TEST3.qr_code_id, TEST3.images)
  console.log(`[seed]   house_images ${TEST3.qr_code_id}: ${imgs}`)
  console.log('[seed] Done. Steward anchor TEST3/orchard-lantern is canonical and live.')
}

main().catch((e) => {
  console.error('[seed] FAILED:', e.message)
  process.exit(1)
})
