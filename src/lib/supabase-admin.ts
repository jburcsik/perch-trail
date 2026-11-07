import { createClient, SupabaseClient } from '@supabase/supabase-js'

/** Resolve the Supabase service-role key under either of its two env var names. */
export function serviceRoleKey(): string {
  return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
}

export function hasServiceRoleKey(): boolean {
  return Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
}

/**
 * Server-only Supabase client using the service-role key (bypasses RLS).
 * Never import this into a client component.
 */
export function serviceClient(): SupabaseClient {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', serviceRoleKey())
}
