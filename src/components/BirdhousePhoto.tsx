'use client'

import { useState } from 'react'
import { houseImage, IMG_THUMB } from '@/lib/images'

/**
 * Shows a birdhouse photo WITHOUT cropping it: the real photo is rendered with
 * object-contain, over a blurred, enlarged copy of itself that fills the empty
 * bars, so tall/portrait birdhouses keep their roof + base and there are never
 * ugly letterbox gaps. Falls back to the house illustration when there's no src.
 *
 * Small navigational thumbnails (thumb strips, admin grids, map markers) keep a
 * plain object-cover crop and do NOT use this component.
 */
export function BirdhousePhoto({
  src,
  alt,
  width,
  aspect = '4 / 3',
  className = '',
  eager = false,
}: {
  src?: string | null
  alt: string
  /** Display width (px) of the real photo; routes it through the Next image
   * optimizer at this size. Every caller declares its own; the blurred
   * backdrop always requests IMG_THUMB regardless, since no detail survives
   * blur-2xl. Use a ladder constant from '@/lib/images', not a literal. */
  width: number
  /** CSS aspect-ratio for the container, e.g. '4 / 3' or '1 / 1'. */
  aspect?: string
  /** Applied to the outer container (rounding, shadow, etc.). */
  className?: string
  eager?: boolean
}) {
  const [failed, setFailed] = useState(false)
  const show = src && !failed
  const loading = eager ? 'eager' : 'lazy'

  return (
    <div
      className={`relative w-full overflow-hidden bg-amber-50 ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {show ? (
        <>
          {/* blurred fill: same photo, scaled to cover, so there are no empty bars */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={houseImage(src, IMG_THUMB)}
            alt=""
            aria-hidden
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl"
            loading={loading}
          />
          <span aria-hidden className="absolute inset-0 bg-black/5" />
          {/* the actual photo: fully visible, never cropped. Absolutely
              positioned so it's bound to the aspect-ratio box and clipped by the
              container, regardless of whether the parent clips overflow. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={houseImage(src, width)}
            alt={alt}
            onError={() => setFailed(true)}
            className="absolute inset-0 h-full w-full object-contain"
            loading={loading}
          />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/default-birdhouse.svg"
          alt={alt}
          className="absolute inset-0 h-full w-full object-contain p-6 opacity-80"
        />
      )}
    </div>
  )
}
