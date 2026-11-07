import { useEffect, useState } from 'react'

/**
 * Breakpoint gating desktop vs mobile *behaviour* on /map. The
 * gallery/sheet responsive CSS classes stay as they are; this decides which
 * components render at all (e.g. the bottom sheet must not exist in the DOM
 * on desktop).
 */
export const DESKTOP_MIN_WIDTH = 768

/**
 * Initial state is always `false` so SSR and the first client render agree
 * (this app is mobile-first); the real value is set in an effect after
 * mount, matching the readMapViewMode() pattern in mapView.ts.
 */
export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const mql = window.matchMedia(`(min-width: ${DESKTOP_MIN_WIDTH}px)`)
    setIsDesktop(mql.matches)
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  return isDesktop
}
