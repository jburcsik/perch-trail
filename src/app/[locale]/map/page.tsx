'use client'

import { useState, useEffect, useLayoutEffect, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Link } from '@/i18n/navigation'
import dynamic from 'next/dynamic'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { BirdhousePhoto } from '@/components/BirdhousePhoto'
import type { HouseMapData, MapMarkerData } from '@/components/Map'
import { trackSelectContent } from '@/lib/analytics'
import { IMG_CARD, IMG_HERO } from '@/lib/images'
import { useIsDesktop } from '@/lib/useIsDesktop'
import {
  readMapViewMode,
  writeMapViewMode,
  type MapViewMode,
  readListScrollTop,
  writeListScrollTop,
} from '@/lib/mapView'

const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false })

function slugToUrl(slug: string): string {
  return slug.replace(/\s+/g, '-').toLowerCase()
}

function displayName(house: HouseMapData): string {
  return house.slug
    ? house.slug.split(/[-\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    : house.qr_code_id
}

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

// Bottom sheet (shown when a map marker is tapped, mobile only)

function HouseSheet({
  house,
  onClose,
  sheetRef,
}: {
  house: HouseMapData
  onClose: () => void
  sheetRef: React.RefObject<HTMLDivElement | null>
}) {
  const t = useTranslations('MapPage')
  const houseUrl = house.slug ? `/v/${slugToUrl(house.slug)}` : `/h/${house.qr_code_id}`

  return (
    <>
      {/* Backdrop: mobile-only surface, so it can cover the whole viewport */}
      <div className="fixed inset-0 z-[9000]" onClick={onClose} />

      {/* Sheet panel: a bounded flex column so the CTA footer never scrolls
          off screen, no matter how tall the photo or how long the name. */}
      <div
        ref={sheetRef}
        data-testid="house-sheet"
        className="fixed bottom-0 start-0 end-0 z-[9999] flex flex-col bg-white rounded-t-3xl shadow-2xl max-h-[70vh]"
      >
        {/* Drag handle + close */}
        <div className="flex items-center justify-between px-6 pt-4 pb-2 flex-shrink-0">
          {/* physical: intentional, a center-transform trick, not a directional offset */}
          <div className="w-10 h-1 bg-gray-300 rounded-full mx-auto absolute left-1/2 -translate-x-1/2 top-3" />
          <button
            onClick={onClose}
            className="ms-auto text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Photo: yields space (gets clipped) instead of pushing the footer
            down, so the CTA below is always visible. Unconditional, like
            GalleryCard: BirdhousePhoto already renders the default-birdhouse
            illustration when src is null, so a house with zero house_images
            rows gets that fallback instead of a blank gap. */}
        <div className="min-h-0 flex-1 overflow-hidden">
          <BirdhousePhoto
            src={house.first_image_url}
            alt={displayName(house)}
            width={IMG_HERO}
            aspect="4 / 3"
          />
        </div>

        {/* Footer: name, artist byline, CTA. No bio. Never scrolls away. */}
        <div className="flex-shrink-0 px-6 py-4">
          <h2 className="text-2xl font-bold text-gray-900 mb-1">{displayName(house)}</h2>

          {house.artist_name && (
            <p className="text-amber-600 font-medium mb-3">&#127912; {house.artist_name}</p>
          )}

          <Link href={houseUrl} onClick={() => trackSelectContent('birdhouse_profile_link', house.qr_code_id)}>
            <Button
              data-testid="sheet-learn-more"
              className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-full py-3 text-base font-semibold shadow-md"
            >
              {t('learnMore')}
            </Button>
          </Link>
        </div>
      </div>
    </>
  )
}

// Gallery card (side panel + mobile list)

function GalleryCard({
  house,
  isHighlighted,
  isSelected,
  photoInteractive,
  onHover,
  onClick,
  registerRef,
}: {
  house: HouseMapData
  isHighlighted: boolean
  isSelected: boolean
  photoInteractive: boolean
  onHover: (id: string | null) => void
  onClick: (house: HouseMapData) => void
  registerRef: (el: HTMLDivElement | null) => void
}) {
  const t = useTranslations('MapPage')
  const houseUrl = house.slug ? `/v/${slugToUrl(house.slug)}` : `/h/${house.qr_code_id}`
  const name = displayName(house)

  // Selected (desktop pin/card focus) is visually distinct from the existing
  // hover highlight; both can't be true onscreen at once in practice, but
  // selected wins if they ever overlap.
  const stateClasses = isSelected
    ? 'ring-2 ring-inset ring-amber-500 bg-amber-50'
    : isHighlighted
      ? 'bg-amber-50'
      : 'hover:bg-gray-50'

  return (
    <div
      ref={registerRef}
      data-testid="gallery-card"
      data-highlighted={isHighlighted ? 'true' : 'false'}
      data-selected={isSelected ? 'true' : 'false'}
      onMouseEnter={() => onHover(house.qr_code_id)}
      onMouseLeave={() => onHover(null)}
      // scroll-mt clears the sticky panel header (~4.5rem) when a card scrolls
      // to the top of the panel on desktop pin-focus.
      className={`border-b border-gray-100 transition-colors duration-150 scroll-mt-[4.5rem] ${stateClasses}`}
    >
      {/* Image: an interactive focus control on desktop, inert on mobile
          list (the only mobile-list actions are the Map/List pill and the
          CTA link below). */}
      {photoInteractive ? (
        <button
          onClick={() => {
            trackSelectContent('birdhouse_gallery_card', house.qr_code_id)
            onClick(house)
          }}
          className="w-full text-start focus:outline-none"
        >
          <BirdhousePhoto src={house.first_image_url} alt={name} width={IMG_CARD} aspect="4 / 3" />
        </button>
      ) : (
        <BirdhousePhoto src={house.first_image_url} alt={name} width={IMG_CARD} aspect="4 / 3" />
      )}

      {/* Text */}
      <div className="px-4 pt-3 pb-4">
        <p className="font-bold text-gray-900 text-base leading-tight">{name}</p>
        {house.artist_name && (
          <p className="text-sm text-amber-600 mt-0.5">{house.artist_name}</p>
        )}
        <Link
          href={houseUrl}
          onClick={e => {
            e.stopPropagation()
            trackSelectContent('birdhouse_profile_link', house.qr_code_id)
          }}
        >
          <Button
            data-testid="card-learn-more"
            size="sm"
            className="mt-3 bg-amber-600 hover:bg-amber-700 text-white rounded-full text-xs px-4"
          >
            {t('learnMore')}
          </Button>
        </Link>
      </div>
    </div>
  )
}

// Main page

function MapPageContent() {
  const t = useTranslations('MapPage')
  const isDesktop = useIsDesktop()
  const [selectedHouse, setSelectedHouse] = useState<HouseMapData | null>(null)
  const [houses, setHouses] = useState<HouseMapData[]>([])
  const [markers, setMarkers] = useState<MapMarkerData[]>([])
  const [loading, setLoading] = useState(true)
  const [hoveredHouseId, setHoveredHouseId] = useState<string | null>(null)
  // Initial value must match the server render ('map'); the persisted value
  // is applied in an effect below, after mount.
  const [viewMode, setViewMode] = useState<MapViewMode>('map')
  const searchParams = useSearchParams()
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({})
  const sheetRef = useRef<HTMLDivElement | null>(null)
  const [sheetHeight, setSheetHeight] = useState(0)
  // Bumped on every selection, including re-selecting an already-
  // selected house; the sole purpose is to give MapCenterer and the
  // card-scroll effect below a dependency that always changes, since
  // selectedHouse's own identity doesn't when the same house is re-clicked.
  const [focusNonce, setFocusNonce] = useState(0)
  const galleryScrollRef = useRef<HTMLDivElement | null>(null)
  const scrollRafRef = useRef<number | null>(null)
  const hasRestoredScrollRef = useRef(false)

  useEffect(() => {
    setViewMode(readMapViewMode())
  }, [])

  const changeViewMode = (mode: MapViewMode) => {
    setViewMode(mode)
    writeMapViewMode(mode)
    // Switching to the list closes any open sheet.
    if (mode === 'list') setSelectedHouse(null)
  }

  useEffect(() => {
    const load = async () => {
      const { data: houseData, error } = await supabase
        .from('houses')
        .select('qr_code_id, slug, status, artist_name, bio, lat, lng, is_invited_artist, tags')
        .eq('status', 'live')
        .is('archived_at', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null)

      if (error || !houseData) {
        setLoading(false)
        return
      }

      // Batch-fetch first image per house (2 queries, not N+1)
      const ids = houseData.map(h => h.qr_code_id)
      const { data: imageData } = await supabase
        .from('house_images')
        .select('qr_code_id, image_url')
        .in('qr_code_id', ids)
        .order('display_order', { ascending: true })

      const firstImageMap: Record<string, string> = {}
      for (const img of imageData ?? []) {
        if (!firstImageMap[img.qr_code_id]) {
          firstImageMap[img.qr_code_id] = img.image_url
        }
      }

      const enriched: HouseMapData[] = houseData.map(h => ({
        ...h,
        is_invited_artist: h.is_invited_artist ?? false,
        tags: h.tags ?? [],
        first_image_url: firstImageMap[h.qr_code_id] ?? null,
      }))

      // Sort: has photos first, then no photos
      enriched.sort((a, b) => (a.first_image_url ? 0 : 1) - (b.first_image_url ? 0 : 1))

      setHouses(enriched)

      // Street dots: birdhouses without pages, shown as inert dots
      // and counted in the headline total. Columns must be explicit: anon
      // only has SELECT on id/lat/lng.
      const { data: markerData } = await supabase
        .from('map_markers')
        .select('id, lat, lng')
      setMarkers(markerData ?? [])

      setLoading(false)
    }

    load()
  }, [])

  // Auto-select the house named by ?active= once it loads. Applied during
  // render (React's derived-state pattern) rather than in an effect, so it
  // doesn't trigger a cascading render, and re-runs only when the active slug
  // or the loaded house set changes.
  const activeSlug = searchParams.get('active')
  const [appliedActive, setAppliedActive] = useState<string | null>(null)
  const activeKey = activeSlug && houses.length > 0 ? activeSlug : null
  if (activeKey && appliedActive !== activeKey) {
    setAppliedActive(activeKey)
    const house = houses.find(
      h =>
        h.slug === activeKey ||
        (h.slug && slugToUrl(h.slug) === activeKey.toLowerCase())
    )
    if (house) setSelectedHouse(house)
  }

  const filteredHouses = houses

  const handleCardOrPinSelect = (house: HouseMapData) => {
    setSelectedHouse(house)
    // Re-clicking an already-selected house must still re-focus it.
    // selectedHouse's reference doesn't change when the same house object is
    // passed again, so MapCenterer's and the card-scroll effect's dependency
    // arrays wouldn't otherwise see a change; this nonce always does.
    setFocusNonce(n => n + 1)
  }

  // Measure the sheet's real, rendered height BEFORE paint (useLayoutEffect,
  // not a passive effect) so the map's recentring pan happens exactly once;
  // a passive effect here causes a visible double-pan.
  useLayoutEffect(() => {
    if (!selectedHouse || isDesktop) {
      setSheetHeight(0)
      return
    }
    const el = sheetRef.current
    if (!el) return
    const measure = () => setSheetHeight(el.getBoundingClientRect().height)
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [selectedHouse, isDesktop])

  // Desktop: scroll the selected house's gallery card to the top of the
  // panel, clear of the sticky header. List order never changes. focusNonce
  // is in the deps so re-clicking the SAME house re-scrolls it too;
  // selectedHouse alone wouldn't change reference on a repeat click.
  useEffect(() => {
    if (!isDesktop || !selectedHouse) return
    const el = cardRefs.current[selectedHouse.qr_code_id]
    if (!el) return
    el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' })
  }, [isDesktop, selectedHouse, focusNonce])

  // List scroll persistence. Save: throttled via rAF coalescing so an
  // unthrottled write on every native scroll event isn't wasted work.
  const handleGalleryScroll = () => {
    if (scrollRafRef.current != null) return
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null
      const el = galleryScrollRef.current
      if (el) writeListScrollTop(el.scrollTop)
    })
  }
  useEffect(() => () => {
    if (scrollRafRef.current != null) cancelAnimationFrame(scrollRafRef.current)
  }, [])

  // Restore: once the houses have actually rendered, not on bare mount; the
  // panel has no scrollable height yet then and the restore silently no-ops.
  // Also waits for the panel to actually be visible: on mobile it's
  // display:none while viewMode is still the SSR-matching 'map' default
  // (before the persisted 'list' mode applies post-mount), and setting
  // scrollTop on a display:none element doesn't stick, so this re-checks
  // when viewMode changes rather than firing once, unconditionally, at
  // mount.
  //
  // A house already being selected here means an ?active= deep link picked
  // it during the initial render, and the card-scroll effect above is
  // bringing that card into view. This effect is declared after it, so it
  // runs last and its synchronous scrollTop write would cancel that smooth
  // scroll, so stand down and let the deliberate selection win, marking the
  // restore as spent so it can't fight a later click either.
  useEffect(() => {
    // loading gates this too: houses populates before the markers fetch
    // resolves and setLoading(false) fires (a real await gap), so
    // filteredHouses.length > 0 alone can be true while the JSX is still
    // rendering the spinner placeholder instead of the actual cards; the
    // panel has no real overflow at that instant and the restore no-ops.
    if (hasRestoredScrollRef.current || loading || filteredHouses.length === 0) return
    if (!isDesktop && viewMode !== 'list') return
    hasRestoredScrollRef.current = true
    if (selectedHouse) return // deep-linked selection owns the scroll position
    const saved = readListScrollTop()
    const el = galleryScrollRef.current
    if (saved != null && el) el.scrollTop = saved
  }, [filteredHouses.length, viewMode, isDesktop, loading, selectedHouse])

  // Height of the Map/List pill band (top-3 offset + pill height), kept next
  // to the pill markup below so the two values can't silently drift apart.
  const PILL_BAND_TOP = 64

  // Offset = nav height + live banner height: the banner publishes
  // --event-banner-h and zeroes it on expiry, so this layout self-heals.
  return (
    <div className="fixed inset-0 top-[calc(3.5rem+var(--event-banner-h,0px))]">
      {/* Mobile Map / List toggle. physical: intentional, a center-transform trick, not a directional offset.
          PILL_BAND_TOP above must cover this pill's full height + its top-3 offset. */}
      <div
        data-testid="map-list-toggle"
        className="md:hidden absolute top-3 left-1/2 -translate-x-1/2 z-[9990] flex bg-white rounded-full shadow-lg border border-gray-100 p-1"
      >
        <button
          onClick={() => changeViewMode('map')}
          className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-colors ${
            viewMode === 'map' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {t('map')}
        </button>
        <button
          onClick={() => changeViewMode('list')}
          className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-colors ${
            viewMode === 'list' ? 'bg-amber-600 text-white' : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {t('list')}
        </button>
      </div>

      {/* Map: full width on mobile (map tab), constrained on desktop */}
      <div
        className={`absolute inset-0 md:end-80 xl:end-96 ${
          viewMode === 'list' ? 'hidden md:block' : ''
        }`}
      >
        <MapComponent
          houses={filteredHouses}
          markers={markers}
          onHouseSelect={handleCardOrPinSelect}
          onHouseHover={setHoveredHouseId}
          // Mobile: withhold the focus target until the sheet height is
          // measured, so the map recentres once with the right bottom inset.
          // Desktop has no sheet to wait for.
          activeHouse={isDesktop || sheetHeight > 0 ? selectedHouse : null}
          highlightedHouseId={hoveredHouseId}
          focusInsets={isDesktop ? undefined : { top: PILL_BAND_TOP, bottom: sheetHeight }}
          focusNonce={focusNonce}
          persistCamera
        />
      </div>

      {/* Gallery panel: always visible on desktop, full-screen on mobile list tab */}
      <div
        ref={galleryScrollRef}
        onScroll={handleGalleryScroll}
        data-testid="gallery-panel"
        className={`absolute top-0 bottom-0 end-0 bg-white border-s border-gray-100 shadow-xl overflow-y-auto flex flex-col
          w-full md:w-80 xl:w-96
          ${viewMode === 'list' ? 'block' : 'hidden md:flex'}`}
      >
        {/* Panel header: ONE total, profiled houses + street dots.
            The tappable list below is a spotlight ("Featured birdhouses"),
            never a second count. */}
        <div className="px-5 py-4 border-b border-gray-100 bg-white sticky top-0 z-10" data-testid="gallery-panel-header">
          <h2 className="text-base font-bold text-gray-900" data-testid="birdhouse-count">
            {t('birdhouses')} {!loading && `(${filteredHouses.length + markers.length})`}
          </h2>
          {!loading && filteredHouses.length > 0 && (
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mt-1" data-testid="featured-header">
              {t('featuredBirdhouses')}
            </p>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-gray-400">
            <p>{t('loading')}</p>
          </div>
        ) : filteredHouses.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-gray-400 p-8 text-center">
            <p>{t('noBirdhouses')}</p>
          </div>
        ) : (
          <div className="flex-1 pb-24">
            {filteredHouses.map(house => (
              <GalleryCard
                key={house.qr_code_id}
                house={house}
                isHighlighted={hoveredHouseId === house.qr_code_id}
                isSelected={selectedHouse?.qr_code_id === house.qr_code_id}
                photoInteractive={isDesktop}
                onHover={setHoveredHouseId}
                onClick={handleCardOrPinSelect}
                registerRef={el => { cardRefs.current[house.qr_code_id] = el }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Bottom sheet: mobile only. Not CSS-hidden: genuinely absent from the
          DOM on desktop, since its full-screen backdrop otherwise swallows
          map clicks. */}
      {selectedHouse && !isDesktop && (
        <HouseSheet house={selectedHouse} onClose={() => setSelectedHouse(null)} sheetRef={sheetRef} />
      )}
    </div>
  )
}

export default function MapPage() {
  const t = useTranslations('MapPage')
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 top-[calc(3.5rem+var(--event-banner-h,0px))] flex items-center justify-center bg-amber-50">
          <div className="text-center">
            <div className="text-4xl mb-4">&#128506;&#65039;</div>
            <p className="text-xl text-gray-600">{t('loadingMap')}</p>
          </div>
        </div>
      }
    >
      <MapPageContent />
    </Suspense>
  )
}
