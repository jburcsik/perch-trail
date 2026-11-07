'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { reserveQrCode } from '@/lib/qr-reserve'
import { EditSection } from '@/components/EditSection'
import { TagEditor } from '@/components/TagEditor'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { EN_LOCATION_LABELS } from '@/components/locationLabels'
import toast, { Toaster } from 'react-hot-toast'
import { Copy } from 'lucide-react'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })


export default function NewHousePage() {
  const router = useRouter()
  const [qrCodeId, setQrCodeId] = useState<string | null>(null)
  const [editCode, setEditCode] = useState<string | null>(null)
  const [reserving, setReserving] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])

  // Reserve a fresh QR code + edit code on mount. Retry once on collision.
  useEffect(() => {
    let cancelled = false
    const reserve = async () => {
      const res = await reserveQrCode(supabase)
      if (cancelled) return
      if ('err' in res) {
        toast.error(res.err === 'exhausted' ? 'Could not reserve an ID after 3 attempts' : 'Failed to reserve a new ID')
        setReserving(false)
        return
      }
      setQrCodeId(res.id)
      setEditCode(res.editCode)
      setReserving(false)
    }
    reserve()
    return () => { cancelled = true }
  }, [])

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!qrCodeId) return

    const formData = new FormData(e.currentTarget)
    setSubmitting(true)
    const loadingToast = toast.loading('Creating house...')

    const { error } = await supabase.from('houses').insert({
      qr_code_id: qrCodeId,
      slug: slugify(formData.get('slug')?.toString()),
      artist_name: formData.get('artist_name')?.toString() || null,
      artist_bio: formData.get('artist_bio')?.toString() || null,
      bio: formData.get('bio')?.toString() || null,
      lat: formData.get('lat') ? parseFloat(formData.get('lat')!.toString()) : null,
      lng: formData.get('lng') ? parseFloat(formData.get('lng')!.toString()) : null,
      status: 'invited',
      is_invited_artist: formData.get('is_invited_artist') === 'on',
      tags,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    if (error) {
      toast.error('Failed to create house', { id: loadingToast })
      setSubmitting(false)
      return
    }

    toast.success('House created!', { id: loadingToast })
    router.push(`/admin/houses/${qrCodeId}`)
  }

  if (reserving) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Reserving new house ID...</div>
  }

  if (!qrCodeId || !editCode) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-700 mb-4">Could not reserve a new house ID.</p>
              <Link href="/admin"><Button variant="outline">Back to Admin</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div data-testid="admin-editor-shell" className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4 py-8 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">New house</p>
            <h1 className="text-3xl font-bold mt-1">Create New House</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">ID: {qrCodeId} &#183; Edit Code: {editCode}</p>
          </div>
          <Link href="/admin"><Button variant="outline">Cancel</Button></Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-100 px-4 py-3">
                <p className="text-xs text-gray-600">&#128274; This page is public. Please don&apos;t include personal contact info like a home address, phone number, or email.</p>
              </div>

          <EditSection title="Name & story">
              <div>
                <label className="block text-sm font-medium mb-2">Bird House Name</label>
                <p className="text-xs text-gray-500 mb-1">Becomes the page title and URL, e.g. &quot;dragon-gate&quot; shows as Dragon Gate.</p>
                <Input name="slug" placeholder="dragon-gate" maxLength={50} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Artist Name</label>
                <Input name="artist_name" placeholder="e.g. Rowan Pike, or an alias" maxLength={80} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">About the Artist</label>
                <p className="text-xs text-gray-500 mb-1">Anything goes: where they&apos;re from, what they love, what they had for breakfast. The weirder the better.</p>
                <Textarea name="artist_bio" rows={3} maxLength={400} />
                <p className="text-xs text-gray-400 text-end mt-0.5">Up to 400 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">About the Bird House</label>
                <p className="text-xs text-gray-500 mb-1">Tell us everything. What inspired it? What&apos;s it made of? Does it have a story, a secret, a vibe?</p>
                <Textarea name="bio" rows={5} maxLength={600} />
                <p className="text-xs text-gray-400 text-end mt-0.5">Up to 600 characters</p>
              </div>

          </EditSection>

              <input type="hidden" name="lat" value={lat ?? ''} />
              <input type="hidden" name="lng" value={lng ?? ''} />

          <EditSection title="Location">
              <div>
                <LocationPicker
                  initialLat={lat}
                  initialLng={lng}
                  onChange={(la, ln) => { setLat(la); setLng(ln) }}
                  onGeoError={(m) => toast.error(m)}
                  labels={EN_LOCATION_LABELS}
                />
                {lat && lng && <p className="text-xs text-gray-400 mt-1">{lat.toFixed(5)}, {lng.toFixed(5)}</p>}
              </div>
          </EditSection>

          <EditSection title="Admin controls" hint="Badges and tags: the public never sees this box.">
              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_invited_artist" id="new-invited" />
                <label htmlFor="new-invited" className="text-sm">&#9733; Featured Artist (prominent gold map marker)</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <TagEditor tags={tags} onSave={setTags} showAdminTags />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-gray-700">
                  <strong>Note:</strong> House is created as Invited, not public until its
                  status is set to Live (or a steward publishes via their edit link).
                </p>
              </div>

          </EditSection>

              <div className="bg-white rounded-2xl border border-amber-100 px-4 py-3 flex items-center gap-2">
                <p className="text-xs text-gray-400 font-mono truncate flex-1">
                  {typeof window !== 'undefined' ? `${window.location.origin}/h/${qrCodeId}?edit=${editCode}` : ''}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/h/${qrCodeId}?edit=${editCode}`)
                    toast.success('Edit link copied!')
                  }}
                  className="text-blue-600 hover:text-blue-800 shrink-0"
                  title="Copy edit link"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <Link href="/admin" className="flex-1">
                  <Button type="button" variant="outline" className="w-full rounded-full">Cancel</Button>
                </Link>
                <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Create House'}
                </Button>
              </div>
            </form>
      </div>
      <Toaster />
    </div>
  )
}
