// Street-dot helpers.

import { houseImage, IMG_MARKER } from './images'

/**
 * Next free "Dot NNN" number: max existing + 1, so renamed or removed dots
 * never cause a collision and numbering keeps climbing.
 */
export function nextDotNumber(labels: string[]): number {
  let max = 0
  for (const l of labels) {
    const m = /^Dot (\d+)$/.exec(l.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

/** Default label for a freshly dropped dot: "Dot 041" style. */
export function nextDotLabel(labels: string[]): string {
  return `Dot ${String(nextDotNumber(labels)).padStart(3, '0')}`
}

/** Loose client-side coordinate sanity check (server trusts RLS + NOT NULL). */
export function isValidLatLng(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Next number for an admin naming pattern containing `{n}` (e.g.
 * "East Side {n}"): max over labels matching the pattern, plus one.
 * A pattern without `{n}` gets one appended ("Tree" becomes "Tree {n}").
 */
export function nextPatternNumber(pattern: string, labels: string[]): number {
  const p = pattern.includes('{n}') ? pattern : `${pattern.trim()} {n}`
  const [before, after] = p.split('{n}')
  const re = new RegExp(`^${escapeRegExp(before)}(\\d+)${escapeRegExp(after ?? '')}$`)
  let max = 0
  for (const l of labels) {
    const m = re.exec(l.trim())
    if (m) max = Math.max(max, parseInt(m[1], 10))
  }
  return max + 1
}

/** Build the next label for a pattern, zero-padding the number to 3 digits. */
export function labelFromPattern(pattern: string, labels: string[]): string {
  const p = pattern.includes('{n}') ? pattern : `${pattern.trim()} {n}`
  const n = String(nextPatternNumber(pattern, labels)).padStart(3, '0')
  return p.replace('{n}', n)
}

// Photo marker HTML lives here, with no Leaflet import, so it is unit-testable.

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;')
}

/** Diameter in px of a circular photo marker; Map.tsx sizes its divIcon from this. */
export const PHOTO_MARKER_SIZE = 46

/** Inner HTML for a circular photo marker, with the image at IMG_MARKER width. */
export function photoMarkerHtml(imageUrl: string, highlighted: boolean): string {
  const size = PHOTO_MARKER_SIZE
  const shadow = highlighted
    ? '0 0 0 4px rgba(217,119,6,0.55), 0 4px 16px rgba(0,0,0,0.4)'
    : '0 2px 8px rgba(0,0,0,0.3)'
  const scale = highlighted ? 1.18 : 1
  const src = houseImage(imageUrl, IMG_MARKER)

  return `<div style="width:${size}px;height:${size}px;border-radius:50%;border:2.5px solid #ffffff;overflow:hidden;box-shadow:${shadow};transform:scale(${scale});transition:transform 0.15s ease,box-shadow 0.15s ease">
      <img src="${escapeHtml(src)}" style="width:100%;height:100%;object-fit:cover;display:block" />
    </div>`
}
