import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import { isAllowedAdminEmail } from './admin-allowlist'

export { isAllowedAdminEmail }

export async function getAdminUser() {
  const cookieStore = await cookies()

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      'placeholder-key',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          // Write rotated auth tokens back. The cookie store is read-only inside
          // a Server Component, where the write throws and is ignored.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // read-only cookie context
          }
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null
  if (!isAllowedAdminEmail(user.email)) return null

  return user
}
