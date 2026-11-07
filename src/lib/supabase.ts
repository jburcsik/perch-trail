import { createBrowserClient } from '@supabase/ssr'

// The public key is accepted under either env var name.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co'
const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'placeholder-key'

export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey)
