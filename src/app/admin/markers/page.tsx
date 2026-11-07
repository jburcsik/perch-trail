'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import toast, { Toaster } from 'react-hot-toast'
import type { AdminMarkerData } from '@/components/AdminMarkersMap'
import { labelFromPattern, isValidLatLng } from '@/lib/markers'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useRouter } from 'next/navigation'

const AdminMarkersMap = dynamic(() => import('@/components/AdminMarkersMap'), {
  ssr: false,
  loading: () => <div className="h-full flex items-center justify-center text-gray-400">Loading map...</div>,
})

// Street dots: marker-only birdhouses. Admin-only labels; the public
// map shows these as small inert dots. CRUD goes straight through the
// authenticated Supabase client (RLS), matching the other admin pages.

interface MarkerRow extends AdminMarkerData {
  removed_at: string | null
  promoted_qr_code_id: string | null
  created_at: string
}

export default function AdminMarkersPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [promoteOpen, setPromoteOpen] = useState(false)
  const [promoting, setPromoting] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [authed, setAuthed] = useState(false)
  const [markers, setMarkers] = useState<MarkerRow[]>([])
  const [addMode, setAddMode] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [hoveredId, setHoveredId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'removed'>('all')
  const [search, setSearch] = useState('')
  const [namePattern, setNamePattern] = useState('Dot {n}')

  // Editor fields for the selected marker
  const [editLabel, setEditLabel] = useState('')
  const [editLat, setEditLat] = useState('')
  const [editLng, setEditLng] = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(Boolean(user))
      setLoading(false)
      if (user) fetchMarkers()
    })
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAddMode(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const fetchMarkers = async () => {
    // Promoted dots live in the houses admin; their rows survive to hold the
    // unique code claim.
    const { data, error } = await supabase
      .from('map_markers')
      .select('id, label, lat, lng, status, removed_at, promoted_qr_code_id, created_at')
      .neq('status', 'promoted')
      .order('created_at', { ascending: false })
    if (error) {
      toast.error('Failed to load markers')
      return
    }
    setMarkers(((data ?? []) as MarkerRow[]).filter((m) => m.status !== 'promoted'))
  }

  const selected = useMemo(() => markers.find((m) => m.id === selectedId) ?? null, [markers, selectedId])

  const selectMarker = (id: string) => {
    const m = markers.find((x) => x.id === id)
    if (!m) return
    setSelectedId(id)
    setEditLabel(m.label)
    setEditLat(m.lat.toFixed(6))
    setEditLng(m.lng.toFixed(6))
  }

  const addMarker = async (lat: number, lng: number) => {
    const label = labelFromPattern(namePattern || 'Dot {n}', markers.map((m) => m.label))
    const { data, error } = await supabase
      .from('map_markers')
      .insert({ label, lat, lng })
      .select('id, label, lat, lng, status, removed_at, promoted_qr_code_id, created_at')
      .single()
    if (error || !data) {
      toast.error('Failed to add dot')
      return
    }
    setMarkers((prev) => [data as MarkerRow, ...prev])
    toast.success(`Saved: ${label}`)
  }

  const saveSelected = async () => {
    if (!selected) return
    const lat = parseFloat(editLat)
    const lng = parseFloat(editLng)
    if (!editLabel.trim()) {
      toast.error('Give the dot a name')
      return
    }
    if (!isValidLatLng(lat, lng)) {
      toast.error("Those coordinates don't look right")
      return
    }
    const patch = { label: editLabel.trim(), lat, lng, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('map_markers').update(patch).eq('id', selected.id)
    if (error) {
      toast.error('Failed to save')
      return
    }
    setMarkers((prev) => prev.map((m) => (m.id === selected.id ? { ...m, ...patch } : m)))
    toast.success('Saved')
  }

  const setStatus = async (id: string, status: 'active' | 'removed') => {
    const patch = {
      status,
      removed_at: status === 'removed' ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    const { error } = await supabase.from('map_markers').update(patch).eq('id', id)
    if (error) {
      toast.error('Failed to update')
      return
    }
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    toast.success(status === 'removed' ? 'Marked removed' : 'Back on the street')
  }

  const moveMarker = async (id: string, lat: number, lng: number) => {
    const patch = { lat, lng, updated_at: new Date().toISOString() }
    const { error } = await supabase.from('map_markers').update(patch).eq('id', id)
    if (error) {
      toast.error('Failed to move. Reload before retrying')
      return
    }
    setMarkers((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)))
    if (id === selectedId) {
      setEditLat(lat.toFixed(6))
      setEditLng(lng.toFixed(6))
    }
    toast.success('Moved')
  }

  // Hard delete, for mis-drops and dots that were only ever placeholders.
  // "Mark removed" stays the right call for a real birdhouse that came down
  // (it keeps the when-did-it-come-down history); delete erases the row.
  const deleteSelected = async () => {
    if (!selected) return
    const { error } = await supabase.from('map_markers').delete().eq('id', selected.id)
    if (error) {
      toast.error('Failed to delete')
      return
    }
    setMarkers((prev) => prev.filter((m) => m.id !== selected.id))
    setSelectedId(null)
    setDeleteOpen(false)
    toast.success('Dot deleted')
  }

  const promoteSelected = async () => {
    if (!selected || promoting) return
    setPromoting(true)
    try {
      const res = await fetch(`/api/admin/markers/${selected.id}/promote`, { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(
          data.error === 'already_promoted' ? 'Already promoted'
          : data.error === 'no_unused_qr_codes' ? 'No unused access codes left. Generate more first'
          : 'Promotion failed'
        )
        return
      }
      // The dot graduates: off this page immediately (it's a birdhouse now).
      setMarkers((prev) => prev.filter((m) => m.id !== selected.id))
      setSelectedId(null)
      toast.success('Promoted. Finish the birdhouse profile')
      router.push(`/admin/houses/${data.qrCodeId}`)
    } finally {
      setPromoting(false)
      setPromoteOpen(false)
    }
  }

  const byStatus = statusFilter === 'all' ? markers : markers.filter((m) => m.status === statusFilter)
  const filtered = search.trim()
    ? byStatus.filter((m) => m.label.toLowerCase().includes(search.trim().toLowerCase()))
    : byStatus
  const activeCount = markers.filter((m) => m.status === 'active').length

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading...</div>
  }

  if (!authed) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center space-y-3">
            <p className="text-gray-600">Sign in from the admin dashboard first.</p>
            <Link href="/admin"><Button>Go to Admin Login</Button></Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Street Dots</h1>
            <p className="text-sm text-gray-500">
              {activeCount} active on the street; names here are never public
            </p>
          </div>
          <Link href="/admin"><Button variant="outline">Back to Admin</Button></Link>
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap mb-4 bg-white border rounded-xl px-4 py-3" data-testid="markers-toolbar">
          <Button
            onClick={() => setAddMode((v) => !v)}
            data-testid="add-dots-toggle"
            className={addMode ? 'bg-amber-600 hover:bg-amber-700 text-white rounded-full' : 'rounded-full bg-gray-200 hover:bg-gray-300 text-gray-800'}
          >
            {addMode ? '+ Add dots: click the map (Esc to stop)' : '+ Add dots'}
          </Button>
          {addMode && (
            <label className="flex items-center gap-2 text-sm text-gray-500">
              Name pattern
              <Input
                value={namePattern}
                onChange={(e) => setNamePattern(e.target.value)}
                data-testid="name-pattern-input"
                className="w-40 h-8"
                maxLength={60}
              />
              <span className="tabular-nums text-xs text-gray-400" data-testid="next-label-preview">
                next: {labelFromPattern(namePattern || 'Dot {n}', markers.map((m) => m.label))}
              </span>
            </label>
          )}
          <Button
            variant="outline"
            data-testid="drop-dot-here"
            className="rounded-full"
            onClick={() => {
              if (!navigator.geolocation) { toast.error('GPS unavailable'); return }
              navigator.geolocation.getCurrentPosition(
                (pos) => addMarker(pos.coords.latitude, pos.coords.longitude),
                () => toast.error('Could not get your location'),
                { enableHighAccuracy: true, timeout: 10000 }
              )
            }}
          >
            &#128205; Drop a dot where I am
          </Button>
          <span className="text-sm text-gray-500">
            {addMode ? 'Each click drops a dot and stays in add mode.' : 'Click a dot to rename it or fix its location; dots are also draggable.'}
          </span>
        </div>

        <div className="grid lg:grid-cols-3 gap-4 mb-6">
          {/* Map */}
          <div className="lg:col-span-2 h-[480px] rounded-xl overflow-hidden border bg-white" data-testid="markers-map">
            <AdminMarkersMap
              markers={filtered}
              selectedId={selectedId}
              hoveredId={hoveredId}
              addMode={addMode}
              onMapClick={addMarker}
              onMarkerClick={selectMarker}
              onMarkerHover={setHoveredId}
              onMarkerMove={moveMarker}
            />
          </div>

          {/* Editor */}
          <Card className="h-fit" data-testid="marker-editor">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">{selected ? 'Edit dot' : 'No dot selected'}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {!selected ? (
                <p className="text-sm text-gray-500">
                  Click a dot on the map, or a row below, to rename it or edit its exact coordinates
                  (handy when placing dots from home).
                </p>
              ) : (
                <>
                  <div>
                    <label htmlFor="marker-label" className="block text-sm font-medium mb-1">Name (admin-only)</label>
                    <Input id="marker-label" data-testid="marker-label-input" value={editLabel} onChange={(e) => setEditLabel(e.target.value)} maxLength={120} />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label htmlFor="marker-lat" className="block text-sm font-medium mb-1">Latitude</label>
                      <Input id="marker-lat" data-testid="marker-lat-input" value={editLat} onChange={(e) => setEditLat(e.target.value)} inputMode="decimal" />
                    </div>
                    <div className="flex-1">
                      <label htmlFor="marker-lng" className="block text-sm font-medium mb-1">Longitude</label>
                      <Input id="marker-lng" data-testid="marker-lng-input" value={editLng} onChange={(e) => setEditLng(e.target.value)} inputMode="decimal" />
                    </div>
                  </div>
                  <Button onClick={saveSelected} data-testid="marker-save" className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full">
                    Save
                  </Button>
                  <div className="flex gap-2">
                    {selected.status === 'active' && (
                      <Button
                        data-testid="marker-promote"
                        className="flex-1 rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                        onClick={() => setPromoteOpen(true)}
                      >
                        Promote
                      </Button>
                    )}
                    {selected.status === 'active' && (
                      <Button variant="outline" data-testid="marker-remove" className="flex-1 rounded-full" onClick={() => setStatus(selected.id, 'removed')}>
                        Mark removed
                      </Button>
                    )}
                    {selected.status === 'removed' && (
                      <Button variant="outline" data-testid="marker-restore" className="flex-1 rounded-full" onClick={() => setStatus(selected.id, 'active')}>
                        Back on the street
                      </Button>
                    )}
                  </div>
                  <button
                    type="button"
                    data-testid="marker-delete"
                    onClick={() => setDeleteOpen(true)}
                    className="w-full text-center text-xs text-red-600 hover:text-red-700 hover:underline pt-1"
                  >
                    Delete this dot permanently
                  </button>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Filters + table */}
        <div className="flex gap-2 mb-3 flex-wrap items-center">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search names..."
            data-testid="marker-search"
            className="w-52 h-9 rounded-full"
          />
          {(['all', 'active', 'removed'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setStatusFilter(f)}
              className={`text-sm font-medium rounded-full px-4 py-1.5 border ${statusFilter === f ? 'bg-amber-100 border-amber-400 text-amber-800' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
            >
              {f === 'all' ? `All: ${markers.length}` : `${f[0].toUpperCase()}${f.slice(1)}: ${markers.filter((m) => m.status === f).length}`}
            </button>
          ))}
        </div>
        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full min-w-[560px]" data-testid="markers-table">
            <thead>
              <tr className="border-b text-start text-xs uppercase tracking-wide text-gray-400">
                <th className="p-3">Name</th>
                <th className="p-3">Location</th>
                <th className="p-3">Status</th>
                <th className="p-3">Placed</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={4} className="p-6 text-center text-gray-400 text-sm">No dots yet. Flip on &quot;Add dots&quot; and click the street.</td></tr>
              ) : filtered.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => selectMarker(m.id)}
                  onMouseEnter={() => setHoveredId(m.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`border-b last:border-b-0 cursor-pointer ${m.id === selectedId ? 'bg-amber-50' : m.id === hoveredId ? 'bg-amber-50/60' : 'hover:bg-gray-50'}`}
                >
                  <td className="p-3 font-medium">{m.label}</td>
                  <td className="p-3 text-sm text-gray-500 tabular-nums">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</td>
                  <td className="p-3">
                    <span className={`text-xs font-bold rounded-full px-2.5 py-0.5 ${
                      m.status === 'active' ? 'bg-emerald-50 text-emerald-700'
                      : m.status === 'removed' ? 'bg-gray-100 text-gray-500'
                      : 'bg-amber-100 text-amber-800'
                    }`}>{m.status}</span>
                  </td>
                  <td className="p-3 text-sm text-gray-500">{m.created_at.slice(0, 10)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <ConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        title={selected ? `Delete "${selected.label}"?` : 'Delete this dot?'}
        description="This erases the dot completely: no history kept. Use 'Mark removed' instead if a real birdhouse came down and you want a record of it."
        confirmLabel="Delete permanently"
        destructive
        onConfirm={deleteSelected}
      />
      <ConfirmDialog
        open={promoteOpen}
        onOpenChange={setPromoteOpen}
        title={selected ? `Promote "${selected.label}"?` : 'Promote this dot?'}
        description="This mints a QR code and creates a birdhouse in Ready for Review at this dot's exact location. The dot stays on the public map until the new profile goes live. Your private name stays on the dot; the public name comes from the profile. Uses one code from the pool."
        confirmLabel={promoting ? 'Promoting...' : 'Promote to birdhouse'}
        onConfirm={promoteSelected}
      />
      <Toaster />
    </div>
  )
}
