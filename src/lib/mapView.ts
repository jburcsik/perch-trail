/**
 * View-mode persistence for /map. sessionStorage so it survives the
 * profile-page round trip (list, then profile, then back) but not a fresh tab.
 * Pure functions, no React, so Jest can test them directly, and the page reads
 * the stored value in an effect (not the useState initializer) so SSR and the
 * first client render still agree before the real value is applied.
 */
export type MapViewMode = 'map' | 'list'

export const MAP_VIEW_STORAGE_KEY = 'perch.mapViewMode'

/** 'map' unless storage holds exactly the literal string 'list'. Safe when
 * sessionStorage is unavailable or throws (Safari private mode, SSR). */
export function readMapViewMode(): MapViewMode {
  try {
    return sessionStorage.getItem(MAP_VIEW_STORAGE_KEY) === 'list' ? 'list' : 'map'
  } catch {
    return 'map'
  }
}

export function writeMapViewMode(mode: MapViewMode): void {
  try {
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, mode)
  } catch {
    // Safari private mode / storage disabled: view mode just won't persist.
  }
}

/**
 * List scroll persistence: the gallery panel's scrollTop, saved as the
 * user scrolls the list so returning from a profile page restores where they
 * were reading instead of jumping to the top.
 */
export const LIST_SCROLL_STORAGE_KEY = 'perch.mapListScrollTop'

/** null when absent or malformed (negative, non-numeric), distinct from a
 * genuine saved 0, so a caller can skip the restore entirely rather than
 * force-scrolling to the top when nothing was ever saved. */
export function readListScrollTop(): number | null {
  try {
    const raw = sessionStorage.getItem(LIST_SCROLL_STORAGE_KEY)
    if (raw == null) return null
    const n = Number(raw)
    return Number.isFinite(n) && n >= 0 ? n : null
  } catch {
    return null
  }
}

export function writeListScrollTop(scrollTop: number): void {
  try {
    sessionStorage.setItem(LIST_SCROLL_STORAGE_KEY, String(scrollTop))
  } catch {
    // Safari private mode / storage disabled: scroll position just won't persist.
  }
}

/**
 * Map camera persistence: zoom + position, saved on every pan/zoom so
 * returning to /map restores the user's chosen view instead of resetting to
 * the trail default. Opt-in: only /map's MapComponent call passes
 * persistCamera; the profile mini-map and homepage preview never read or
 * write this key.
 */
export interface MapCamera {
  lat: number
  lng: number
  zoom: number
}

export const MAP_CAMERA_STORAGE_KEY = 'perch.mapCamera'

/** null when absent or malformed; any missing/non-finite field invalidates
 * the whole record rather than partially restoring a broken camera. */
export function readMapCamera(): MapCamera | null {
  try {
    const raw = sessionStorage.getItem(MAP_CAMERA_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      parsed &&
      typeof parsed === 'object' &&
      Number.isFinite(parsed.lat) &&
      Number.isFinite(parsed.lng) &&
      Number.isFinite(parsed.zoom)
    ) {
      return { lat: parsed.lat, lng: parsed.lng, zoom: parsed.zoom }
    }
    return null
  } catch {
    return null
  }
}

export function writeMapCamera(camera: MapCamera): void {
  try {
    sessionStorage.setItem(MAP_CAMERA_STORAGE_KEY, JSON.stringify(camera))
  } catch {
    // Safari private mode / storage disabled: camera just won't persist.
  }
}
