import {
  readMapViewMode,
  writeMapViewMode,
  MAP_VIEW_STORAGE_KEY,
  readListScrollTop,
  writeListScrollTop,
  LIST_SCROLL_STORAGE_KEY,
  readMapCamera,
  writeMapCamera,
  MAP_CAMERA_STORAGE_KEY,
} from './mapView'

describe('mapView', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a written value', () => {
    writeMapViewMode('list')
    expect(readMapViewMode()).toBe('list')
    expect(sessionStorage.getItem(MAP_VIEW_STORAGE_KEY)).toBe('list')
  })

  it('defaults to map when storage is empty', () => {
    expect(readMapViewMode()).toBe('map')
  })

  it('treats any value other than the literal "list" as map', () => {
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, 'bogus')
    expect(readMapViewMode()).toBe('map')
    sessionStorage.setItem(MAP_VIEW_STORAGE_KEY, 'List') // wrong case
    expect(readMapViewMode()).toBe('map')
  })

  it('does not throw when sessionStorage.getItem throws (Safari private mode)', () => {
    const spy = jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => readMapViewMode()).not.toThrow()
    expect(readMapViewMode()).toBe('map')
    spy.mockRestore()
  })

  it('does not throw when sessionStorage.setItem throws', () => {
    const original = window.sessionStorage.setItem
    window.sessionStorage.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => writeMapViewMode('list')).not.toThrow()
    window.sessionStorage.setItem = original
  })
})

describe('list scroll persistence', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a written value', () => {
    writeListScrollTop(420)
    expect(readListScrollTop()).toBe(420)
    expect(sessionStorage.getItem(LIST_SCROLL_STORAGE_KEY)).toBe('420')
  })

  it('round-trips zero (not confused with "absent")', () => {
    writeListScrollTop(0)
    expect(readListScrollTop()).toBe(0)
  })

  it('falls back to null when absent', () => {
    expect(readListScrollTop()).toBeNull()
  })

  it('falls back to null for malformed values', () => {
    sessionStorage.setItem(LIST_SCROLL_STORAGE_KEY, 'not-a-number')
    expect(readListScrollTop()).toBeNull()
    sessionStorage.setItem(LIST_SCROLL_STORAGE_KEY, '-5')
    expect(readListScrollTop()).toBeNull()
  })

  it('does not throw when sessionStorage access throws', () => {
    const spy = jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => readListScrollTop()).not.toThrow()
    expect(readListScrollTop()).toBeNull()
    spy.mockRestore()

    const original = window.sessionStorage.setItem
    window.sessionStorage.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => writeListScrollTop(10)).not.toThrow()
    window.sessionStorage.setItem = original
  })
})

describe('map camera persistence', () => {
  afterEach(() => {
    sessionStorage.clear()
  })

  it('round-trips a written camera', () => {
    const camera = { lat: 40.7812, lng: -73.9665, zoom: 18 }
    writeMapCamera(camera)
    expect(readMapCamera()).toEqual(camera)
    expect(sessionStorage.getItem(MAP_CAMERA_STORAGE_KEY)).toBe(JSON.stringify(camera))
  })

  it('falls back to null when absent', () => {
    expect(readMapCamera()).toBeNull()
  })

  it('falls back to null for malformed JSON', () => {
    sessionStorage.setItem(MAP_CAMERA_STORAGE_KEY, '{not json')
    expect(readMapCamera()).toBeNull()
  })

  it('falls back to null when fields are missing or non-numeric', () => {
    sessionStorage.setItem(MAP_CAMERA_STORAGE_KEY, JSON.stringify({ lat: 40.78, lng: -73.96 })) // no zoom
    expect(readMapCamera()).toBeNull()
    sessionStorage.setItem(MAP_CAMERA_STORAGE_KEY, JSON.stringify({ lat: 'x', lng: -73.96, zoom: 18 }))
    expect(readMapCamera()).toBeNull()
    sessionStorage.setItem(MAP_CAMERA_STORAGE_KEY, '"just a string"')
    expect(readMapCamera()).toBeNull()
  })

  it('does not throw when sessionStorage access throws', () => {
    const spy = jest.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => {
      throw new Error('storage disabled')
    })
    expect(() => readMapCamera()).not.toThrow()
    expect(readMapCamera()).toBeNull()
    spy.mockRestore()

    const original = window.sessionStorage.setItem
    window.sessionStorage.setItem = () => {
      throw new Error('quota exceeded')
    }
    expect(() => writeMapCamera({ lat: 1, lng: 2, zoom: 3 })).not.toThrow()
    window.sessionStorage.setItem = original
  })
})
