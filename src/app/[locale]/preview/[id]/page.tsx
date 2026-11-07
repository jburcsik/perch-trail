'use client'

import { useEffect } from 'react'
import { useTranslations } from 'next-intl'
import { useParams, useSearchParams, useRouter } from 'next/navigation'

// Redirects /preview/[id] to /h/[id]?edit=<code>, the editor with inline preview,
// so welcome-email links of either form open the same page.
export default function PreviewRedirectPage() {
  const t = useTranslations('PreviewRedirectPage')
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const id = params.id as string
  const editCode = searchParams.get('edit')

  useEffect(() => {
    const target = editCode ? `/h/${id}?edit=${editCode}` : `/h/${id}`
    router.replace(target)
  }, [id, editCode, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-gray-500">{t('openingEditor')}</p>
    </div>
  )
}
