'use client'

import { useState, useEffect } from 'react'
import { useTranslations, useLocale } from 'next-intl'
import { HOUSE_TRANSLATABLE_FIELDS } from '@/lib/translation'
import { LikeButton } from '@/components/LikeButton'
import { BirdhousePhoto } from '@/components/BirdhousePhoto'
import { PhotoLightbox } from '@/components/PhotoLightbox'
import { TranslatedField } from '@/components/TranslatedField'
import { notFound } from 'next/navigation'
import { Link, useRouter } from '@/i18n/navigation'
import { escapeLike, slugify } from '@/lib/slug'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase'
import type { HouseMapData } from '@/components/Map'
import { houseImage, lightboxSlides, IMG_THUMB, IMG_HERO } from '@/lib/images'

const MapComponent = dynamic(() => import('@/components/Map'), { ssr: false })

interface House {
  qr_code_id: string
  slug: string | null
  status: string
  artist_name: string | null
  artist_bio: string | null
  bio: string | null
  bio_source_locale: string | null
  artist_bio_source_locale: string | null
  lat: number | null
  lng: number | null
  is_invited_artist: boolean
  tags: string[]
}

interface HouseImage {
  id: number
  image_url: string
  display_order: number
}

function formatSlug(slug: string): string {
  return slug.split(/[-\s]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const SELECT_FIELDS = 'qr_code_id, slug, status, artist_name, artist_bio, bio, bio_source_locale, artist_bio_source_locale, lat, lng, is_invited_artist, tags'

interface NavHouse {
  qr_code_id: string
  slug: string | null
}

export default function HousePage({ params }: { params: Promise<{ slug: string }> }) {
  const t = useTranslations('ViewPage')
  const locale = useLocale()
  const [house, setHouse] = useState<House | null | undefined>(undefined)
  const [tx, setTx] = useState<{ bio?: string; artist_bio?: string }>({})
  const [images, setImages] = useState<HouseImage[]>([])
  const [activeImageIndex, setActiveImageIndex] = useState(0)
  const [lightboxOpen, setLightboxOpen] = useState(false)
  const [allHouses, setAllHouses] = useState<NavHouse[]>([])
  const router = useRouter()

  useEffect(() => {
    supabase
      .from('houses')
      .select('qr_code_id, slug')
      .eq('status', 'live')
      .is('archived_at', null)
      .order('slug', { ascending: true })
      .then(({ data }) => setAllHouses(data ?? []))
  }, [])

  useEffect(() => {
    params.then(({ slug }) => {
      const decoded = decodeURIComponent(slug)

      const fetchHouse = async () => {
        // 1) Exact match on the slug.
        let { data } = await supabase
          .from('houses')
          .select(SELECT_FIELDS)
          .eq('slug', decoded)
          .eq('status', 'live')
          .is('archived_at', null)
          .maybeSingle()

        // 2) Fallback: replace dashes with spaces (slugs containing spaces).
        if (!data) {
          const { data: data2 } = await supabase
            .from('houses')
            .select(SELECT_FIELDS)
            .ilike('slug', escapeLike(decoded.replace(/-/g, ' ')))
            .eq('status', 'live')
            .is('archived_at', null)
            .maybeSingle()
          data = data2
        }

        // 2.5) QR-code fallback: prev/next nav links slug-less live
        // houses as /v/<qr_code_id>. Codes are short and uppercase; exact
        // match only, and the length guard skips the query for normal slugs.
        if (!data && decoded.length <= 5) {
          const { data: byQr } = await supabase
            .from('houses')
            .select(SELECT_FIELDS)
            .eq('qr_code_id', decoded.toUpperCase())
            .eq('status', 'live')
            .is('archived_at', null)
            .maybeSingle()
          data = byQr
        }

        // 3) Slug changed: resolve via slug_history and redirect to the
        // current URL so old shared/bookmarked links don't 404 after a rename.
        if (!data) {
          for (const variant of [decoded, decoded.replace(/-/g, ' ')]) {
            const { data: hist } = await supabase
              .from('slug_history')
              .select('qr_code_id')
              .ilike('slug', escapeLike(variant))
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle()
            if (!hist?.qr_code_id) continue
            const { data: current } = await supabase
              .from('houses')
              .select('slug')
              .eq('qr_code_id', hist.qr_code_id)
              .eq('status', 'live')
              .is('archived_at', null)
              .maybeSingle()
            // slugify guarantees an internal, URL-safe target (no open-redirect).
            const target = slugify(current?.slug)
            if (target && target !== decoded.toLowerCase()) {
              router.replace(`/v/${target}`)
              return
            }
          }
          setHouse(null)
          return
        }

        const merged = { ...data, is_invited_artist: data.is_invited_artist ?? false, tags: data.tags ?? [] }
        setHouse(merged)

        // Fetch this locale's translations (kept separate from the source so the
        // resolver can show the original to source-locale viewers and a note to
        // the rest). en is fetched too: a non-English-source bio is translated
        // INTO English.
        const { data: txRows } = await supabase
          .from('house_translations')
          .select('field, translated_text')
          .eq('qr_code_id', data.qr_code_id)
          .eq('locale', locale)
          .in('field', HOUSE_TRANSLATABLE_FIELDS as unknown as string[])
        const byField: { bio?: string; artist_bio?: string } = {}
        for (const r of txRows ?? []) byField[r.field as 'bio' | 'artist_bio'] = r.translated_text
        setTx(byField)

        const { data: imgData } = await supabase
          .from('house_images')
          .select('id, image_url, display_order')
          .eq('qr_code_id', data.qr_code_id)
          .order('display_order', { ascending: true })

        setImages(imgData ?? [])
      }

      fetchHouse()
    })
  }, [params, locale])

  if (house === undefined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50 flex items-center justify-center">
        <p className="text-gray-500 text-lg">{t('loading')}</p>
      </div>
    )
  }

  if (house === null) notFound()

  const displayName = house.slug ? formatSlug(house.slug) : house.qr_code_id
  const hasLocation = house.lat != null && house.lng != null

  const singleHouseData: HouseMapData | null = hasLocation
    ? {
        qr_code_id: house.qr_code_id,
        slug: house.slug,
        status: house.status,
        artist_name: house.artist_name,
        bio: house.bio,
        lat: house.lat!,
        lng: house.lng!,
        is_invited_artist: house.is_invited_artist,
        tags: house.tags ?? [],
        first_image_url: images[0]?.image_url ?? null,
      }
    : null

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-orange-50 to-red-50">
      {/* Header */}
      <header className="bg-gradient-to-r from-amber-600 to-orange-600 text-white py-10 shadow-xl">
        <div className="container mx-auto px-4 text-center">
          <p className="text-xs uppercase tracking-widest opacity-60 mb-2">{t('brandName')}</p>
          <h1 className="text-5xl font-bold tracking-wide">{displayName}</h1>
        </div>
      </header>

      <div className="container mx-auto px-4 py-12 max-w-3xl">

        {/* Images */}
        {images.length > 0 ? (
          <div className="mb-10">
            <button
              type="button"
              onClick={() => setLightboxOpen(true)}
              aria-label={t('viewPhotoFull')}
              className="block w-full rounded-3xl overflow-hidden shadow-2xl cursor-zoom-in"
            >
              <BirdhousePhoto src={images[activeImageIndex].image_url} alt={displayName} width={IMG_HERO} aspect="4 / 3" eager />
            </button>
            {images.length > 1 && (
              <div className="flex gap-3 mt-3 justify-center">
                {images.map((img, i) => (
                  <button
                    key={img.id}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-20 h-20 rounded-xl overflow-hidden border-2 transition-all ${
                      i === activeImageIndex
                        ? 'border-amber-500 shadow-md'
                        : 'border-transparent opacity-60 hover:opacity-90'
                    }`}
                  >
                    <img src={houseImage(img.image_url, IMG_THUMB)} alt={t('photo', { number: i + 1 })} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            <PhotoLightbox
              slides={lightboxSlides(images)}
              index={activeImageIndex}
              open={lightboxOpen}
              onClose={() => setLightboxOpen(false)}
              onIndexChange={setActiveImageIndex}
            />
          </div>
        ) : (
          <div className="w-full h-72 rounded-3xl mb-10 overflow-hidden shadow-2xl bg-amber-50">
            <img
              src="/default-birdhouse.svg"
              alt={t('birdhouseIllustrationAlt')}
              className="w-full h-full object-contain p-6"
            />
          </div>
        )}

        {/* Artist name + like */}
        <div className="mb-6">
          {house.artist_name ? (
            <>
              <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-1">{t('artist')}</p>
              <div className="flex items-center gap-3 flex-wrap">
                <p className="text-2xl font-bold text-gray-900">{house.artist_name}</p>
                <LikeButton qrCodeId={house.qr_code_id} />
              </div>
            </>
          ) : (
            <LikeButton qrCodeId={house.qr_code_id} />
          )}
        </div>

        {/* About the Artist */}
        {house.artist_bio && (
          <div className="mb-8 bg-white/70 backdrop-blur-sm rounded-2xl px-6 py-5 shadow-sm border border-amber-100">
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-3">{t('aboutTheArtist')}</p>
            <TranslatedField
              sourceLocale={house.artist_bio_source_locale}
              sourceText={house.artist_bio}
              translatedText={tx.artist_bio}
              className="text-base leading-relaxed text-gray-700"
            />
          </div>
        )}

        {/* About the Bird House */}
        {house.bio && (
          <div className="mb-8">
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-3">{t('aboutTheBirdHouse')}</p>
            <TranslatedField
              sourceLocale={house.bio_source_locale}
              sourceText={house.bio}
              translatedText={tx.bio}
              testId="profile-bio"
              className="text-lg leading-relaxed text-gray-700"
            />
          </div>
        )}

        {/* Actions: prev / back-to-map / next. Above the mini-map so
            the way back to the map doesn't require scrolling past a map. */}
        {(() => {
          const currentIndex = allHouses.findIndex(h => h.qr_code_id === house.qr_code_id)
          const total = allHouses.length
          const prevHouse = total > 1 ? allHouses[(currentIndex - 1 + total) % total] : null
          const nextHouse = total > 1 ? allHouses[(currentIndex + 1) % total] : null
          // Content-width pill with nowrap so the arrow and house pair stay on one
          // line; px-3 so all three controls fit beside each other at 390px.
          const navBtn = 'inline-flex items-center justify-center gap-1 h-12 px-3 rounded-full border-2 border-amber-600 text-amber-700 hover:bg-amber-50 transition-colors text-lg font-bold shrink-0 whitespace-nowrap'
          // The arrow is mirrored in RTL, the house emoji is not: in Arabic
          // "previous" points right. Flipping the glyph (rather than swapping
          // the character) keeps one source of truth per direction. The row
          // itself already reverses, so prev still sits on the leading side.
          const arrow = 'inline-block rtl:-scale-x-100'
          return (
            <div className="flex items-center gap-3 justify-center mb-8">
              {prevHouse ? (
                <Link href={`/v/${prevHouse.slug ?? prevHouse.qr_code_id}`} aria-label={t('previousBirdhouse')}>
                  <span className={navBtn}><span className={arrow}>&#8592;</span> &#127968;</span>
                </Link>
              ) : (
                <span className={`${navBtn} opacity-20 cursor-default`}><span className={arrow}>&#8592;</span> &#127968;</span>
              )}

              <Link
                href="/map"
                className="flex items-center justify-center h-12 border-2 border-amber-600 text-amber-700 hover:bg-amber-50 transition-colors px-6 rounded-full font-medium"
              >
                {t('backToMap')}
              </Link>

              {nextHouse ? (
                <Link href={`/v/${nextHouse.slug ?? nextHouse.qr_code_id}`} aria-label={t('nextBirdhouse')}>
                  <span className={navBtn}>&#127968; <span className={arrow}>&#8594;</span></span>
                </Link>
              ) : (
                <span className={`${navBtn} opacity-20 cursor-default`}>&#127968; <span className={arrow}>&#8594;</span></span>
              )}
            </div>
          )
        })()}

        {/* Mini-map */}
        {singleHouseData && (
          <div className="mb-10">
            <p className="text-xs uppercase tracking-widest text-amber-600 font-semibold mb-3">{t('location')}</p>
            <div className="w-full h-64 rounded-2xl overflow-hidden shadow-lg border border-amber-100">
              <MapComponent singleHouse={singleHouseData} />
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
