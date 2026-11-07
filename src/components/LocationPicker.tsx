'use client'

import { useEffect, useRef, useState } from 'react'
import { MapContainer, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import type { Map as LeafletMap } from 'leaflet'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import type { LocationPickerLabels } from '@/components/locationLabels'
import { MAP_CENTER } from '@/config/site'

const DEFAULT_LAT = MAP_CENTER[0]
const DEFAULT_LNG = MAP_CENTER[1]

interface LocationPickerProps {
  initialLat?: number | null
  initialLng?: number | null
  /** Updates parent form state. Called on every confirmed change (incl. clear to null). */
  onChange: (lat: number | null, lng: number | null) => void
  /**
   * Optional immediate persistence. When provided, a confirmed change is written
   * to the DB right away (separate from the main form Save). Absent on the create
   * flow, where there's no record yet; the component then just updates form state.
   */
  onImmediateSave?: (lat: number | null, lng: number | null) => Promise<void>
  /** Surface geolocation / save errors (parent owns its toast/i18n). */
  onGeoError?: (message: string) => void
  labels: LocationPickerLabels
}

type Point = { lat: number; lng: number }

/**
 * Bridges Leaflet events to React. Listens for `dragend` (user-initiated pans
 * only); programmatic `setView` (revert + geolocation recenter) does NOT emit
 * `dragend`, so reverting can't loop and recentering can't re-trigger the prompt.
 */
function MapBridge({
  onUserDrag,
  mapRef,
}: {
  onUserDrag: (lat: number, lng: number) => void
  mapRef: React.MutableRefObject<LeafletMap | null>
}) {
  const map = useMap()
  useEffect(() => {
    mapRef.current = map
  }, [map, mapRef])
  useMapEvents({
    dragend() {
      const c = map.getCenter()
      onUserDrag(c.lat, c.lng)
    },
  })
  return null
}

export default function LocationPicker({
  initialLat,
  initialLng,
  onChange,
  onImmediateSave,
  onGeoError,
  labels,
}: LocationPickerProps) {
  const seed: Point | null =
    initialLat != null && initialLng != null ? { lat: initialLat, lng: initialLng } : null

  const [committed, setCommitted] = useState<Point | null>(seed)
  const [pendingDrag, setPendingDrag] = useState<Point | null>(null)
  const [showSuccess, setShowSuccess] = useState(false)
  const [showClearConfirm, setShowClearConfirm] = useState(false)
  const [saving, setSaving] = useState(false)

  const mapRef = useRef<LeafletMap | null>(null)
  const successTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (successTimer.current) clearTimeout(successTimer.current) }, [])

  const flashSuccess = () => {
    setShowSuccess(true)
    if (successTimer.current) clearTimeout(successTimer.current)
    successTimer.current = setTimeout(() => setShowSuccess(false), 4000)
  }

  const recenter = (lat: number, lng: number, zoom?: number) => {
    const map = mapRef.current
    if (map) map.setView([lat, lng], zoom ?? map.getZoom())
  }

  // Confirmed change: update form state, persist if possible, then celebrate.
  const commit = async (lat: number | null, lng: number | null) => {
    setCommitted(lat != null && lng != null ? { lat, lng } : null)
    onChange(lat, lng)

    if (onImmediateSave) {
      setSaving(true)
      try {
        await onImmediateSave(lat, lng)
      } catch {
        onGeoError?.(labels.saveFailed)
        setSaving(false)
        return
      }
      setSaving(false)
    }

    // Only celebrate when a location is actually set (clearing is its own confirm).
    if (lat != null && lng != null) flashSuccess()
  }

  const useCurrent = () => {
    if (!navigator.geolocation) {
      onGeoError?.(labels.geoUnsupported)
      return
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        recenter(coords.latitude, coords.longitude, 17)
        commit(coords.latitude, coords.longitude)
      },
      () => onGeoError?.(labels.geoFailed)
    )
  }

  const onUserDrag = (lat: number, lng: number) => setPendingDrag({ lat, lng })

  const confirmDrag = () => {
    if (!pendingDrag) return
    const p = pendingDrag
    setPendingDrag(null)
    commit(p.lat, p.lng)
  }

  const cancelDrag = () => {
    setPendingDrag(null)
    if (committed) recenter(committed.lat, committed.lng)
    else recenter(DEFAULT_LAT, DEFAULT_LNG)
  }

  const confirmClear = () => {
    setShowClearConfirm(false)
    recenter(DEFAULT_LAT, DEFAULT_LNG)
    commit(null, null)
  }

  const startLat = committed?.lat ?? DEFAULT_LAT
  const startLng = committed?.lng ?? DEFAULT_LNG

  return (
    <div className="space-y-2">
      <div
        className="relative rounded-xl overflow-hidden border-2 border-gray-200"
        style={{ height: '240px' }}
        data-testid="location-picker"
      >
        <MapContainer
          center={[startLat, startLng]}
          zoom={17}
          style={{ height: '100%', width: '100%' }}
          scrollWheelZoom={false}
          dragging={true}
          touchZoom={true}
          attributionControl={false}
          maxZoom={20}
        >
          {/* OSM serves tiles to z19; z20 upscales one level so pin placement
              gets the same zoom depth as the main map. */}
          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" maxZoom={20} maxNativeZoom={19} />
          <MapBridge onUserDrag={onUserDrag} mapRef={mapRef} />
        </MapContainer>

        {/* Fixed center crosshair marks the selected point while the map moves */}
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 1000 }}
        >
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="18" cy="18" r="5" fill="#ef4444" stroke="white" strokeWidth="2.5" />
            <line x1="18" y1="2" x2="18" y2="11" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="18" y1="25" x2="18" y2="34" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="2" y1="18" x2="11" y2="18" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="25" y1="18" x2="34" y2="18" stroke="#ef4444" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        </div>
      </div>

      {/* Drag-confirm bar: inline, non-blocking. Isolated so it's easy to swap. */}
      {pendingDrag && (
        <div
          className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2"
          data-testid="location-drag-confirm"
        >
          <p className="text-sm text-amber-800 font-medium">{labels.dragQuestion}</p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              onClick={confirmDrag}
              disabled={saving}
              className="flex-1 bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="drag-confirm-yes"
            >
              {labels.yes}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={cancelDrag}
              disabled={saving}
              className="flex-1"
              data-testid="drag-confirm-no"
            >
              {labels.no}
            </Button>
          </div>
        </div>
      )}

      {/* Inline success: friendly, polite live region, self-dismissing. No toast. */}
      {showSuccess && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm font-medium text-green-800"
          data-testid="location-success"
        >
          <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true" className="shrink-0">
            <path fillRule="evenodd" d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.3 6.8-6.8a1 1 0 0 1 1.4 0z" clipRule="evenodd" />
          </svg>
          {labels.successMessage}
        </div>
      )}

      {/* Buttons: primary geolocation + secondary clear */}
      <div className="flex gap-2">
        <Button
          type="button"
          onClick={useCurrent}
          disabled={saving}
          className="flex-1"
          data-testid="location-use-current"
        >
          &#128205; {labels.useCurrentLocation}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setShowClearConfirm(true)}
          disabled={saving || !committed}
          data-testid="location-clear"
        >
          {labels.clearLocation}
        </Button>
      </div>

      <ConfirmDialog
        open={showClearConfirm}
        onOpenChange={setShowClearConfirm}
        title={labels.clearTitle}
        description={labels.clearBody}
        confirmLabel={labels.clearConfirm}
        cancelLabel={labels.cancel}
        destructive
        onConfirm={confirmClear}
      />
    </div>
  )
}
