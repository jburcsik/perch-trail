'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { useParams, useSearchParams } from 'next/navigation'
import { Link } from '@/i18n/navigation'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import { fetchWithRateLimitRetry } from '@/lib/fetch-with-retry'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })
import { BirdhousePhoto } from '@/components/BirdhousePhoto'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { TranslatedField } from '@/components/TranslatedField'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import toast, { Toaster } from 'react-hot-toast'
import { Plus, X } from 'lucide-react'
import { EditSection } from '@/components/EditSection'
import { houseImage, lightboxSlides, IMG_THUMB, IMG_HERO } from '@/lib/images'
import { compressImageForUpload, COMPRESSED_IMAGE_EXT, UPLOAD_FILE_OPTIONS } from '@/lib/image-compression'

interface House {
  qr_code_id: string
  slug: string | null
  status: 'invited' | 'review' | 'live' | 'suspended'
  artist_name: string | null
  artist_bio: string | null
  bio: string | null
  bio_source_locale: string | null
  artist_bio_source_locale: string | null
  lat: number | null
  lng: number | null
  include_in_promo: boolean
  tags: string[]
  claimed_at: string
  updated_at: string
}

interface HouseImage {
  id: number
  qr_code_id: string
  image_url: string
  storage_path: string
  display_order: number
}

function formatSlug(slug: string): string {
  return slug.split(/[-\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function EditPreview({
  snapshot,
  fallback,
  lat,
  lng,
  images,
  onBack,
}: {
  snapshot: { slug: string; artist_name: string; artist_bio: string; bio: string }
  fallback: House
  lat: number | null
  lng: number | null
  images: HouseImage[]
  onBack: () => void
}) {
  const t = useTranslations('HousePage')
  const slug = snapshot.slug || fallback.slug || ''
  const displayName = slug ? formatSlug(slug) : fallback.qr_code_id
  const [activeImage, setActiveImage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)

  return (
    <div data-testid="in-place-preview" className="mb-6 rounded-3xl overflow-hidden border-2 border-amber-300 shadow-xl bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      <div className="bg-gray-900 text-white text-center py-2.5 px-4 flex items-center justify-center gap-3 flex-wrap">
        <span className="inline-block bg-amber-500 text-gray-900 text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">{t('previewBadge')}</span>
        <span className="text-sm">{t('previewUnsavedNote')}</span>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onBack}
          data-testid="preview-back-button"
          className="bg-white text-gray-900 hover:bg-gray-100 rounded-full"
        >
          {t('backToEditing')}
        </Button>
      </div>

      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-8 text-center">
        <p className="text-xs uppercase tracking-widest opacity-75 mb-2">{t('birdhouse')}</p>
        <h1 className="text-4xl font-bold tracking-wide">{displayName}</h1>
      </div>

      <div className="px-6 py-8 space-y-6 max-w-2xl mx-auto">
        {images.length > 0 ? (
          <div>
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              className="block w-full rounded-2xl overflow-hidden shadow-lg cursor-zoom-in"
            >
              <BirdhousePhoto src={images[activeImage].image_url} alt={displayName} width={IMG_HERO} aspect="4 / 3" eager />
            </button>
            {images.length > 1 && (
              <div className="flex gap-2 mt-3 justify-center">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImage(i)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 ${
                      i === activeImage ? 'border-amber-500' : 'border-transparent opacity-60'
                    }`}
                  >
                    <img src={houseImage(img.image_url, IMG_THUMB)} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <PhotoLightbox
              slides={lightboxSlides(images)}
              index={activeImage}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              onIndexChange={setActiveImage}
            />
          </div>
        ) : (
          <BirdhousePhoto src={null} alt={t('birdhouseIllustrationAlt')} width={IMG_HERO} aspect="4 / 3" className="rounded-2xl shadow-lg" />
        )}

        {snapshot.artist_name && (
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-1">{t('artistLabel')}</p>
            <p className="text-2xl font-bold text-gray-900">{snapshot.artist_name}</p>
          </div>
        )}

        {snapshot.artist_bio && (
          <div className="bg-white/70 rounded-2xl px-5 py-4 border border-amber-100">
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">{t('aboutTheArtist')}</p>
            <p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">{snapshot.artist_bio}</p>
          </div>
        )}

        {snapshot.bio && (
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">{t('aboutLabel')}</p>
            <p className="text-lg leading-relaxed text-gray-700 whitespace-pre-wrap">{snapshot.bio}</p>
          </div>
        )}

        {lat != null && lng != null && (
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-2">{t('locationCoords')}</p>
            <p className="text-sm text-gray-600 font-mono">{lat.toFixed(5)}, {lng.toFixed(5)}</p>
          </div>
        )}

        <div className="text-center pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={onBack}
            className="border-2 border-amber-600 text-amber-700 hover:bg-amber-50 rounded-full px-6"
          >
            {t('backToEditing')}
          </Button>
        </div>
      </div>
    </div>
  )
}

function AdminEditButton({ id }: { id: string }) {
  const t = useTranslations('HousePage')
  return (
    <a
      href={`/admin/houses/${id}`}
      className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline whitespace-nowrap"
    >
      {t('adminEditLabel')}
    </a>
  )
}


export default function HousePage() {
  const t = useTranslations('HousePage')
  const locale = useLocale()
  const params = useParams()
  const searchParams = useSearchParams()
  const id = params.id as string
  const editCode = searchParams.get('edit')

  const [loading, setLoading] = useState(true)
  const [house, setHouse] = useState<House | null>(null)
  // View-only translation of bio for the current locale (edit forms always use
  // the canonical source). Public /h/[id] view is hit by slug-less houses.
  const [bioTx, setBioTx] = useState<string | null>(null)
  const [images, setImages] = useState<HouseImage[]>([])
  const [activeImage, setActiveImage] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [mode, setMode] = useState<'view' | 'claim' | 'edit' | 'retired'>('view')
  const [isSubmitting, setIsSubmitting] = useState(false)

  // For claim flow
  const [claimEditCode, setClaimEditCode] = useState('')
  const [showClaimForm, setShowClaimForm] = useState(false)

  // Edit status: pending + last denial note
  const [lastDenialNote, setLastDenialNote] = useState<string | null>(null)
  const [hasPendingEdit, setHasPendingEdit] = useState(false)

  // For edit flow
  const [isUploading, setIsUploading] = useState(false)
  const [editLat, setEditLat] = useState<number | null>(null)
  const [editLng, setEditLng] = useState<number | null>(null)
  const [editTags, setEditTags] = useState<string[]>([])
  // Controlled name field: drives the header title and the
  // publish-status banner live as the steward types. Still submitted via the
  // form's name="slug" so the save path is unchanged.
  const [slugValue, setSlugValue] = useState('')

  const [isAdmin, setIsAdmin] = useState(false)

  // In-place preview: when true, swap the form for a preview rendered
  // from the steward's current unsaved values. No DB write happens.
  const editFormRef = useRef<HTMLFormElement | null>(null)
  const [previewing, setPreviewing] = useState(false)
  // One-time celebration when the page first goes live (gated so repeat saves
  // never re-trigger it).
  const [showLiveModal, setShowLiveModal] = useState(false)
  const [previewSnapshot, setPreviewSnapshot] = useState<{
    slug: string
    artist_name: string
    artist_bio: string
    bio: string
  } | null>(null)

  const enterPreview = () => {
    const form = editFormRef.current
    if (!form) return
    const fd = new FormData(form)
    setPreviewSnapshot({
      slug: fd.get('slug')?.toString() ?? '',
      artist_name: fd.get('artist_name')?.toString() ?? '',
      artist_bio: fd.get('artist_bio')?.toString() ?? '',
      bio: fd.get('bio')?.toString() ?? '',
    })
    setPreviewing(true)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const exitPreview = () => {
    setPreviewing(false)
  }

  useEffect(() => {
    fetchHouse()
    fetch('/api/admin/me').then(r => { if (r.ok) setIsAdmin(true) }).catch(() => {})
  }, [id])

  const fetchHouse = async () => {
    try {
      const { data: houseData, error: houseError } = await supabase
        .from('houses')
        .select('*')
        .eq('qr_code_id', id)
        .single()

      if (houseError && houseError.code !== 'PGRST116') {
        console.error('Fetch error:', houseError)
        setLoading(false)
        return
      }

      // A steward arriving with an edit code is verified server-side, which also
      // returns the house via the service role. This is the authoritative load for
      // editing: pre-publish houses (status invited/review) are hidden from the
      // anon read above by RLS, so we rely on verify to fetch them.
      if (editCode) {
        const res = await fetchWithRateLimitRetry('/api/house/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ qr_code_id: id, edit_code: editCode }),
        })

        if (res.ok) {
          const verified = await res.json().catch(() => ({}))
          const h = verified.house ?? houseData
          if (h) {
            setHouse(h)
            setSlugValue(h.slug ?? '')
            setEditLat(h.lat)
            setEditLng(h.lng)
            setEditTags(h.tags ?? [])
            setImages(verified.images ?? [])
            setMode('edit')
            // Load pending/denial status for the banner (best-effort, non-blocking)
            fetch('/api/house/edit-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ qr_code_id: id, edit_code: editCode }),
            }).then(r => r.json()).then(d => {
              setHasPendingEdit(Boolean(d.pendingEditId))
              setLastDenialNote(d.lastDenial?.note ?? null)
            }).catch(() => {})
            setLoading(false)
            return
          }
          // QR valid but unclaimed: fall through to the claim form below.
        } else if (res.status === 429) {
          toast.error(t('loadFailed'))
        } else {
          toast.error(t('invalidEditCode'))
        }
      }

      if (!houseData) {
        // No public house and no valid edit code: show claim (or retired) form.
        const { data: qrData } = await supabase
          .from('qr_codes')
          .select('retired_at')
          .eq('id', id)
          .single()

        setMode(qrData?.retired_at ? 'retired' : 'claim')
        setLoading(false)
        return
      }

      // Public view of a live house.
      setHouse(houseData)
      setEditLat(houseData.lat)
      setEditLng(houseData.lng)
      setEditTags(houseData.tags ?? [])

      // Bio translation for the current locale (view rendering only). en is
      // fetched too: a non-English-source bio is translated into English.
      if (houseData.bio) {
        const { data: txRow } = await supabase
          .from('house_translations')
          .select('translated_text')
          .eq('qr_code_id', houseData.qr_code_id)
          .eq('locale', locale)
          .eq('field', 'bio')
          .maybeSingle()
        setBioTx(txRow?.translated_text ?? null)
      }

      const { data: imageData } = await supabase
        .from('house_images')
        .select('*')
        .eq('qr_code_id', id)
        .order('display_order', { ascending: true })

      if (imageData) setImages(imageData)
      setMode('view')
      setLoading(false)
    } catch (error) {
      console.error('Error:', error)
      setLoading(false)
    }
  }

  // Verify edit code for claim, server-side
  const verifyEditCode = async () => {
    if (!claimEditCode) {
      toast.error(t('pleaseEnterEditCode'))
      return
    }

    const res = await fetchWithRateLimitRetry('/api/house/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ qr_code_id: id, edit_code: claimEditCode }),
    })

    if (res.ok) {
      setShowClaimForm(true)
    } else if (res.status === 429) {
      toast.error(t('loadFailed'))
    } else {
      const data = await res.json()
      toast.error(data.error === 'Invalid access' ? t('invalidCode') : t('invalidEditCode'))
    }
  }

  // Handle claim submit, server-side
  const handleClaimSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)

    // Try to capture GPS
    let lat: number | null = null
    let lng: number | null = null

    if (navigator.geolocation) {
      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 5000 })
        })
        lat = position.coords.latitude
        lng = position.coords.longitude
      } catch (error) {
        // GPS failed, that's okay
        console.warn('GPS capture failed:', error)
      }
    }

    try {
      const res = await fetchWithRateLimitRetry('/api/house/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code_id: id,
          edit_code: claimEditCode,
          slug: formData.get('slug')?.toString() || null,
          artist_name: formData.get('artist_name')?.toString() || null,
          artist_bio: formData.get('artist_bio')?.toString() || null,
          bio: formData.get('bio')?.toString() || null,
          lat,
          lng,
          locale,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.needsName) {
          toast.error(t('nameRequiredError'))
          setIsSubmitting(false)
          return
        }
        throw new Error(data.error || 'Failed to claim')
      }

      const data = await res.json()

      if (data.status === 'review') {
        toast.success(t('claimedApproval'))
      } else {
        toast.success(t('claimedLive'))
      }

      // Refresh page
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      console.error('Claim error:', error)
      toast.error(t('failedToClaim'))
      setIsSubmitting(false)
    }
  }

  // Handle edit submit, server-side
  const handleEditSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)

    const formData = new FormData(e.currentTarget)
    const proposed = {
      slug: formData.get('slug')?.toString() || null,
      artist_name: formData.get('artist_name')?.toString() || null,
      artist_bio: formData.get('artist_bio')?.toString() || null,
      bio: formData.get('bio')?.toString() || null,
      lat: editLat,
      lng: editLng,
      tags: editTags,
    }

    try {
      const res = await fetchWithRateLimitRetry('/api/house/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: id, edit_code: editCode, ...proposed, locale }),
      })

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        if (res.status === 403 && data.error === 'Invalid edit code') toast.error(t('invalidEditCode'))
        else toast.error(t('failedToSave'))
        return
      }

      if (data.needsName) {
        // Saved, but a house needs a name to publish; status is
        // unchanged and the persistent banner stays in its needs-name state.
        toast.success(t('savedNotPublic'), { duration: 6000 })
        setLastDenialNote(null)
        setHouse(prev => prev ? { ...prev, ...proposed, updated_at: new Date().toISOString() } : prev)
      } else if (data.queued) {
        toast.success(t('editQueuedToast'))
        setLastDenialNote(null)
        setHasPendingEdit(true)
      } else if (data.review) {
        // First version on a moderated page: saved but not public yet.
        toast.success(t('submittedForReviewToast'))
        setLastDenialNote(null)
        setHouse(prev => prev ? { ...prev, ...proposed, status: 'review', updated_at: new Date().toISOString() } : prev)
      } else {
        // Published and live. Confirm + offer the next step (their public page).
        const wasLive = house?.status === 'live'
        const liveUrl = `/v/${data.slug || house?.slug || id}`
        setLastDenialNote(null)
        setHouse(prev => prev ? { ...prev, ...proposed, slug: data.slug ?? prev.slug, status: 'live', updated_at: new Date().toISOString() } : prev)
        toast.success(
          <span>
            {t('pageIsLive')}{' '}
            <a href={liveUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">{t('viewLivePage')} &#8599;</a>
          </span>
        )
        // Celebrate the very first time the page goes live: once, never again.
        if (!wasLive && typeof window !== 'undefined' && !localStorage.getItem(`pp-celebrated-${id}`)) {
          localStorage.setItem(`pp-celebrated-${id}`, '1')
          setShowLiveModal(true)
        }
      }
    } catch (error) {
      console.error('Update error:', error)
      toast.error(t('failedToSave'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // Image upload: the server (edit-code verified) mints a one-time signed upload
  // URL; the file then uploads directly to storage with that token. Stewards have
  // no standing storage-write access, and large files skip the serverless body limit.
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !house) return

    const maxSize = 5 * 1024 * 1024
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']

    if (file.size > maxSize) {
      toast.error(t('fileTooLarge'))
      return
    }

    if (!allowedTypes.includes(file.type)) {
      toast.error(t('invalidFileType'))
      return
    }

    setIsUploading(true)

    try {
      const compressed = await compressImageForUpload(file)

      // 1. Ask the server for a signed upload URL (edit code verified server-side)
      const signRes = await fetchWithRateLimitRetry('/api/house/images/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: id, edit_code: editCode, ext: COMPRESSED_IMAGE_EXT }),
      })

      if (!signRes.ok) {
        const data = await signRes.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to prepare upload')
      }

      const { token, path, storage_path, image_url } = await signRes.json()

      // 2. Upload the file directly to storage using the one-time token
      const { error: uploadError } = await supabase.storage
        .from('house-images')
        .uploadToSignedUrl(path, token, compressed, UPLOAD_FILE_OPTIONS)

      if (uploadError) throw uploadError

      const nextPosition = images.length + 1

      // 3. Create the DB record (edit code verified again server-side)
      const res = await fetchWithRateLimitRetry('/api/house/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code_id: id,
          edit_code: editCode,
          image_url,
          storage_path,
          display_order: nextPosition,
          file_size_kb: Math.round(compressed.size / 1024),
        }),
      })

      if (!res.ok) {
        // The server rolls back the orphaned storage object on failure.
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to save image record')
      }

      const { image } = await res.json()
      setImages(prev => [...prev, image])
      toast.success(t('imageUploaded'))
      e.target.value = ''
    } catch (error) {
      console.error('Upload error:', error)
      toast.error(t('failedUpload'))
    } finally {
      setIsUploading(false)
    }
  }

  // Delete image, server-side
  const deleteImage = async (imageId: number, storagePath: string) => {
    if (!confirm(t('deleteConfirm'))) return

    try {
      const res = await fetchWithRateLimitRetry('/api/house/images', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code_id: id,
          edit_code: editCode,
          image_id: imageId,
          storage_path: storagePath,
        }),
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to delete')
      }

      setImages(prev => prev.filter(img => img.id !== imageId))
      toast.success(t('imageDeleted'))
    } catch (error) {
      console.error('Delete error:', error)
      toast.error(t('failedDelete'))
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>{t('loading')}</p>
      </div>
    )
  }

  if (mode === 'retired') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <p className="text-5xl mb-6">&#127962;&#65039;</p>
          <h1 className="text-2xl font-bold text-gray-800 mb-3">{t('retiredTitle')}</h1>
          {isAdmin && <div className="mb-3"><AdminEditButton id={id} /></div>}
          <p className="text-gray-500 mb-8">{t('retiredDescription')}</p>
          <Link href="/" className="inline-block bg-amber-600 text-white px-6 py-3 rounded-full font-medium hover:bg-amber-700 transition-colors">
            {t('exploreMapLink')}
          </Link>
        </div>
      </div>
    )
  }

  // CLAIM PAGE (unclaimed house)
  if (mode === 'claim') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4 py-8 sm:p-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-1">{t('yourBirdhouse')}</p>
          </div>
          <Card className="rounded-3xl border-amber-100 shadow-md">
            <CardHeader>
              <CardTitle className="text-2xl">
                <span className="flex items-baseline gap-3 flex-wrap">
                  <span>{t('notClaimedYet')}</span>
                  {isAdmin && <AdminEditButton id={id} />}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {!showClaimForm ? (
                <div className="space-y-4">
                  <p className="text-gray-600">
                    {t('enterEditCode')}{' '}
                    {t('lostEditCodePrefix')}{' '}<Link href="/#contact" className="text-blue-600 hover:underline">{t('lostEditCode')}</Link>.
                  </p>

                  <div className="space-y-2">
                    <Input
                      placeholder={t('editCodePlaceholder')}
                      value={claimEditCode}
                      onChange={(e) => setClaimEditCode(e.target.value.toUpperCase())}
                      maxLength={4}
                      className="uppercase font-mono"
                    />
                    <Button onClick={verifyEditCode} className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold">
                      {t('claimBirdhouse')}
                    </Button>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleClaimSubmit} className="space-y-4">
                  <h3 className="text-xl font-semibold">{t('claimYourBirdhouse')}</h3>

                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <p className="text-xs text-amber-800">{t('privacyWarning')}</p>
                  </div>

                  <p className="text-xs text-gray-500">{t('writeAnyLanguage')}</p>

                  <div>
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      {t('birdHouseName')}
                      <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5">
                        {t('requiredToPublish')}
                      </span>
                    </label>
                    <p className="text-xs text-gray-500 mb-1">{t('slugHint')}</p>
                    <Input name="slug" placeholder={t('slugPlaceholder')} required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('artistName')}</label>
                    <Input name="artist_name" placeholder={t('artistNamePlaceholder')} required />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('aboutTheArtist')} <span className="text-gray-400 font-normal">({t('optional')})</span></label>
                    <p className="text-xs text-gray-500 mb-1">{t('aboutTheArtistHint')}</p>
                    <Textarea name="artist_bio" rows={3} maxLength={400} placeholder={t('aboutTheArtistPlaceholder')} />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">{t('aboutTheBirdHouse')} <span className="text-gray-400 font-normal">({t('optional')})</span></label>
                    <p className="text-xs text-gray-500 mb-1">{t('aboutTheBirdHouseHint')}</p>
                    <Textarea name="bio" rows={4} maxLength={600} placeholder={t('aboutTheBirdHousePlaceholder')} />
                  </div>

                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <p className="text-sm text-gray-700">
                      {t('gpsNote')}
                    </p>
                  </div>

                  <Button type="submit" disabled={isSubmitting} className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold">
                    {isSubmitting ? t('creating') : t('createMyBirdhouse')}
                  </Button>
                </form>
              )}
            </CardContent>
          </Card>
        </div>
        <Toaster />
      </div>
    )
  }

  // EDIT PAGE
  if (mode === 'edit' && house) {
    const isPrePublish = house.status !== 'live'
    const hasName = slugValue.trim().length > 0
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4 py-8 sm:p-8">
        <div className="max-w-2xl mx-auto">
          {!previewing && (
            <div className="mb-6">
              <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-1">{t('yourBirdhouse')}</p>
              <div className="flex items-baseline justify-between gap-3 flex-wrap">
                <h1 className="text-3xl sm:text-4xl font-bold text-gray-900">
                  {slugValue.trim() ? formatSlug(slugValue.trim()) : t('nameYourBirdhouse')}
                </h1>
                <span className="flex items-center gap-3">
                  {house.status === 'live' && (
                    <a
                      href={`/v/${house.slug || id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-semibold text-amber-600 hover:text-amber-700 hover:underline whitespace-nowrap"
                    >
                      {t('viewLivePage')} &#8599;
                    </a>
                  )}
                  {isAdmin && <AdminEditButton id={id} />}
                </span>
              </div>
            </div>
          )}
          {!previewing && isPrePublish && !hasName && (
            <div
              className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
              data-testid="publish-status-banner"
              data-state="needs-name"
            >
              <p className="text-sm font-semibold text-amber-900">{t('notPublicYetTitle')}</p>
              <p className="text-sm text-amber-800">{t('notPublicYetBody')}</p>
            </div>
          )}
          {!previewing && house.status === 'invited' && hasName && (
            <div
              className="mb-4 rounded-2xl border border-emerald-300 bg-emerald-50 px-4 py-3"
              data-testid="publish-status-banner"
              data-state="ready"
            >
              <p className="text-sm font-semibold text-emerald-900">{t('readyToPublishTitle')}</p>
              <p className="text-sm text-emerald-800">{t('readyToPublishBody')}</p>
            </div>
          )}
          {house.status === 'review' && hasName && (
            <div
              className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-3"
              data-testid="awaiting-first-review-banner"
            >
              <p className="text-sm font-semibold text-amber-900 mb-1">{t('awaitingReviewTitle')}</p>
              <p className="text-sm text-amber-800">
                {t('awaitingReviewBody')}
              </p>
            </div>
          )}
          {lastDenialNote && (
            <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-sm font-semibold text-red-800 mb-1">{t('draftNotApprovedTitle')}</p>
              <p className="text-sm text-red-700">{lastDenialNote}</p>
              <p className="text-xs text-red-500 mt-1">{t('draftNotApprovedNote')}</p>
            </div>
          )}
          {hasPendingEdit && !lastDenialNote && house.status !== 'review' && (
            <div className="mb-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
              <p className="text-sm text-amber-800">{t('pendingEditWillReplace')}</p>
            </div>
          )}
          {previewing && previewSnapshot && (
            <EditPreview
              snapshot={previewSnapshot}
              fallback={house}
              lat={editLat}
              lng={editLng}
              images={images}
              onBack={exitPreview}
            />
          )}
          <form
            ref={editFormRef}
            onSubmit={handleEditSubmit}
            className={previewing ? 'hidden' : 'space-y-5'}
          >
            <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-100 px-4 py-3 space-y-1">
              <p className="text-xs text-gray-600">{t('privacyWarning')}</p>
              <p className="text-xs text-gray-500">{t('writeAnyLanguage')}</p>
            </div>

            <EditSection step={isPrePublish ? 1 : undefined} title={t('sectionNameTitle')} hint={t('slugHint')}>
              <div>
                <label htmlFor="slug" className="flex items-center gap-2 text-sm font-medium text-gray-900 mb-1.5">
                  {t('birdHouseName')}
                  <span className="inline-block rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold px-2 py-0.5">
                    {isPrePublish ? t('requiredToPublish') : t('required')}
                  </span>
                </label>
                {/* Pre-publish must NOT use the required attr: a nameless save is a
                    supported persist-only flow (the server just won't publish it). */}
                <Input
                  id="slug"
                  name="slug"
                  data-testid="name-input"
                  value={slugValue}
                  onChange={(e) => setSlugValue(e.target.value)}
                  required={!isPrePublish}
                  className={isPrePublish && !hasName ? 'border-amber-400 ring-2 ring-amber-200 focus-visible:ring-amber-500' : 'focus-visible:ring-amber-500'}
                />
              </div>
            </EditSection>

            <EditSection step={isPrePublish ? 2 : undefined} title={t('sectionStoryTitle')}>
              <div>
                <label htmlFor="artist_name" className="block text-sm font-medium text-gray-900 mb-1.5">{t('artistName')}</label>
                <Input id="artist_name" name="artist_name" defaultValue={house.artist_name || ''} className="focus-visible:ring-amber-500" />
              </div>

              <div>
                <label htmlFor="artist_bio" className="block text-sm font-medium text-gray-900 mb-1.5">{t('aboutTheArtist')} <span className="text-gray-400 font-normal">({t('optional')})</span></label>
                <p className="text-xs text-gray-500 mb-1">{t('aboutTheArtistHint')}</p>
                <Textarea id="artist_bio" name="artist_bio" defaultValue={house.artist_bio || ''} rows={3} maxLength={400} className="focus-visible:ring-amber-500" />
              </div>

              <div>
                <label htmlFor="bio" className="block text-sm font-medium text-gray-900 mb-1.5">{t('aboutTheBirdHouse')} <span className="text-gray-400 font-normal">({t('optional')})</span></label>
                <p className="text-xs text-gray-500 mb-1">{t('aboutTheBirdHouseHint')}</p>
                <Textarea id="bio" name="bio" defaultValue={house.bio || ''} rows={4} maxLength={600} className="focus-visible:ring-amber-500" />
              </div>
            </EditSection>

            <EditSection step={isPrePublish ? 3 : undefined} title={t('sectionLocationTitle')} hint={t('sectionLocationHint')}>
              <div>
                  <LocationPicker
                    initialLat={editLat}
                    initialLng={editLng}
                    onChange={(lat, lng) => { setEditLat(lat); setEditLng(lng) }}
                    onImmediateSave={async (lat, lng) => {
                      const res = await fetchWithRateLimitRetry('/api/house/location', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ qr_code_id: id, edit_code: editCode, lat, lng }),
                      })
                      if (!res.ok) throw new Error('Failed to save location')
                      setHouse(prev => prev ? { ...prev, lat, lng } : prev)
                    }}
                    onGeoError={(m) => toast.error(m)}
                    labels={{
                      useCurrentLocation: t('useCurrentLocation'),
                      clearLocation: t('clearLocation'),
                      successMessage: t('locationSuccess'),
                      dragQuestion: t('dragChangeQuestion'),
                      yes: t('yes'),
                      no: t('no'),
                      clearTitle: t('clearLocationTitle'),
                      clearBody: t('clearLocationBody'),
                      clearConfirm: t('clearLocationConfirm'),
                      cancel: t('cancel'),
                      geoUnsupported: t('geoNotSupported'),
                      geoFailed: t('failedLocation'),
                      saveFailed: t('locationSaveFailed'),
                    }}
                  />
                  {editLat && editLng && (
                    <p className="text-xs text-gray-400 mt-1">{editLat.toFixed(5)}, {editLng.toFixed(5)}</p>
                  )}
              </div>
            </EditSection>

            <EditSection
              step={isPrePublish ? 4 : undefined}
              title={t('sectionPhotosTitle')}
              aside={<span data-testid="photo-counter" className="text-sm text-gray-500 whitespace-nowrap">{t('photoCount', { count: images.length, max: 3 })}</span>}
            >
              <div className="grid grid-cols-3 gap-3">
                {images.map((image) => (
                  <div key={image.id} data-testid="photo-thumb" className="relative aspect-square rounded-2xl overflow-hidden border border-amber-100 bg-amber-50">
                    <img
                      src={houseImage(image.image_url, IMG_THUMB)}
                      alt={t('photoAlt', { position: image.display_order })}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      aria-label={t('removePhoto')}
                      data-testid="photo-delete-button"
                      className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center"
                      onClick={() => deleteImage(image.id, image.storage_path)}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label
                    htmlFor="photo-upload"
                    data-testid="photo-upload-tile"
                    className={`aspect-square rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50
                      flex flex-col items-center justify-center gap-1 text-amber-700 cursor-pointer
                      hover:border-amber-400 hover:bg-amber-50 focus-within:ring-2 focus-within:ring-amber-500 focus-within:ring-offset-2
                      ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <Plus className="w-8 h-8" aria-hidden="true" />
                    <span className="text-sm font-semibold">{isUploading ? t('uploading') : t('addPhoto')}</span>
                    <input
                      id="photo-upload"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="sr-only"
                    />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">{t('photosSaveOnUpload')} {t('maxFileSize')}</p>
            </EditSection>

            <Button
              type="submit"
              disabled={isSubmitting}
              data-testid="save-changes-button"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-3 font-semibold text-lg disabled:opacity-50"
            >
              {isSubmitting ? t('saving') : t('saveChanges')}
            </Button>
          </form>

          {!previewing && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={enterPreview}
                data-testid="preview-button"
                className="border-amber-500 text-amber-700 hover:bg-amber-50 rounded-full px-5"
              >
                {t('previewBeforeSaving')}
              </Button>
              {house.status === 'live' && (
                <a
                  href={`/v/${house.slug || id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm font-semibold text-amber-700 hover:underline"
                >
                  {t('viewLivePage')} &#8599;
                </a>
              )}
            </div>
          )}
        </div>

        {/* First-publish celebration, shown once, never on repeat saves */}
        {showLiveModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowLiveModal(false)}
          >
            <div
              className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 text-center"
              onClick={(e) => e.stopPropagation()}
            >
              <h2 className="text-xl font-bold text-gray-900 mb-2">{t('perchIsLive')}</h2>
              <p className="text-sm text-gray-600 mb-6">
                {t('liveModalBody')}
              </p>
              <a href={`/v/${house.slug || id}`} target="_blank" rel="noopener noreferrer">
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full mb-2">
                  {t('viewLivePage')} &#8599;
                </Button>
              </a>
              <Button
                variant="outline"
                onClick={() => setShowLiveModal(false)}
                className="w-full rounded-full border-gray-300 text-gray-600"
              >
                {t('keepEditing')}
              </Button>
            </div>
          </div>
        )}
        <Toaster />
      </div>
    )
  }

  // VIEW PAGE (public)
  if (house) {
    return (
      <div className="min-h-screen bg-gray-50 p-8">
        <div className="max-w-4xl mx-auto">
          {/* Images */}
          {images.length > 0 && (
            <>
              <div className={`mb-8 grid gap-4 ${images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-3'}`}>
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => { setActiveImage(i); setLightboxOpen(true) }}
                    className="block w-full rounded-lg overflow-hidden shadow cursor-zoom-in"
                  >
                    <BirdhousePhoto src={img.image_url} alt={t('birdhouse')} width={IMG_HERO} aspect={images.length === 1 ? '4 / 3' : '1 / 1'} />
                  </button>
                ))}
              </div>
              <PhotoLightbox
                slides={lightboxSlides(images)}
                index={activeImage}
                open={lightboxOpen}
                onClose={() => setLightboxOpen(false)}
                onIndexChange={setActiveImage}
              />
            </>
          )}

          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="text-3xl">
                <span className="flex items-baseline gap-3 flex-wrap">
                  <span>{house.slug || `${t('birdhouse')} ${id}`}</span>
                  {isAdmin && <AdminEditButton id={id} />}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Missing Location */}
              {!house.lat && !house.lng && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <p className="text-lg font-semibold">{t('helpFindTitle')}</p>
                  <p className="text-gray-700">
                    {t('helpFindDescription')}
                  </p>
                  <Link href="/#contact">
                    <Button className="mt-2">{t('reportLocation')}</Button>
                  </Link>
                </div>
              )}

              <div>
                <h3 className="font-semibold text-lg mb-2">{t('artistLabel')}</h3>
                <p>{house.artist_name || t('aCreativeSoul')}</p>
              </div>


              <div>
                <h3 className="font-semibold text-lg mb-2">{t('aboutLabel')}</h3>
                {house.bio ? (
                  <TranslatedField
                    sourceLocale={house.bio_source_locale}
                    sourceText={house.bio}
                    translatedText={bioTx}
                  />
                ) : (
                  <p>{t('defaultBio')}</p>
                )}
              </div>

              {house.lat && house.lng && (
                <div>
                  <h3 className="font-semibold text-lg mb-2">{t('locationCoords')}</h3>
                  <p className="text-gray-600">
                    {house.lat.toFixed(4)}, {house.lng.toFixed(4)}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="text-center">
            <Link href="/map">
              <Button variant="outline">{t('viewAllOnMap')}</Button>
            </Link>
          </div>
        </div>
        <Toaster />
      </div>
    )
  }

  return null
}
