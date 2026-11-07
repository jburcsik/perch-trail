'use client'

import dynamic from 'next/dynamic'
import ZoomPlugin from 'yet-another-react-lightbox/plugins/zoom'
import ThumbnailsPlugin from 'yet-another-react-lightbox/plugins/thumbnails'
import 'yet-another-react-lightbox/styles.css'
import 'yet-another-react-lightbox/plugins/thumbnails.css'

// Defer the (relatively heavy) lightbox JS until a photo is actually opened.
const Lightbox = dynamic(() => import('yet-another-react-lightbox'), { ssr: false })

/**
 * Full-screen photo viewer: pinch/scroll zoom, swipe + arrow-key navigation,
 * thumbnails, ESC / backdrop to close. Used wherever a birdhouse photo should be
 * openable at full size (profile hero + thumbnails, steward preview).
 */
export function PhotoLightbox({
  slides,
  index,
  open,
  onClose,
  onIndexChange,
}: {
  /** `thumbnail` is a separately-sized src for the Thumbnails plugin
   * strip; without it, the plugin falls back to rendering the full-size
   * `src` at thumbnail dimensions, unoptimized. Callers building this array
   * should set src to IMG_LIGHTBOX and thumbnail to IMG_THUMB (see '@/lib/images'). */
  slides: { src: string; alt?: string; thumbnail?: string }[]
  index: number
  open: boolean
  onClose: () => void
  onIndexChange?: (i: number) => void
}) {
  if (!open) return null
  return (
    <Lightbox
      open={open}
      close={onClose}
      index={index}
      slides={slides}
      plugins={[ZoomPlugin, ThumbnailsPlugin]}
      carousel={{ finite: slides.length <= 1 }}
      on={{ view: ({ index: i }) => onIndexChange?.(i) }}
      controller={{ closeOnBackdropClick: true }}
      styles={{ container: { backgroundColor: 'rgba(0, 0, 0, 0.92)' } }}
    />
  )
}
