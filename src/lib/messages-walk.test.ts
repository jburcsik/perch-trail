/**
 * @jest-environment node
 */
import { walkMessages, getByPath, setByPath } from './messages-walk'

describe('walkMessages', () => {
  it('flattens nested objects to dotted paths', () => {
    const result = walkMessages({ home: { title: 'Hi', sub: { a: 'b' } }, footer: 'c' })
    expect(result).toEqual([
      { key: 'home.title', value: 'Hi' },
      { key: 'home.sub.a', value: 'b' },
      { key: 'footer', value: 'c' },
    ])
  })

  it('skips non-string leaves silently', () => {
    const result = walkMessages({ a: 'x', b: 5, c: null })
    expect(result).toEqual([{ key: 'a', value: 'x' }])
  })
})

describe('getByPath', () => {
  it('reads nested values', () => {
    expect(getByPath({ a: { b: { c: 'hi' } } }, 'a.b.c')).toBe('hi')
  })
  it('returns undefined when missing', () => {
    expect(getByPath({ a: 1 }, 'b.c')).toBeUndefined()
  })
})

describe('setByPath', () => {
  it('creates nested structure', () => {
    const o: Record<string, unknown> = {}
    setByPath(o, 'a.b.c', 'hi')
    expect(o).toEqual({ a: { b: { c: 'hi' } } })
  })
  it('overwrites existing values', () => {
    const o: Record<string, unknown> = { a: { b: 'old' } }
    setByPath(o, 'a.b', 'new')
    expect(o).toEqual({ a: { b: 'new' } })
  })
})
