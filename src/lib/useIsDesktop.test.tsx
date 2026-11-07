/**
 * @jest-environment jsdom
 */
import { render, renderHook, act } from '@testing-library/react'
import { useIsDesktop, DESKTOP_MIN_WIDTH } from './useIsDesktop'

function mockMatchMedia(initialMatches: boolean) {
  const listeners: Array<(e: MediaQueryListEvent) => void> = []
  let matches = initialMatches
  const mql = {
    get matches() {
      return matches
    },
    media: `(min-width: ${DESKTOP_MIN_WIDTH}px)`,
    addEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => listeners.push(cb),
    removeEventListener: (_: string, cb: (e: MediaQueryListEvent) => void) => {
      const i = listeners.indexOf(cb)
      if (i >= 0) listeners.splice(i, 1)
    },
  } as unknown as MediaQueryList
  window.matchMedia = jest.fn().mockReturnValue(mql)
  return {
    setMatches: (next: boolean) => {
      matches = next
      listeners.forEach(cb => cb({ matches: next } as MediaQueryListEvent))
    },
  }
}

describe('useIsDesktop', () => {
  it('starts false so SSR and first client render agree, even on a wide viewport', () => {
    // renderHook's act() flushes the mount effect before returning, so
    // result.current already reflects the post-effect value, so reading it
    // can't observe the pre-effect render. Log every render value from
    // inside the render body instead, which captures the initializer's
    // value (false) before the effect's setIsDesktop(true) triggers a
    // second render.
    mockMatchMedia(true)
    const renders: boolean[] = []
    function Probe() {
      renders.push(useIsDesktop())
      return null
    }
    render(<Probe />)
    expect(renders[0]).toBe(false)
    expect(renders[renders.length - 1]).toBe(true)
  })

  it('flips true after mount when the media query matches', () => {
    mockMatchMedia(true)
    const { result } = renderHook(() => useIsDesktop())
    // The effect runs synchronously within renderHook's act(); state settles by
    // the time we read it back.
    expect(result.current).toBe(true)
  })

  it('reacts to a later viewport change', () => {
    const { setMatches } = mockMatchMedia(false)
    const { result } = renderHook(() => useIsDesktop())
    expect(result.current).toBe(false)
    act(() => setMatches(true))
    expect(result.current).toBe(true)
  })
})
