'use client'

import { useEffect, useRef, useState } from 'react'
import { useTranslations } from 'next-intl'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import L from 'leaflet'
import { trackSelectContent } from '@/lib/analytics'
import { photoMarkerHtml, PHOTO_MARKER_SIZE } from '@/lib/markers'
import { focusOffsetY } from '@/lib/mapFocus'
import { readMapCamera, writeMapCamera } from '@/lib/mapView'
import {
  BASEMAP_ATTRIBUTION,
  BASEMAP_PROVIDER_MAX_ZOOM,
  BASEMAP_TILE_URL,
} from '@/lib/basemap'
import { MAP_CENTER, MAP_ZOOM } from '@/config/site'

// The view the map opens on when no house is selected.
const TRAIL_CENTER: [number, number] = MAP_CENTER
const DEFAULT_ZOOM = MAP_ZOOM

export interface HouseMapData {
  qr_code_id: string
  slug: string | null
  status: string
  artist_name: string | null
  bio: string | null
  /** Source language of `bio`. Defaults to 'en' when absent. */
  bio_source_locale?: string | null
  /** Translation of `bio` into the current view locale, if one exists. */
  bio_translated?: string | null
  lat: number
  lng: number
  is_invited_artist?: boolean
  first_image_url?: string | null
  tags?: string[]
}

/** Street dot: a birdhouse on the trail without a page, position only. */
export interface MapMarkerData {
  id: string
  lat: number
  lng: number
}

interface MapProps {
  onHouseSelect?: (house: HouseMapData) => void
  /** Fired on marker mouseover/out so the gallery can mirror it. */
  onHouseHover?: (id: string | null) => void
  activeHouse?: HouseMapData | null
  highlightedHouseId?: string | null
  /** Pre-fetched houses from parent (skips internal fetch) */
  houses?: HouseMapData[]
  /** Street dots, rendered as small inert circles beneath the pins. */
  markers?: MapMarkerData[]
  /** Read-only single-pin view for house detail page */
  singleHouse?: HouseMapData | null
  /** Fully static preview: no pan/zoom/click, zoom level 16 */
  isStatic?: boolean
  /** Pixels of the map viewport obscured by chrome (the Map/List pill above,
   * the bottom sheet below), so the focused house lands in the clear band
   * instead of behind that chrome. */
  focusInsets?: { top: number; bottom: number }
  /** Bumped on every selection so re-selecting the same house still recentres. */
  focusNonce?: number
  /** Restore and save the camera in sessionStorage; only /map opts in. */
  persistCamera?: boolean
}

/**
 * Leaflet's default zoom/attribution controls always sit at their
 * hardcoded corners regardless of page dir; on /ar they end up on the
 * "wrong" side for RTL reading. MapContainer's zoomControl/attributionControl
 * props only take a boolean, not a position, so both are disabled there and
 * added here explicitly, mirrored to the opposite corner for RTL.
 */
function DirectionalControls({ dir, showZoom }: { dir: 'ltr' | 'rtl'; showZoom: boolean }) {
  const map = useMap()
  useEffect(() => {
    const zoomPosition = dir === 'rtl' ? 'topright' : 'topleft'
    const attributionPosition = dir === 'rtl' ? 'bottomleft' : 'bottomright'

    const zoomControl = showZoom ? L.control.zoom({ position: zoomPosition }).addTo(map) : null
    const attributionControl = L.control.attribution({ position: attributionPosition }).addTo(map)

    return () => {
      zoomControl?.remove()
      attributionControl.remove()
    }
  }, [map, dir, showZoom])
  return null
}

function MapCenterer({
  house,
  zoom,
  insets,
  focusNonce,
}: {
  house: HouseMapData | null | undefined
  /** Fixed zoom to focus at (used only by the singleHouse profile mini-map,
   * which is non-interactive and always shows zoom 17). Omitted for the
   * multi-house /map case; recentring there uses whatever zoom the
   * map is currently at (map.getZoom()), so focusing a house never re-zooms
   * out from under the user. */
  zoom?: number
  insets?: { top: number; bottom: number }
  /** Bumped on every selection, including re-selecting the same house
   * (see MapProps.focusNonce). */
  focusNonce?: number
}) {
  const map = useMap()
  // Insets come from a ref, not the dependency array: only a new selection
  // recentres the map, never a later inset measurement.
  const insetsRef = useRef({ top: 0, bottom: 0 })
  insetsRef.current = { top: insets?.top ?? 0, bottom: insets?.bottom ?? 0 }
  useEffect(() => {
    if (house?.lat == null || house?.lng == null) return
    const { top, bottom } = insetsRef.current
    const z = zoom ?? map.getZoom()
    if (!top && !bottom) {
      map.setView([house.lat, house.lng], z)
      return
    }
    // Centre the marker in the band left clear by the pill above and the sheet below.
    const size = map.getSize()
    const offsetY = focusOffsetY(size.y, top, bottom)
    const target = map.project([house.lat, house.lng], z).add([0, offsetY])
    map.setView(map.unproject(target, z), z)
  }, [house, map, zoom, focusNonce])
  return null
}

/**
 * Camera persistence saves lat/lng/zoom to sessionStorage on every
 * pan/zoom so /map restores the user's chosen view instead of resetting to
 * the trail default. `enabled` gates this entirely off for callers that
 * don't opt in (singleHouse, isStatic); see MapProps.persistCamera.
 */
function CameraPersister({ enabled }: { enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled) return
    const save = () => {
      const center = map.getCenter()
      writeMapCamera({ lat: center.lat, lng: center.lng, zoom: map.getZoom() })
    }
    map.on('moveend', save)
    map.on('zoomend', save)
    return () => {
      map.off('moveend', save)
      map.off('zoomend', save)
    }
  }, [map, enabled])
  return null
}

// Marker icons

/** No-image pin: amber teardrop, easy to spot. Glows when highlighted. */
function makeNoImagePin(highlighted: boolean): L.DivIcon {
  const w = highlighted ? 38 : 32
  const h = highlighted ? 50 : 42
  const glow = highlighted ? 'filter:drop-shadow(0 0 6px rgba(217,119,6,0.8))' : ''
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 32 42" style="${glow};transition:all 0.15s ease">
      <path d="M16 0C8.268 0 2 6.268 2 14c0 10 14 28 14 28S30 24 30 14C30 6.268 23.732 0 16 0z"
        fill="${highlighted ? '#b45309' : '#d97706'}" stroke="#fff" stroke-width="2"/>
    </svg>`,
    className: '',
    iconSize: [w, h],
    iconAnchor: [w / 2, h],
    popupAnchor: [0, -h],
  })
}

/** Circular photo marker. HTML string building lives in lib/markers.ts;
 * this stays a thin wrapper binding that HTML into a Leaflet divIcon. */
function makePhotoMarker(imageUrl: string, highlighted: boolean): L.DivIcon {
  const half = PHOTO_MARKER_SIZE / 2
  return L.divIcon({
    html: photoMarkerHtml(imageUrl, highlighted),
    className: '',
    iconSize: [PHOTO_MARKER_SIZE, PHOTO_MARKER_SIZE],
    iconAnchor: [half, half],
    popupAnchor: [0, -half],
  })
}

// Icon cache: react-leaflet replaces a marker's icon whenever it receives a
// new object, so icons are cached per house and highlight state; a house's
// image URL is part of the key so a photo change still busts the entry.
// (A plain object, not a Map: the default export below shadows global Map.)
const iconCache: Record<string, L.DivIcon> = {}

function getMarkerIcon(house: HouseMapData, highlighted: boolean): L.DivIcon {
  const key = `${house.qr_code_id}|${house.first_image_url ?? ''}|${highlighted ? 1 : 0}`
  let icon = iconCache[key]
  if (!icon) {
    icon = house.first_image_url
      ? makePhotoMarker(house.first_image_url, highlighted)
      : makeNoImagePin(highlighted)
    iconCache[key] = icon
  }
  return icon
}

/**
 * Street dot: one shared inert icon for every dot on the map.
 * Sun-faded amber: same family as the pins at half strength, so dots read as
 * "a birdhouse lives here" while the tappable tiers keep the spotlight. Flat
 * small circle (clearly not a pin) so it never invites a tap.
 */
const STREET_DOT_ICON = L.divIcon({
  html: '<div aria-hidden="true" style="width:14px;height:14px;border-radius:50%;background:rgba(217,119,6,0.5);border:2px solid #fff;box-shadow:0 0 0 1px rgba(0,0,0,0.06)"></div>',
  className: '',
  iconSize: [14, 14],
  iconAnchor: [7, 7],
})

// Component

export default function Map({
  onHouseSelect,
  onHouseHover,
  activeHouse,
  highlightedHouseId,
  houses: propHouses,
  markers: propMarkers,
  singleHouse,
  isStatic = false,
  focusInsets,
  focusNonce,
  persistCamera = false,
}: MapProps) {
  const t = useTranslations('MapPage')
  // Read dir from <html>, which the root layout sets server-side; Intl.Locale
  // text direction is not available in every browser.
  const [dir, setDir] = useState<'ltr' | 'rtl'>('ltr')
  const [fetchedHouses, setFetchedHouses] = useState<HouseMapData[]>([])
  const [fetchedMarkers, setFetchedMarkers] = useState<MapMarkerData[]>([])
  const [isClient, setIsClient] = useState(false)
  // Map-side hover: highlight the marker under the cursor and raise it
  // above overlapping neighbours so it's clear which one a click will hit.
  const [mapHoverId, setMapHoverId] = useState<string | null>(null)

  useEffect(() => {
    setIsClient(true)
    setDir(document.documentElement.dir === 'rtl' ? 'rtl' : 'ltr')
    // Skip fetch when parent provides houses or we're in single-house mode
    if (propHouses !== undefined || singleHouse) return

    const fetchHouses = async () => {
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase
        .from('houses')
        .select('qr_code_id, slug, status, artist_name, bio, lat, lng, is_invited_artist, tags')
        .eq('status', 'live')
        .is('archived_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (!error && data) {
        setFetchedHouses(data.map(h => ({ ...h, is_invited_artist: h.is_invited_artist ?? false, tags: h.tags ?? [] })))
      }

      // Street dots. Columns must be explicit: anon only has SELECT
      // on id/lat/lng; visibility is decided by the RLS policy.
      const { data: markerData } = await supabase
        .from('map_markers')
        .select('id, lat, lng')
      if (markerData) setFetchedMarkers(markerData)
    }

    fetchHouses()
  }, [propHouses, singleHouse])

  if (!isClient) {
    return <div className="h-full flex items-center justify-center text-gray-500">{t('loadingMap')}</div>
  }

  const visibleHouses = singleHouse ? [singleHouse] : (propHouses ?? fetchedHouses)
  const visibleMarkers = singleHouse ? [] : (propMarkers ?? fetchedMarkers)

  // Only /map opts in (persistCamera); the profile mini-map and
  // homepage preview never read this, so their fixed centre/zoom is
  // unaffected regardless of what's in storage.
  const storedCamera = persistCamera ? readMapCamera() : null

  const initialCenter: [number, number] =
    singleHouse?.lat && singleHouse?.lng
      ? [singleHouse.lat, singleHouse.lng]
      : activeHouse?.lat && activeHouse?.lng
        ? [activeHouse.lat, activeHouse.lng]
        : storedCamera
          ? [storedCamera.lat, storedCamera.lng]
          : TRAIL_CENTER

  const initialZoom = isStatic
    ? 17
    : singleHouse
      ? 17
      : storedCamera
        ? storedCamera.zoom
        : DEFAULT_ZOOM

  const interactive = !isStatic && !singleHouse

  return (
    <div className="relative h-full">
      <MapContainer
        center={initialCenter}
        zoom={initialZoom}
        style={{ height: '100%', width: '100%' }}
        scrollWheelZoom={interactive}
        dragging={interactive}
        doubleClickZoom={interactive}
        touchZoom={interactive}
        keyboard={interactive}
        zoomControl={false}
        attributionControl={false}
        maxZoom={20}
      >
        <DirectionalControls dir={dir} showZoom={!isStatic} />
        <MapCenterer
          house={singleHouse ?? activeHouse}
          zoom={singleHouse ? 17 : undefined}
          insets={singleHouse ? undefined : focusInsets}
          focusNonce={focusNonce}
        />
        <CameraPersister enabled={persistCamera} />
        {/* Stadia serves tiles natively to z20; the cap matches, so max zoom
            never shows upscaled tiles. */}
        <TileLayer
          url={BASEMAP_TILE_URL}
          attribution={BASEMAP_ATTRIBUTION}
          maxZoom={20}
          maxNativeZoom={BASEMAP_PROVIDER_MAX_ZOOM}
        />
        {/* Street dots: fully inert, no click, hover, tooltip, or
            focus. Negative zIndexOffset keeps them beneath every pin/photo.
            Keys are namespaced so a dot id can never collide with a house's
            qr_code_id key. */}
        {visibleMarkers.map((m) => (
          <Marker
            key={`m-${m.id}`}
            position={[m.lat, m.lng]}
            icon={STREET_DOT_ICON}
            interactive={false}
            keyboard={false}
            zIndexOffset={-1000}
          />
        ))}
        {visibleHouses.map((house) => {
          const hot = highlightedHouseId === house.qr_code_id || mapHoverId === house.qr_code_id
          return (
            <Marker
              key={house.qr_code_id}
              position={[house.lat, house.lng]}
              icon={getMarkerIcon(house, hot)}
              zIndexOffset={hot ? 1000 : 0}
              eventHandlers={{
                ...(onHouseSelect
                  ? {
                      click: () => {
                        trackSelectContent('birdhouse_pin', house.qr_code_id)
                        onHouseSelect(house)
                      },
                    }
                  : {}),
                // Hover affordances only on the interactive map.
                ...(interactive
                  ? {
                      mouseover: () => { setMapHoverId(house.qr_code_id); onHouseHover?.(house.qr_code_id) },
                      mouseout: () => { setMapHoverId(null); onHouseHover?.(null) },
                    }
                  : {}),
              }}
            />
          )
        })}
      </MapContainer>
    </div>
  )
}
