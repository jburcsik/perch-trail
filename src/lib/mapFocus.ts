/**
 * Pure offset math for MapCenterer. When page chrome (the Map/List
 * pill above, the bottom sheet below) obscures part of the map viewport, the
 * focused house should land in the centre of the band left CLEAR by that
 * chrome, not the centre of the whole container; otherwise the sheet covers
 * the exact house it just opened for.
 *
 * Returns the vertical pixel offset to add to the projected point before
 * unprojecting back to a LatLng: 0 when there's no obstruction, positive when
 * a bottom sheet (or other bottom chrome) is present.
 */
export function focusOffsetY(containerHeight: number, top: number, bottom: number): number {
  const bandCentre = (top + (containerHeight - bottom)) / 2
  return containerHeight / 2 - bandCentre
}
