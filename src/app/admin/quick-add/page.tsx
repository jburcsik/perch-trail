'use client'

import { useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast, { Toaster } from 'react-hot-toast'
import { slugify } from '@/lib/slug'
import { reserveQrCode } from '@/lib/qr-reserve'
import { isValidLatLng } from '@/lib/markers'
import { EN_LOCATION_LABELS } from '@/components/locationLabels'
import { compressImageForUpload, COMPRESSED_IMAGE_EXT, UPLOAD_FILE_OPTIONS } from '@/lib/image-compression'

const LocationPicker = dynamic(() => import('@/components/LocationPicker'), { ssr: false })

// Quick Add: in the field. See a birdhouse, snap a photo, name it,
// save. Creates a 'review' house at the current GPS position (finishable at
// home from the Ready for Review bucket). No photo moment? Drop a dot
// instead: same location, same name as the dot's label, no QR consumed.

export default function QuickAddPage() {
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [lat, setLat] = useState<number | null>(null)
  const [lng, setLng] = useState<number | null>(null)
  const [geoState, setGeoState] = useState<'locating' | 'done' | 'failed'>('locating')
  // Bumped per geolocation fix; keys the picker so a GPS fix recentres it.
  const [geoRun, setGeoRun] = useState(0)
  const [name, setName] = useState('')
  const [photo, setPhoto] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState<{ kind: 'house'; qrCodeId: string } | { kind: 'dot' } | null>(null)
  const cameraRef = useRef<HTMLInputElement | null>(null)
  const libraryRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setAuthed(Boolean(user)))
  }, [])

  const locate = () => {
    setGeoState('locating')
    if (!navigator.geolocation) { setGeoState('failed'); return }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude)
        setLng(pos.coords.longitude)
        setGeoState('done')
        setGeoRun((n) => n + 1)
      },
      () => setGeoState('failed'),
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }
  useEffect(locate, [])

  const requireInputs = (): { slug: string; lat: number; lng: number } | null => {
    const slug = slugify(name)
    if (!slug) { toast.error('Give it a name first'); return null }
    if (lat === null || lng === null || !isValidLatLng(lat, lng)) {
      toast.error('Waiting for a location. Drop the pin on the map')
      return null
    }
    return { slug, lat, lng }
  }

  // Same path as the steward upload: signed URL, direct upload, then the record.
  // Best effort: a failed upload never loses the house.
  const uploadPhoto = async (qrCodeId: string, editCode: string, file: File): Promise<boolean> => {
    try {
      const compressed = await compressImageForUpload(file)
      const signRes = await fetch('/api/house/images/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qr_code_id: qrCodeId, edit_code: editCode, ext: COMPRESSED_IMAGE_EXT }),
      })
      if (!signRes.ok) return false
      const { token, path, storage_path, image_url } = await signRes.json()
      const { error: upErr } = await supabase.storage
        .from('house-images')
        .uploadToSignedUrl(path, token, compressed, UPLOAD_FILE_OPTIONS)
      if (upErr) return false
      const rec = await fetch('/api/house/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          qr_code_id: qrCodeId,
          edit_code: editCode,
          image_url,
          storage_path,
          display_order: 1,
          file_size_kb: Math.round(compressed.size / 1024),
        }),
      })
      return rec.ok
    } catch {
      return false
    }
  }

  const saveHouse = async () => {
    const inputs = requireInputs()
    if (!inputs || busy) return
    setBusy(true)
    try {
      const reserved = await reserveQrCode(supabase)
      if ('err' in reserved) { toast.error('Could not reserve an access code'); return }
      const now = new Date().toISOString()
      const { error } = await supabase.from('houses').insert({
        qr_code_id: reserved.id,
        slug: inputs.slug,
        lat: inputs.lat,
        lng: inputs.lng,
        status: 'review',
        claimed_at: now,
        updated_at: now,
      })
      if (error) { toast.error('Failed to save the birdhouse'); return }
      if (photo) {
        const ok = await uploadPhoto(reserved.id, reserved.editCode, photo)
        if (!ok) toast('Saved, but the photo upload failed. Add it in the editor', { icon: '\u{26A0}\u{FE0F}', duration: 7000 })
      }
      setDone({ kind: 'house', qrCodeId: reserved.id })
    } finally {
      setBusy(false)
    }
  }

  const dropDotInstead = async () => {
    const inputs = requireInputs()
    if (!inputs || busy) return
    setBusy(true)
    try {
      const { error } = await supabase.from('map_markers').insert({ label: name.trim(), lat: inputs.lat, lng: inputs.lng })
      if (error) { toast.error('Failed to drop the dot'); return }
      setDone({ kind: 'dot' })
    } finally {
      setBusy(false)
    }
  }

  const clearPhoto = () => {
    setPhoto(null)
    if (cameraRef.current) cameraRef.current.value = ''
    if (libraryRef.current) libraryRef.current.value = ''
  }

  const reset = () => {
    setDone(null)
    setName('')
    clearPhoto()
    locate()
  }

  if (authed === null) return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-md"><CardContent className="p-6 text-center space-y-3">
          <p className="text-gray-600">Sign in from the admin dashboard first.</p>
          <Link href="/admin"><Button>Go to Admin Login</Button></Link>
        </CardContent></Card>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-screen bg-gray-100 p-4 flex items-center justify-center">
        <Toaster />
        <Card className="w-full max-w-md" data-testid="quick-add-success">
          <CardContent className="p-6 text-center space-y-4">
            <p className="text-4xl">&#127968;</p>
            <h1 className="text-xl font-bold">
              {done.kind === 'house' ? 'On the trail, finish it anytime' : 'Dot dropped'}
            </h1>
            <p className="text-sm text-gray-500">
              {done.kind === 'house'
                ? 'It\u{2019}s waiting in Ready for Review. Polish the story and photos at home, then approve it.'
                : 'It\u{2019}s on the map as a street dot; promote it whenever it earns a page.'}
            </p>
            <div className="flex flex-col gap-2">
              <Button onClick={reset} data-testid="quick-add-again" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full">
                Add another
              </Button>
              {done.kind === 'house' && (
                <Link href={`/admin/houses/${done.qrCodeId}`}>
                  <Button variant="outline" className="w-full rounded-full">Open full editor</Button>
                </Link>
              )}
              <Link href="/admin" className="text-sm text-gray-500 hover:underline pt-1">Back to Admin</Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-md mx-auto space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Quick add</h1>
          <Link href="/admin"><Button variant="outline" size="sm">Admin</Button></Link>
        </div>

        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label htmlFor="qa-name" className="block text-sm font-medium mb-1.5">Birdhouse name</label>
              <Input
                id="qa-name"
                data-testid="quick-add-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Sunny Corner House"
                maxLength={60}
              />
            </div>

            <div>
              <span className="block text-sm font-medium mb-1.5">Photo</span>
              <input
                ref={cameraRef}
                data-testid="quick-add-photo"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f) }}
                className="hidden"
              />
              <input
                ref={libraryRef}
                data-testid="quick-add-photo-library"
                type="file"
                accept="image/*"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) setPhoto(f) }}
                className="hidden"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  data-testid="quick-add-take-photo"
                  onClick={() => cameraRef.current?.click()}
                  className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-full"
                >
                  Take photo
                </Button>
                <Button
                  type="button"
                  data-testid="quick-add-choose-photo"
                  variant="outline"
                  onClick={() => libraryRef.current?.click()}
                  className="flex-1 rounded-full"
                >
                  Choose photo
                </Button>
              </div>
              {photo ? (
                <p className="text-xs text-gray-600 mt-1 flex items-center gap-2">
                  <span className="truncate">{photo.name}</span>
                  <button type="button" onClick={clearPhoto} className="text-amber-700 hover:underline shrink-0">Remove</button>
                </p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">Optional, but now&apos;s the moment.</p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium">Location</span>
                <button type="button" onClick={locate} className="text-xs text-amber-700 hover:underline">
                  {geoState === 'locating' ? 'Locating...' : '\u{1F4CD} Use my location'}
                </button>
              </div>
              <div className="h-52 rounded-lg overflow-hidden border">
                <LocationPicker
                  key={geoRun}
                  initialLat={lat}
                  initialLng={lng}
                  onChange={(la, ln) => { setLat(la); setLng(ln) }}
                  onGeoError={(m) => toast.error(m)}
                  labels={EN_LOCATION_LABELS}
                />
              </div>
              <p className="text-xs text-gray-400 mt-1 tabular-nums" data-testid="quick-add-coords">
                {lat !== null && lng !== null ? `${lat.toFixed(5)}, ${lng.toFixed(5)}` : geoState === 'failed' ? 'GPS unavailable. Drop the pin by hand' : 'Locating...'}
              </p>
            </div>

            <Button
              onClick={saveHouse}
              disabled={busy}
              data-testid="quick-add-save"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-3 font-semibold text-lg disabled:opacity-50"
            >
              {busy ? 'Saving...' : 'Save birdhouse'}
            </Button>
            <button
              type="button"
              onClick={dropDotInstead}
              disabled={busy}
              data-testid="quick-add-dot-instead"
              className="w-full text-center text-sm text-amber-700 hover:underline disabled:opacity-50"
            >
              No photo moment? Drop a dot here instead
            </button>
          </CardContent>
        </Card>
      </div>
      <Toaster />
    </div>
  )
}
