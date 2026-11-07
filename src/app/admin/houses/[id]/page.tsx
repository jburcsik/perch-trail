'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { slugify } from '@/lib/slug'
import { generateRandomCode } from '@/lib/qr-reserve'
import { TagEditor } from '@/components/TagEditor'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { EditSection } from '@/components/EditSection'
import { Plus, X } from 'lucide-react'
import { EN_LOCATION_LABELS } from '@/components/locationLabels'
import toast, { Toaster } from 'react-hot-toast'
import { Copy } from 'lucide-react'
import { houseImage, IMG_THUMB } from '@/lib/images'
import { compressImageForUpload, COMPRESSED_IMAGE_EXT, UPLOAD_FILE_OPTIONS } from '@/lib/image-compression'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })

interface House {
  qr_code_id: string
  slug: string | null
  status: 'invited' | 'review' | 'live' | 'suspended'
  artist_name: string | null
  bio: string | null
  artist_bio: string | null
  lat: number | null
  lng: number | null
  include_in_promo: boolean
  is_invited_artist: boolean
  tags: string[]
  claimed_at: string
  updated_at: string
  auto_approve_edits: boolean
  suspended_at: string | null
  suspended_reason: string | null
  archived_at: string | null
}

interface HistoryEntry {
  id: string
  type: 'new_profile' | 'edit'
  status: string
  created_at: string
  reviewed_at: string | null
  rejection_note: string | null
  admin_note: string | null
}

interface HouseImage {
  id: number
  qr_code_id: string
  image_url: string
  storage_path: string
  display_order: number
}


export default function EditHousePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()

  const [house, setHouse] = useState<House | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [images, setImages] = useState<HouseImage[]>([])
  const [isUploading, setIsUploading] = useState(false)

  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [tags, setTags] = useState<string[]>([])

  const [editCodeVisible, setEditCodeVisible] = useState(false)
  const [currentEditCode, setCurrentEditCode] = useState('')

  const [confirmAction, setConfirmAction] = useState<'suspend' | 'unsuspend' | 'delete' | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  // Private label of the street dot this house was promoted from, if any.
  const [originDot, setOriginDot] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      const { data, error } = await supabase.from('houses').select('*').eq('qr_code_id', id).single()
      if (error || !data) { setNotFound(true); setLoading(false); return }
      setHouse(data)
      setLat(data.lat)
      setLng(data.lng)
      setTags(data.tags ?? [])

      const { data: imgs } = await supabase
        .from('house_images')
        .select('*')
        .eq('qr_code_id', id)
        .order('display_order', { ascending: true })
      if (imgs) setImages(imgs)

      // Load request history: new_profile request + all edit submissions
      const { data: hist } = await supabase
        .from('profile_requests')
        .select('id, type, status, created_at, reviewed_at, rejection_note, admin_note')
        .or(`assigned_qr_code_id.eq.${id},target_qr_code_id.eq.${id}`)
        .neq('status', 'pending')
        .order('created_at', { ascending: false })
      if (hist) setHistory(hist as HistoryEntry[])

      const { data: origin } = await supabase
        .from('map_markers')
        .select('label')
        .eq('promoted_qr_code_id', id)
        .maybeSingle()
      setOriginDot(origin?.label ?? null)

      setLoading(false)
    }
    fetch()
  }, [id])

  const refetchImages = async () => {
    const { data } = await supabase
      .from('house_images')
      .select('*')
      .eq('qr_code_id', id)
      .order('display_order', { ascending: true })
    if (data) setImages(data)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!house) return
    const formData = new FormData(e.currentTarget)
    const loadingToast = toast.loading('Saving changes...')

    const { error } = await supabase
      .from('houses')
      .update({
        slug: slugify(formData.get('slug')?.toString()),
        artist_name: formData.get('artist_name')?.toString() || null,
        artist_bio: formData.get('artist_bio')?.toString() || null,
        bio: formData.get('bio')?.toString() || null,
        lat: formData.get('lat') ? parseFloat(formData.get('lat')!.toString()) : null,
        lng: formData.get('lng') ? parseFloat(formData.get('lng')!.toString()) : null,
        status: formData.get('status')?.toString() as House['status'],
        is_invited_artist: formData.get('is_invited_artist') === 'on',
        auto_approve_edits: formData.get('auto_approve_edits') === 'on',
        tags,
        updated_at: new Date().toISOString(),
      })
      .eq('qr_code_id', house.qr_code_id)

    if (error) {
      toast.error('Failed to save changes', { id: loadingToast })
      return
    }
    toast.success('Changes saved!', { id: loadingToast })
    router.push('/admin')
  }

  const viewEditCode = async () => {
    if (!house) return
    const { data } = await supabase.from('qr_codes').select('edit_code').eq('id', house.qr_code_id).single()
    if (data) {
      setCurrentEditCode(data.edit_code)
      setEditCodeVisible(true)
      toast.success('Edit code revealed')
    }
  }

  const regenerateEditCode = async () => {
    if (!house) return
    if (!confirm('Regenerate edit code? The old code will stop working.')) return
    const newCode = generateRandomCode(4)
    const { error } = await supabase.from('qr_codes').update({ edit_code: newCode }).eq('id', house.qr_code_id)
    if (error) { toast.error('Failed to regenerate edit code'); return }
    setCurrentEditCode(newCode)
    setEditCodeVisible(true)
    toast.success(`New edit code: ${newCode}`)
  }

  const suspendHouse = async (reason?: string) => {
    if (!house) return
    const res = await fetch(`/api/admin/houses/${house.qr_code_id}/suspend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reason ?? null }),
    })
    if (!res.ok) { toast.error('Failed to suspend'); return }
    toast.success('Profile suspended')
    setConfirmAction(null)
    setHouse({ ...house, status: 'suspended', suspended_at: new Date().toISOString() })
  }

  const unsuspendHouse = async () => {
    if (!house) return
    const res = await fetch(`/api/admin/houses/${house.qr_code_id}/unsuspend`, { method: 'POST' })
    if (!res.ok) { toast.error('Failed to unsuspend'); return }
    toast.success('Profile restored')
    setConfirmAction(null)
    setHouse({ ...house, status: 'live', suspended_at: null })
  }

  const deleteHouse = async () => {
    if (!house) return
    const res = await fetch(`/api/admin/houses/${house.qr_code_id}`, {
      method: 'DELETE',
      headers: { 'X-Confirm-Slug': house.slug || house.qr_code_id },
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      const msg =
        err.error === 'confirmation_mismatch' ? 'Confirmation did not match'
        : err.error === 'unauthorized' ? 'Your admin session expired. Sign out and back in, then retry'
        : err.error === 'confirmation_required' ? 'Confirmation required'
        : err.error === 'not_found' ? 'House not found'
        : `Failed to delete${err.error ? ` (${err.error})` : ` (HTTP ${res.status})`}`
      toast.error(msg)
      return
    }
    toast.success('Profile permanently deleted')
    setConfirmAction(null)
    router.push('/admin')
  }

  // Soft delete: one-click archive. Hides the profile from the site and admin
  // active lists; restorable. Runs as the authenticated admin (RLS-permitted).
  const archiveHouse = async () => {
    if (!house) return
    const { error } = await supabase
      .from('houses')
      .update({ archived_at: new Date().toISOString() })
      .eq('qr_code_id', house.qr_code_id)
    if (error) { toast.error('Failed to delete'); return }
    toast.success('Profile deleted. Restore anytime from the dashboard')
    router.push('/admin')
  }

  const restoreHouse = async () => {
    if (!house) return
    const { error } = await supabase
      .from('houses')
      .update({ archived_at: null })
      .eq('qr_code_id', house.qr_code_id)
    if (error) { toast.error('Failed to restore'); return }
    toast.success('Profile restored')
    setHouse({ ...house, archived_at: null })
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !house) return
    if (file.size > 5 * 1024 * 1024) { toast.error('File too large. Max 5MB.'); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      toast.error('Invalid file type. Use JPG, PNG, or WebP.'); return
    }
    setIsUploading(true)
    try {
      // Normalize to the upload profile before it ever reaches storage; every
      // stored original is already WebP at a 1200px long edge, ~150kB.
      const compressed = await compressImageForUpload(file)
      const fileName = `${house.qr_code_id}/${Date.now()}-${crypto.randomUUID()}.${COMPRESSED_IMAGE_EXT}`
      const { error: uploadError } = await supabase.storage
        .from('house-images')
        .upload(fileName, compressed, { ...UPLOAD_FILE_OPTIONS, upsert: false })
      if (uploadError) throw uploadError

      const { data: urlData } = supabase.storage.from('house-images').getPublicUrl(fileName)
      const { error: dbError } = await supabase.from('house_images').insert({
        qr_code_id: house.qr_code_id,
        image_url: urlData.publicUrl,
        storage_path: fileName,
        display_order: images.length + 1,
        uploaded_by: 'admin',
        file_size_kb: Math.round(compressed.size / 1024),
      })
      if (dbError) throw dbError
      toast.success('Image uploaded!')
      await refetchImages()
      e.target.value = ''
    } catch (err) {
      console.error('Upload error:', err)
      toast.error('Failed to upload image')
    } finally {
      setIsUploading(false)
    }
  }

  const deleteImage = async (imageId: number, storagePath: string) => {
    if (!confirm('Delete this image?')) return
    try {
      await supabase.storage.from('house-images').remove([storagePath])
      await supabase.from('house_images').delete().eq('id', imageId)
      toast.success('Image deleted')
      await refetchImages()
    } catch (err) {
      console.error('Delete error:', err)
      toast.error('Failed to delete image')
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  if (notFound || !house) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 md:p-8">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardContent className="p-6">
              <p className="text-red-700 mb-4">House not found.</p>
              <Link href="/admin"><Button variant="outline">Back to Admin</Button></Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const editLinkUrl = currentEditCode
    ? (typeof window !== 'undefined' ? `${window.location.origin}/h/${house.qr_code_id}?edit=${currentEditCode}` : '')
    : null

  const displayName = house.slug
    ? house.slug.split(/[-\s]+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : house.qr_code_id
  return (
    <div data-testid="admin-editor-shell" className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 px-4 py-8 sm:p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <div>
            <Link href="/admin" className="text-sm text-gray-500 hover:underline">&#8592; Admin</Link>
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mt-2">Edit house</p>
            <h1 className="text-3xl font-bold mt-1">{displayName}</h1>
            <p className="text-xs text-gray-500 font-mono mt-1">{house.qr_code_id}</p>
            {originDot && (
              <p className="text-xs text-gray-500 mt-1" data-testid="origin-dot">
                Origin: street dot &quot;{originDot}&quot;
              </p>
            )}
          </div>
          <Link href={`/v/${house.slug ?? house.qr_code_id}`} target="_blank" rel="noreferrer">
            <Button variant="outline" size="sm">View public page &#8599;</Button>
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="bg-white/70 backdrop-blur-sm rounded-2xl border border-amber-100 px-4 py-3">
            <p className="text-xs text-gray-600">&#128274; This page is public. Please don&apos;t include personal contact info like a home address, phone number, or email.</p>
          </div>

          <EditSection title="Name & story">
              <div>
                <label className="block text-sm font-medium mb-2">Bird House Name</label>
                <p className="text-xs text-gray-500 mb-1">Becomes the page title and URL, e.g. &quot;dragon-gate&quot; shows as Dragon Gate.</p>
                <Input name="slug" defaultValue={house.slug || ''} placeholder="dragon-gate" maxLength={50} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Artist Name</label>
                <Input name="artist_name" defaultValue={house.artist_name || ''} placeholder="e.g. Rowan Pike, or an alias" maxLength={80} />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">About the Artist</label>
                <p className="text-xs text-gray-500 mb-1">Anything goes: where they&apos;re from, what they love, what they had for breakfast.</p>
                <Textarea name="artist_bio" defaultValue={house.artist_bio || ''} rows={3} maxLength={400} />
                <p className="text-xs text-gray-400 text-end mt-0.5">Up to 400 characters</p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">About the Bird House</label>
                <p className="text-xs text-gray-500 mb-1">Tell us everything. What inspired it? What&apos;s it made of? Does it have a story, a secret, a vibe?</p>
                <Textarea name="bio" defaultValue={house.bio || ''} rows={5} maxLength={600} />
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
                  onImmediateSave={async (la, ln) => {
                    const { error } = await supabase
                      .from('houses')
                      .update({ lat: la, lng: ln, updated_at: new Date().toISOString() })
                      .eq('qr_code_id', id)
                    if (error) throw error
                  }}
                  onGeoError={(m) => toast.error(m)}
                  labels={EN_LOCATION_LABELS}
                />
                {lat && lng && <p className="text-xs text-gray-400 mt-1">{lat.toFixed(5)}, {lng.toFixed(5)}</p>}
              </div>
          </EditSection>

          <EditSection
            title="Photos"
            aside={<span className="text-sm text-gray-500 whitespace-nowrap">{images.length} of 3</span>}
          >
              <div className="grid grid-cols-3 gap-3">
                {images.map((image) => (
                  <div key={image.id} className="relative aspect-square rounded-2xl overflow-hidden border border-amber-100 bg-amber-50">
                    <img src={houseImage(image.image_url, IMG_THUMB)} alt={`House photo ${image.display_order}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      className="absolute top-1.5 end-1.5 w-7 h-7 rounded-full bg-black/60 hover:bg-black text-white flex items-center justify-center"
                      onClick={() => deleteImage(image.id, image.storage_path)}
                    >
                      <X className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  </div>
                ))}
                {images.length < 3 && (
                  <label
                    htmlFor="admin-photo-upload"
                    className={`aspect-square rounded-2xl border-2 border-dashed border-amber-300 bg-amber-50/50 flex flex-col items-center justify-center gap-1 text-amber-700 cursor-pointer hover:border-amber-400 hover:bg-amber-50 ${isUploading ? 'pointer-events-none opacity-60' : ''}`}
                  >
                    <Plus className="w-8 h-8" aria-hidden="true" />
                    <span className="text-sm font-semibold">{isUploading ? 'Uploading...' : 'Add photo'}</span>
                    <input id="admin-photo-upload" type="file" accept="image/jpeg,image/png,image/webp" onChange={handleImageUpload} disabled={isUploading} className="sr-only" />
                  </label>
                )}
              </div>
              <p className="text-xs text-gray-500">Photos save as you upload them. Max 5MB. JPG, PNG, WebP only.</p>
          </EditSection>

          <EditSection title="Admin controls" hint="Visibility, badges, and tags: the public never sees this box.">
              <div>
                <label className="block text-sm font-medium mb-2">Status</label>
                <select name="status" className="w-full p-2 border rounded" defaultValue={house.status}>
                  <option value="invited">Invited</option>
                  <option value="review">Ready for Review</option>
                  <option value="live">Live</option>
                  {/* Present so a suspended house round-trips instead of silently saving as Invited. */}
                  <option value="suspended" disabled>Suspended (use the buttons below)</option>
                </select>
                <p className="text-xs text-gray-500 mt-1">To suspend (moderate) a profile, use the Suspend button below.</p>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="is_invited_artist" id="edit-invited" defaultChecked={house.is_invited_artist} />
                <label htmlFor="edit-invited" className="text-sm">&#9733; Featured Artist (prominent gold map marker)</label>
              </div>

              <div className="flex items-center gap-2">
                <input type="checkbox" name="auto_approve_edits" id="edit-auto-approve" defaultChecked={house.auto_approve_edits} />
                <label htmlFor="edit-auto-approve" className="text-sm">Auto-approve steward edits (trusted profile)</label>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Tags</label>
                <TagEditor tags={tags} onSave={setTags} showAdminTags />
              </div>
          </EditSection>

          {/* Danger Zone */}
          <Card className="border-red-200 rounded-3xl overflow-hidden">
            <CardHeader className="border-b border-red-100 bg-red-50/50">
              <CardTitle className="text-base text-red-700"><h2 className="text-lg font-bold">Danger Zone</h2></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
              {house.suspended_at && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900 space-y-1">
                  <p>This profile is <strong>suspended</strong>, hidden from public surfaces. Stewards can&apos;t edit until restored.</p>
                  <p className="text-xs text-amber-700">Suspended {new Date(house.suspended_at).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}{house.suspended_reason ? `: "${house.suspended_reason}"` : '.'}</p>
                </div>
              )}

              <div className="space-y-2">
                <h3 className="text-sm font-semibold text-gray-900">Edit code management</h3>
                {editCodeVisible && (
                  <div>
                    <label className="text-xs text-gray-600">Current edit code:</label>
                    <Input
                      readOnly
                      value={currentEditCode}
                      className="font-mono text-lg font-bold"
                      onClick={(e) => e.currentTarget.select()}
                    />
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={viewEditCode}>&#128065;&#65039; View edit code</Button>
                  <Button type="button" size="sm" variant="outline" onClick={regenerateEditCode}>&#128260; Regenerate code</Button>
                </div>
                <p className="text-xs text-gray-600">Share if the steward lost it. Regenerating invalidates the old one.</p>
                {editLinkUrl && (
                  <div className="flex items-center gap-2 pt-2">
                    <p className="text-xs text-gray-400 font-mono truncate flex-1">{editLinkUrl}</p>
                    <button
                      type="button"
                      onClick={() => { navigator.clipboard.writeText(editLinkUrl); toast.success('Edit link copied!') }}
                      className="text-blue-600 hover:text-blue-800 shrink-0"
                      title="Copy edit link"
                    >
                      <Copy className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>

              {/* Suspend applies only to published profiles; invited/review houses
                  use Delete instead (keeps unsuspend-to-live correct). */}
              {(house.status === 'live' || house.status === 'suspended') && (
                <>
                  <div className="border-t border-red-100" />

                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="text-sm font-semibold text-gray-900">
                        {house.status === 'suspended' ? 'Restore profile' : 'Suspend profile'}
                      </h3>
                      <p className="text-xs text-gray-600">
                        {house.status === 'suspended'
                          ? 'Restoring makes the profile public again and re-enables steward editing.'
                          : 'Hides the profile from the map, listings, and public pages. Steward edits are blocked until restored. Reversible.'}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="border-red-300 text-red-700 hover:bg-red-50 shrink-0"
                      onClick={() => setConfirmAction(house.status === 'suspended' ? 'unsuspend' : 'suspend')}
                    >
                      {house.status === 'suspended' ? 'Restore' : 'Suspend'}
                    </Button>
                  </div>
                </>
              )}

              <div className="border-t border-red-100" />

              {/* Soft delete: one click, reversible */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-red-700">
                    {house.archived_at ? 'Restore deleted profile' : 'Delete profile'}
                  </h3>
                  <p className="text-xs text-gray-600">
                    {house.archived_at
                      ? 'This profile is deleted (hidden from the site). Restore brings it back.'
                      : 'Removes the profile from the map and public pages. One click, and you can restore it anytime from the dashboard.'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant={house.archived_at ? 'outline' : 'destructive'}
                  className="shrink-0"
                  onClick={() => (house.archived_at ? restoreHouse() : archiveHouse())}
                >
                  {house.archived_at ? 'Restore' : 'Delete'}
                </Button>
              </div>

              <div className="border-t border-red-100" />

              {/* Hard delete: permanent, typed confirmation */}
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold text-red-700">Delete permanently</h3>
                  <p className="text-xs text-gray-600">
                    Erases the profile and its images for good and retires the access link. You&apos;ll type the name to confirm. This cannot be undone.
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className="shrink-0"
                  onClick={() => setConfirmAction('delete')}
                >
                  Delete permanently
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Request History */}
          {history.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Request History</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {history.map((entry) => {
                  const date = entry.reviewed_at ?? entry.created_at
                  const label = entry.type === 'new_profile' ? 'New profile request' : 'Edit submission'
                  const statusColor =
                    entry.status === 'approved' ? 'text-green-700 bg-green-50 border-green-200'
                    : entry.status === 'denied' ? 'text-red-700 bg-red-50 border-red-200'
                    : 'text-gray-600 bg-gray-50 border-gray-200'
                  return (
                    <div key={entry.id} className={`rounded-md border px-3 py-2 text-sm ${statusColor}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{label}</span>
                        <span className="text-xs opacity-75 shrink-0">
                          {new Date(date).toLocaleDateString('en-CA', { year: 'numeric', month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      <div className="text-xs mt-0.5 capitalize">{entry.status}</div>
                      {entry.rejection_note && (
                        <p className="text-xs mt-1 opacity-90">Reason: {entry.rejection_note}</p>
                      )}
                      {entry.admin_note && (
                        <p className="text-xs mt-1 opacity-75 italic">Note: {entry.admin_note}</p>
                      )}
                    </div>
                  )
                })}
              </CardContent>
            </Card>
          )}

          <div className="flex gap-2 sticky bottom-4 z-[1001] bg-white border border-amber-100 rounded-2xl p-3 shadow-lg">
            <Link href="/admin" className="flex-1">
              <Button type="button" variant="outline" className="w-full rounded-full">Cancel</Button>
            </Link>
            <Button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full font-semibold">Save Changes</Button>
          </div>
        </form>
      </div>

      <ConfirmDialog
        open={confirmAction === 'suspend'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Suspend this profile?"
        description={`The profile for "${house.slug || house.qr_code_id}" will be hidden from the map, listings, and public pages. The steward will not be able to edit it until you restore it. This is reversible.`}
        confirmLabel="Suspend"
        destructive
        withReason
        reasonPlaceholder="Optional, for your own admin records (not shown publicly)"
        onConfirm={(reason) => suspendHouse(reason)}
      />
      <ConfirmDialog
        open={confirmAction === 'unsuspend'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Restore this profile?"
        description={`"${house.slug || house.qr_code_id}" will be visible again on the map and public pages, and the steward will be able to edit it.`}
        confirmLabel="Restore"
        onConfirm={() => unsuspendHouse()}
      />
      <ConfirmDialog
        open={confirmAction === 'delete'}
        onOpenChange={(o) => { if (!o) setConfirmAction(null) }}
        title="Delete this profile permanently?"
        description={`This erases "${house.slug || house.qr_code_id}" and all of its images for good, and retires the access link so it can never be reused. This cannot be undone. (To just hide it, use the one-click Delete instead.)`}
        confirmLabel="Delete permanently"
        destructive
        requireTypedConfirmation={house.slug || house.qr_code_id}
        onConfirm={() => deleteHouse()}
      />

      <Toaster />
    </div>
  )
}
