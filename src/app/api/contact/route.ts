import { NextRequest, NextResponse } from 'next/server'
import { serviceClient } from '@/lib/supabase-admin'
import { notifyAdmin } from '@/lib/admin-notify'
import { siteUrl } from '@/lib/env'
import { checkRateLimit, RateLimitPresets } from '@/lib/rate-limit'
import { clientIp } from '@/lib/client-ip'
import { turnstileEnabled, verifyTurnstile } from '@/lib/turnstile'

const VALID_CATEGORIES = ['volunteer', 'donor', 'host', 'artist', 'birdhouse', 'perch'] as const
type Category = (typeof VALID_CATEGORIES)[number]

function cleanString(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

export async function POST(request: NextRequest) {
  const { allowed, retryAfterSeconds } = checkRateLimit(clientIp(request), 'requestForm', RateLimitPresets.requestForm)
  if (!allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      { status: 429, headers: { 'Retry-After': String(retryAfterSeconds) } }
    )
  }

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  // Honeypot: bots fill the hidden field. Answer 200 so the trap stays hidden.
  if (cleanString(body.website, 100)) {
    return NextResponse.json({ message: 'Inquiry submitted successfully' })
  }

  if (turnstileEnabled()) {
    const token = cleanString(body.turnstileToken, 4096)
    if (!token) return NextResponse.json({ error: 'Bot verification required' }, { status: 400 })
    if (!(await verifyTurnstile(token))) {
      return NextResponse.json({ error: 'Bot verification failed' }, { status: 403 })
    }
  }

  const name = cleanString(body.name, 120).replace(/[\r\n]+/g, ' ')
  const email = cleanString(body.email, 254).toLowerCase()
  const message = cleanString(body.message, 4000)
  const role = cleanString(body.role, 40)

  if (!name || !email) {
    return NextResponse.json({ error: 'Missing required fields: name, email' }, { status: 400 })
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
  }

  const category: Category | null = (VALID_CATEGORIES as readonly string[]).includes(role) ? (role as Category) : null

  const { error } = await serviceClient()
    .from('inquiries')
    .insert({ name, email, message, category })

  if (error) {
    console.error('Inquiry insert failed:', error.message)
    return NextResponse.json({ error: 'Failed to submit inquiry' }, { status: 500 })
  }

  // Fire-and-forget admin notification; never blocks the response.
  notifyAdmin({
    kind: 'inquiry',
    name,
    email,
    category,
    excerpt: message || undefined,
    adminUrl: `${siteUrl()}/admin?tab=inquiries`,
  })

  return NextResponse.json({ message: 'Inquiry submitted successfully' })
}

export async function GET() {
  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 })
}
