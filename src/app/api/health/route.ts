import { NextResponse } from 'next/server'
import { serviceClient, hasServiceRoleKey } from '@/lib/supabase-admin'
import { probeImageCodec } from '@/lib/image-codec-probe'
import { getAdminUser } from '@/lib/admin-auth'

// GET /api/health, for the admin dashboard banner.
// Confirms the server's Supabase key is a service-role key. The admin and
// steward API relies on the service role bypassing RLS; with a publishable
// key every admin write fails. `auth.admin.*` only works with a service-role
// key, so it detects a wrong key without depending on data.
export async function GET() {
  if (!(await getAdminUser())) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'no_service_role_key',
        detail: 'SUPABASE_SECRET_KEY (or SUPABASE_SERVICE_ROLE_KEY) is not set.',
      },
      { status: 503 }
    )
  }

  const { error } = await serviceClient().auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) {
    return NextResponse.json(
      {
        ok: false,
        error: 'not_service_role',
        detail:
          'The configured Supabase key is NOT a service-role key. Admin writes (delete, approve, edits) will fail. Set SUPABASE_SECRET_KEY to the service_role secret.',
      },
      { status: 503 }
    )
  }

  // sharp's native library can be missing from a deployed function bundle
  // with no build-time signal. Probing it here surfaces that on the admin
  // dashboard banner instead of on the first photo approval.
  const codec = await probeImageCodec()
  if (!codec.ok) {
    return NextResponse.json(
      {
        ok: false,
        error: 'image_codec_unavailable',
        detail:
          `The server image codec (sharp) will not load: ${codec.detail} ` +
          'Approving a profile request that has a photo will fail until this is fixed.',
      },
      { status: 503 }
    )
  }

  return NextResponse.json({ ok: true, serviceRole: true, imageCodec: true })
}
