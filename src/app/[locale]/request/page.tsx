'use client'

import { useEffect } from 'react'
import { useRouter } from '@/i18n/navigation'

// /request redirects to the request card on the Get Involved page.
export default function RequestRedirect() {
  const router = useRouter()
  useEffect(() => {
    router.replace({ pathname: '/get-involved', query: { open: 'birdhouse' } })
  }, [router])
  return null
}
