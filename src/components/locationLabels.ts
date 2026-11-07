// Labels for LocationPicker, kept in a leaflet-free module so non-map code
// (the admin editors) can import the English constant without pulling Leaflet
// into SSR. The steward page builds its own labels from next-intl instead.

export interface LocationPickerLabels {
  useCurrentLocation: string
  clearLocation: string
  successMessage: string
  dragQuestion: string
  yes: string
  no: string
  clearTitle: string
  clearBody: string
  clearConfirm: string
  cancel: string
  geoUnsupported: string
  geoFailed: string
  saveFailed: string
}

/** Hardcoded-English labels for the admin editors (which don't use next-intl). */
export const EN_LOCATION_LABELS: LocationPickerLabels = {
  useCurrentLocation: 'Use my current location',
  clearLocation: 'Clear location',
  successMessage: 'Awesome, your birdhouse is on the map.',
  dragQuestion: 'Did you mean to change the location of your birdhouse?',
  yes: 'Yes',
  no: 'No',
  clearTitle: 'Clear location?',
  clearBody: 'This removes your birdhouse from the map until you set a location again.',
  clearConfirm: 'Clear location',
  cancel: 'Cancel',
  geoUnsupported: 'Geolocation is not supported',
  geoFailed: 'Failed to get location',
  saveFailed: "Couldn't save the location. Please try again.",
}
