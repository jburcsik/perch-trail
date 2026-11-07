'use client'

import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_PROVIDER_MAX_ZOOM,
  BASEMAP_TILE_URL,
} from '@/lib/basemap'
import { MAP_CENTER } from '@/config/site'

// Street-dot admin map. Unlike the public map, dots here ARE
// interactive: click to select/edit, click the street in add mode to drop one.

const TRAIL_CENTER: [number, number] = MAP_CENTER
const DEFAULT_ZOOM = 17

export interface AdminMarkerData {
  id: string
  label: string
  lat: number
  lng: number
  status: 'active' | 'removed' | 'promoted'
}

// Singleton icons: one divIcon per visual state, shared by every marker.
const dotIcon = (bg: string, ring: string, size: number) =>
  L.divIcon({
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid #fff;box-shadow:0 0 0 ${ring}"></div>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })

// Promoted markers never reach this map (they graduate to the houses admin)
// so only active/removed need icons.
const ICONS = {
  active: dotIcon('rgba(217,119,6,.85)', '1px rgba(0,0,0,.15)', 16),
  removed: dotIcon('rgba(107,114,128,.55)', '1px rgba(0,0,0,.1)', 14),
  selected: dotIcon('rgba(180,83,9,1)', '4px rgba(217,119,6,.45)', 20),
  hovered: dotIcon('rgba(180,83,9,.95)', '3px rgba(217,119,6,.35)', 18),
}

function ClickCatcher({ addMode, onMapClick }: { addMode: boolean; onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      if (addMode) onMapClick(e.latlng.lat, e.latlng.lng)
    },
  })
  return null
}

export default function AdminMarkersMap({
  markers,
  selectedId,
  hoveredId,
  addMode,
  onMapClick,
  onMarkerClick,
  onMarkerHover,
  onMarkerMove,
}: {
  markers: AdminMarkerData[]
  selectedId: string | null
  hoveredId?: string | null
  addMode: boolean
  onMapClick: (lat: number, lng: number) => void
  onMarkerClick: (id: string) => void
  onMarkerHover?: (id: string | null) => void
  onMarkerMove?: (id: string, lat: number, lng: number) => void
}) {
  return (
    <MapContainer
      center={TRAIL_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: '100%', width: '100%', cursor: addMode ? 'crosshair' : undefined }}
      scrollWheelZoom
      maxZoom={20}
    >
      <TileLayer
        attribution={BASEMAP_ATTRIBUTION}
        url={BASEMAP_TILE_URL}
        maxZoom={20}
        maxNativeZoom={BASEMAP_PROVIDER_MAX_ZOOM}
      />
      <ClickCatcher addMode={addMode} onMapClick={onMapClick} />
      {markers.map((m) => (
        <Marker
          key={`m-${m.id}`}
          position={[m.lat, m.lng]}
          icon={m.id === selectedId ? ICONS.selected : m.id === hoveredId ? ICONS.hovered : (m.status === 'removed' ? ICONS.removed : ICONS.active)}
          // Drag-to-move is disabled while in add mode so a drop can't turn
          // into an accidental drag of a neighbouring dot.
          draggable={!addMode && Boolean(onMarkerMove)}
          eventHandlers={{
            click: () => onMarkerClick(m.id),
            mouseover: () => onMarkerHover?.(m.id),
            mouseout: () => onMarkerHover?.(null),
            dragend: (e) => {
              const ll = (e.target as L.Marker).getLatLng()
              onMarkerMove?.(m.id, ll.lat, ll.lng)
            },
          }}
          zIndexOffset={m.id === selectedId || m.id === hoveredId ? 1000 : 0}
        />
      ))}
    </MapContainer>
  )
}
