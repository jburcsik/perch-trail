import { focusOffsetY } from './mapFocus'

describe('focusOffsetY', () => {
  it('is 0 when there are no insets (band == whole container)', () => {
    expect(focusOffsetY(700, 0, 0)).toBe(0)
  })

  it('is positive when a bottom sheet is present (marker moves up, toward negative screen y)', () => {
    // A positive offset added to the projected point during unproject moves the
    // target point down the projection, which is what pushes the visual marker
    // up the screen once the map re-centres; see the worked case below.
    expect(focusOffsetY(700, 0, 490)).toBeGreaterThan(0)
  })

  it('matches the worked example: containerHeight 700, top 56, bottom 490 -> 217', () => {
    expect(focusOffsetY(700, 56, 490)).toBe(217)
  })
})
