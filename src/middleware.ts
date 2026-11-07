import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'
import { isAllowedAdminEmail } from './lib/admin-allowlist'

const intlMiddleware = createIntlMiddleware(routing)

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname

  // The admin login page is served outside the locale routing.
  if (pathname === '/admin/login' || pathname.startsWith('/admin/login/')) {
    return NextResponse.next()
  }

  // Admin routes require a Supabase session whose email is on the allowlist.
  if (pathname.startsWith('/admin')) {
    const response = NextResponse.next()

    // Collected so refreshed cookies reach whichever response is returned.
    const pendingCookies: { name: string; value: string; options: object }[] = []

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://example.supabase.co',
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
        'placeholder-key',
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            for (const cookie of cookiesToSet) {
              pendingCookies.push(cookie)
              response.cookies.set(cookie.name, cookie.value, cookie.options)
            }
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    if (!user || !isAllowedAdminEmail(user.email)) {
      const loginUrl = new URL('/admin/login', request.url)
      const redirect = NextResponse.redirect(loginUrl)
      for (const { name, value, options } of pendingCookies) {
        redirect.cookies.set(name, value, options)
      }
      return redirect
    }

    return response
  }

  // Locale routing for every other path. The header carries the pathname to generateMetadata.
  const response = intlMiddleware(request)
  response.headers.set('x-pathname', pathname)
  return response
}

export const config = {
  matcher: ['/((?!api|_next|.*\\..*).*)'],
}
