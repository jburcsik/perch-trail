'use client'

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, useEffect, useRef, useCallback } from "react";
import { useTranslations, useLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { BirdhousePhoto } from "@/components/BirdhousePhoto";
import { ContactForm } from "@/components/ContactForm";
import { supabase } from "@/lib/supabase";
import type { HouseMapData, MapMarkerData } from "@/components/Map";
import { PERCH_UPDATES, latestUpdates, type Locale } from "@/content/perch-updates";
import { IMG_CARD } from "@/lib/images";

const MapPreview = dynamic(() => import("@/components/Map"), { ssr: false });

interface FeaturedHouse {
  qr_code_id: string
  slug: string | null
  artist_name: string | null
  status: string
  images?: { image_url: string }[]
}

export default function Home() {
  const t = useTranslations('HomePage')
  const locale = useLocale() as Locale
  const newsTeaser = latestUpdates(PERCH_UPDATES, 3)
  const [featuredHouses, setFeaturedHouses] = useState<FeaturedHouse[]>([])
  const [loadingHouses, setLoadingHouses] = useState(true)
  const [liveCount, setLiveCount] = useState<number | null>(null)
  const [mapHouses, setMapHouses] = useState<HouseMapData[]>([])
  const [mapMarkers, setMapMarkers] = useState<MapMarkerData[]>([])

  // Featured Perches carousel: real native scroll (touch/trackpad/buttons
  // all move the same scrollLeft), auto-advance pauses on hover/focus and stops
  // for good the moment a visitor steers it themselves.
  const carouselRef = useRef<HTMLDivElement>(null)
  const carouselPausedRef = useRef(false)
  const carouselInteractedRef = useRef(false)

  // Chrome's scrollLeft runs from 0 to negative in RTL containers (not 0 to positive
  // like LTR), so "forward" needs a sign flip based on actual computed direction.
  const scrollCarouselByCard = useCallback((direction: 1 | -1) => {
    const track = carouselRef.current
    if (!track) return
    carouselInteractedRef.current = true
    const rtl = getComputedStyle(track).direction === 'rtl'
    const card = track.firstElementChild as HTMLElement | null
    const gap = 20 // matches the track's gap-5
    const amount = card ? card.clientWidth + gap : track.clientWidth
    track.scrollBy({ left: direction * amount * (rtl ? -1 : 1), behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const track = carouselRef.current
    if (!track || featuredHouses.length === 0) return
    const interval = setInterval(() => {
      if (carouselPausedRef.current || carouselInteractedRef.current) return
      const rtl = getComputedStyle(track).direction === 'rtl'
      const maxScroll = track.scrollWidth - track.clientWidth
      const atEnd = rtl
        ? track.scrollLeft <= -maxScroll + 4
        : track.scrollLeft + track.clientWidth >= track.scrollWidth - 4
      if (atEnd) {
        track.scrollTo({ left: 0, behavior: 'smooth' })
      } else {
        const card = track.firstElementChild as HTMLElement | null
        const gap = 20
        const amount = (card ? card.clientWidth + gap : track.clientWidth) * (rtl ? -1 : 1)
        track.scrollBy({ left: amount, behavior: 'smooth' })
      }
    }, 4000)
    return () => clearInterval(interval)
  }, [featuredHouses.length])

  const fetchMapHouses = async () => {
    const { data: houseData, error } = await supabase
      .from('houses')
      .select('qr_code_id, slug, status, artist_name, bio, lat, lng, is_invited_artist, tags')
      .eq('status', 'live')
      .is('archived_at', null)
      .not('lat', 'is', null)
      .not('lng', 'is', null)

    if (error || !houseData) return

    const ids = houseData.map(h => h.qr_code_id)
    const { data: imageData } = await supabase
      .from('house_images')
      .select('qr_code_id, image_url')
      .in('qr_code_id', ids)
      .order('display_order', { ascending: true })

    const firstImageMap: Record<string, string> = {}
    for (const img of imageData ?? []) {
      if (!firstImageMap[img.qr_code_id]) firstImageMap[img.qr_code_id] = img.image_url
    }

    setMapHouses(houseData.map(h => ({
      ...h,
      is_invited_artist: h.is_invited_artist ?? false,
      tags: h.tags ?? [],
      first_image_url: firstImageMap[h.qr_code_id] ?? null,
    })))

    // Street dots: every birdhouse on the trail, page or not. They
    // render on the preview and count toward the headline total. Explicit
    // columns: anon only has SELECT on id/lat/lng.
    const { data: markerData } = await supabase
      .from('map_markers')
      .select('id, lat, lng')
    setMapMarkers(markerData ?? [])
  }

  const fetchLiveCount = async () => {
    const { count } = await supabase
      .from('houses')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'live')
      .is('archived_at', null)
    if (count !== null) setLiveCount(count)
  }

  const fetchFeaturedHouses = async () => {
    try {
      const { data: houses, error } = await supabase
        .from('houses')
        .select('qr_code_id, slug, artist_name, status')
        .eq('status', 'live')
        .is('archived_at', null)
        .order('claimed_at', { ascending: false })
        .limit(6)

      if (error) {
        console.error('Error fetching featured houses:', error)
        setLoadingHouses(false)
        return
      }

      const housesWithImages = await Promise.all(
        (houses || []).map(async (house) => {
          const { data: images } = await supabase
            .from('house_images')
            .select('image_url')
            .eq('qr_code_id', house.qr_code_id)
            .order('display_order', { ascending: true })
            .limit(1)

          return {
            ...house,
            images: images || []
          }
        })
      )

      setFeaturedHouses(housesWithImages)
      setLoadingHouses(false)
    } catch (error) {
      console.error('Error:', error)
      setLoadingHouses(false)
    }
  }

  useEffect(() => {
    // These fetchers are async; every setState runs after an `await`, never
    // synchronously in the effect body, so there is no cascading render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFeaturedHouses()
    fetchLiveCount()
    fetchMapHouses()
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Hero Section */}
      <section className="relative min-h-[82vh] flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-amber-100/20 to-orange-100/20"></div>
        <div className="container mx-auto px-4 text-center relative z-10 pb-8 flex flex-col items-center">
          <p className="text-sm uppercase tracking-widest text-amber-600 font-semibold mb-4 pt-5">{t('heroSubtitle')}</p>
          <h1 className="text-7xl font-bold text-gray-900 mb-6 leading-tight">
            {t('heroTitle')} <span className="text-amber-600">{t('heroTitleAccent')}</span>
          </h1>
          <p className="text-xl text-gray-700 max-w-3xl mx-auto mb-8 leading-relaxed order-3 md:order-2">
            {t('heroDescription')}
          </p>

          {/* Birdhouse illustration */}
          <div className="w-full max-w-md mx-auto mb-8 order-2 md:order-3">
            {/* Mobile image */}
            <Image
              src="/hero-mobile.png"
              alt={t('heroImageAlt')}
              width={240}
              height={227}
              className="block md:hidden mx-auto"
              priority
            />
            {/* Desktop image */}
            <Image
              src="/hero-desktop.png"
              alt={t('heroImageAlt')}
              width={400}
              height={471}
              className="hidden md:block mx-auto"
              priority
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-4 justify-center order-4">
            <Link href="/map">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
                {t('exploreMap')}
              </Button>
            </Link>
          </div>

          {/* Live houses with pages; the map header adds street dots to its own total. */}
          {liveCount !== null && liveCount > 0 && (
            <p className="mt-8 text-amber-700 font-medium text-lg order-5" data-testid="home-count">
              &#127968; {t('liveCount', { count: liveCount })}
            </p>
          )}
          <Link href="/support" className="mt-2 inline-block text-amber-700 font-semibold hover:underline order-6">
            {t('supportTrail')} &rarr;
          </Link>
        </div>
      </section>

      {/* Get Involved Section */}
      <section className="pt-10 pb-24 bg-gradient-to-br from-amber-50 to-orange-50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">{t('getInvolved')}</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              {t('getInvolvedDescription')}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-14 h-14 bg-amber-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-3xl">&#127968;</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('getFreeBirdhouse')}</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                {t('getFreeBirdhouseDescription')}
              </p>
              <Link
                href={{ pathname: '/get-involved', query: { open: 'birdhouse' } }}
                data-testid="home-request-birdhouse-cta"
                className="inline-flex items-center justify-center bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-full px-5 py-2.5 transition-colors w-fit"
              >
                {t('requestBirdhouseHomeCta')}
              </Link>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-3xl">&#127912;</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('joinPaintingEvent')}</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                {t('joinPaintingEventDescription')}
              </p>
              <Link href="/events" className="text-amber-600 font-semibold hover:text-amber-700 transition-colors">
                {t('seeUpcomingEvents')}
              </Link>
            </div>

            <div className="bg-white rounded-3xl p-8 shadow-lg hover:shadow-xl transition-shadow duration-300">
              <div className="w-14 h-14 bg-red-100 rounded-2xl flex items-center justify-center mb-6">
                <span className="text-3xl">&#128205;</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">{t('hostBirdhouse')}</h3>
              <p className="text-gray-600 leading-relaxed mb-4">
                {t('hostBirdhouseDescription')}
              </p>
              <Link href="/get-involved?open=host" className="text-amber-600 font-semibold hover:text-amber-700 transition-colors">
                {t('hostBirdhouseCta')}
              </Link>
            </div>
          </div>

          <div className="text-center">
            <Link href="/get-involved">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-10 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
                {t('getInvolvedButton')}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Map Preview Section */}
      <section className="py-16 bg-white">
        <div className="container mx-auto px-4">
          <h2 className="text-4xl font-bold text-center mb-4 text-gray-900">{t('findNearYou')}</h2>
          <p className="text-center text-gray-600 mb-10 max-w-xl mx-auto">
            {t('findNearYouDescription')}
          </p>
          <Link href="/map" className="block">
            <div className="w-full h-72 rounded-3xl overflow-hidden shadow-2xl border-2 border-amber-100 hover:border-amber-400 transition-colors duration-300 cursor-pointer">
              <MapPreview houses={mapHouses} markers={mapMarkers} isStatic={true} />
            </div>
          </Link>
        </div>
      </section>

      {/* Gallery Section */}
      <section className="py-24 bg-gradient-to-r from-amber-50 to-orange-50 overflow-hidden">
        <div className="container mx-auto px-4 mb-12">
          <h2 className="text-4xl font-bold text-center text-gray-900">{t('featuredPerches')}</h2>
        </div>

        {loadingHouses ? (
          <div className="text-center text-gray-600 pb-12">
            <p className="text-lg">{t('loadingFeatured')}</p>
          </div>
        ) : featuredHouses.length === 0 ? (
          <div className="text-center max-w-2xl mx-auto pb-12">
            <p className="text-xl text-gray-700 mb-8">{t('trailGrowing')}</p>
            <Link href="/map">
              <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-full">
                {t('viewMap')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="relative">
            <div
              ref={carouselRef}
              className="carousel-mask flex gap-5 overflow-x-auto snap-x snap-mandatory scroll-smooth"
              onMouseEnter={() => { carouselPausedRef.current = true }}
              onMouseLeave={() => { carouselPausedRef.current = false }}
              onFocus={() => { carouselPausedRef.current = true }}
              onBlur={() => { carouselPausedRef.current = false }}
              onWheel={() => { carouselInteractedRef.current = true }}
              onTouchStart={() => { carouselInteractedRef.current = true }}
            >
              {featuredHouses.map((house) => {
                const houseUrl = house.slug ? `/v/${house.slug}` : `/h/${house.qr_code_id}`
                const displayName = house.slug
                  ? house.slug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
                  : house.qr_code_id

                return (
                  <Link
                    key={house.qr_code_id}
                    href={houseUrl}
                    className="flex-shrink-0 w-64 sm:w-72 snap-start block group"
                  >
                    <Card className="h-full shadow-lg group-hover:shadow-2xl transition-all duration-300 border-0 bg-white cursor-pointer overflow-hidden rounded-2xl">
                      <BirdhousePhoto
                        src={house.images?.[0]?.image_url}
                        alt={displayName}
                        width={IMG_CARD}
                        aspect="4 / 3"
                      />
                      <div className="p-4">
                        <p className="font-bold text-gray-900 truncate">{displayName}</p>
                        {house.artist_name && (
                          <p className="text-sm text-gray-500 truncate mt-0.5">{house.artist_name}</p>
                        )}
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>

            {featuredHouses.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => scrollCarouselByCard(-1)}
                  aria-label={t('carouselPrevious')}
                  className="hidden sm:flex absolute start-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-white/90 shadow-lg text-gray-700 hover:bg-white hover:text-amber-700 transition-colors z-10"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => scrollCarouselByCard(1)}
                  aria-label={t('carouselNext')}
                  className="hidden sm:flex absolute end-2 top-1/2 -translate-y-1/2 items-center justify-center w-10 h-10 rounded-full bg-white/90 shadow-lg text-gray-700 hover:bg-white hover:text-amber-700 transition-colors z-10"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </>
            )}
          </div>
        )}

        <div className="text-center mt-12 container mx-auto px-4">
          <Link href="/map">
            <Button size="lg" className="bg-amber-600 hover:bg-amber-700 text-white px-10 py-4 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300">
              {t('exploreMapButton')}
            </Button>
          </Link>
        </div>
      </section>

      {/* News from the Perch teaser, hidden entirely until there's at least
          one post, so an empty section never clutters the homepage. */}
      {newsTeaser.length > 0 && (
        <section className="py-20 bg-white" data-testid="news-teaser">
          <div className="container mx-auto px-4 max-w-5xl">
            <div className="flex items-end justify-between border-b-2 border-gray-900 pb-4 mb-12">
              <h2 className="text-4xl font-bold text-gray-900">{t('newsTeaserTitle')}</h2>
            </div>

            <div className="grid lg:grid-cols-5 gap-x-12 gap-y-10">
              {/* Lead story: the most recent post gets the editorial treatment */}
              <Link href={`/news#${newsTeaser[0].slug}`} className="lg:col-span-3 group block">
                <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold">
                  {new Date(newsTeaser[0].date + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                </p>
                <h3 className="text-3xl font-bold text-gray-900 mt-3 group-hover:text-amber-700 transition-colors">
                  {newsTeaser[0].title[locale]}
                </h3>
                <p className="text-gray-600 text-lg leading-relaxed mt-4 line-clamp-3">
                  {newsTeaser[0].body[locale]}
                </p>
              </Link>

              {/* Rest of the teaser: compact editorial list, no card chrome */}
              <div className="lg:col-span-2 flex flex-col divide-y divide-gray-200 border-t border-gray-200 lg:border-t-0">
                {newsTeaser.slice(1).map((post) => (
                  <Link key={post.slug} href={`/news#${post.slug}`} className="py-5 lg:first:pt-0 group block">
                    <p className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
                      {new Date(post.date + 'T00:00:00').toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                    <h3 className="text-lg font-bold text-gray-900 mt-1.5 group-hover:text-amber-700 transition-colors">
                      {post.title[locale]}
                    </h3>
                  </Link>
                ))}
              </div>
            </div>

            <div className="text-center mt-14">
              <Link href="/news" className="text-amber-600 hover:text-amber-700 font-semibold text-lg transition-colors">
                {t('newsTeaserCta')}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Footer with Contact Form */}
      <footer className="bg-gray-900 text-white py-16">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-12">
            <div>
              <h3 className="text-3xl font-bold mb-6">{t('aboutTheTrail')}</h3>
              <p className="text-gray-300 mb-6 leading-relaxed text-lg">
                {t('footerDescription')}
              </p>
              <div className="flex flex-col gap-3">
                <Link href="/get-involved" className="text-amber-400 hover:text-amber-300 font-semibold text-lg transition-colors">
                  {t('participate')}
                </Link>
              </div>
            </div>
            <div>
              <ContactForm
                showRoleSelector={false}
                variant="dark"
                title={t('footerGetInvolved')}
              />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
