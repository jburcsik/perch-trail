import type { NextRequest } from 'next/server'

/** The caller's IP as the first hop of X-Forwarded-For, or 'unknown'. */
export function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown'
}
