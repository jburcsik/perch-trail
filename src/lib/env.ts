import { z } from 'zod'
import { SITE_URL_DEFAULT } from '@/config/site'

// Server-only environment contract: which env vars exist, which are required,
// and what each is for.
const SERVER_ENV = {
  SUPABASE_SECRET_KEY: z.string().min(1).describe('Supabase service role key (server-only)'),
  TURNSTILE_SECRET_KEY: z.string().min(1).optional().describe('Cloudflare Turnstile secret (bot check)'),
  RESEND_API_KEY: z.string().min(1).optional().describe('Resend transactional email API key'),
  EMAIL_FROM: z.string().min(1).optional().describe('Default from address for outgoing email'),
  EMAIL_REPLY_TO: z.string().min(1).optional().describe('Default reply-to address for outgoing email'),
  SITE_URL: z.string().min(1).optional().describe('Canonical site URL used in email links'),
  ADMIN_EMAILS: z.string().min(1).describe('Comma-separated allowlist of admin emails'),
  ADMIN_NOTIFY_EMAIL: z.string().email().optional().describe('Address that receives instant notifications for new inquiries, perch requests, and edits'),
  CRON_SECRET: z.string().min(20).optional().describe('Bearer token Vercel Cron sends to authenticate scheduled digest requests'),
} as const

type ServerKey = keyof typeof SERVER_ENV

// The service-role key is accepted under either name.
function resolveEnv(key: ServerKey): string | undefined {
  if (key === 'SUPABASE_SECRET_KEY') {
    return process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY
  }
  return process.env[key]
}

// A field is required when the schema rejects `undefined` (i.e. not .optional()).
function isRequired(key: ServerKey): boolean {
  return !SERVER_ENV[key].safeParse(undefined).success
}

export function getServerEnv(key: ServerKey): string {
  const value = resolveEnv(key)
  if (!value) {
    if (isRequired(key)) {
      throw new Error(`Missing required env var ${key}: ${SERVER_ENV[key].description ?? ''}`)
    }
    return ''
  }
  return value
}

export function hasServerEnv(key: ServerKey): boolean {
  return Boolean(resolveEnv(key))
}

export function siteUrl(): string {
  return getServerEnv('SITE_URL') || SITE_URL_DEFAULT
}
