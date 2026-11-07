import { readFileSync } from 'fs'
import { join } from 'path'
import { findRawStorageUrlOffenders, scanForRawStorageUrls } from './raw-storage-url-guard'

const RAW_URL = 'https://example.supabase.co/storage/v1/object/public/house-images/ABC123/1.webp'

describe('findRawStorageUrlOffenders (pure: fixture strings, no filesystem)', () => {
  it('flags a raw storage URL as a hardcoded JSX src string', () => {
    const source = `<img src="${RAW_URL}" alt="" />`
    const offenders = findRawStorageUrlOffenders('fixture.tsx', source)
    expect(offenders).toHaveLength(1)
    expect(offenders[0].file).toBe('fixture.tsx')
    expect(offenders[0].snippet).toContain('src=')
  })

  it('flags a raw storage URL built via template-literal interpolation in a JSX src', () => {
    const source = '<img src={`https://example.supabase.co/storage/v1/object/public/house-images/${path}`} />'
    expect(findRawStorageUrlOffenders('fixture.tsx', source)).toHaveLength(1)
  })

  it('flags a raw storage URL as an object-literal src: property', () => {
    const source = `const slide = { src: '${RAW_URL}', thumbnail: '${RAW_URL}' }`
    const offenders = findRawStorageUrlOffenders('fixture.ts', source)
    expect(offenders).toHaveLength(1)
  })

  it('passes a src that routes through houseImage(), no raw URL text present at all', () => {
    const source = `<img src={houseImage(img.image_url, IMG_THUMB)} alt="" />`
    expect(findRawStorageUrlOffenders('fixture.tsx', source)).toEqual([])
  })

  it('passes a local/relative path src', () => {
    const source = `<img src="/default-birdhouse.svg" alt="" />`
    expect(findRawStorageUrlOffenders('fixture.tsx', source)).toEqual([])
  })

  it('does not flag a raw URL mentioned with no src token anywhere on the line (test fixture constants)', () => {
    const source = `const SUPABASE_URL = '${RAW_URL}'`
    expect(findRawStorageUrlOffenders('fixture.test.ts', source)).toEqual([])
  })

  it('does not flag a comment mentioning the URL when the line has no src token', () => {
    const source = `// e.g. ${RAW_URL} is what the optimizer wraps`
    expect(findRawStorageUrlOffenders('fixture.ts', source)).toEqual([])
  })

  it('does not flag when the URL text precedes an unrelated src= later on the same line', () => {
    const source = `// see  and every src= must go through houseImage()`
    expect(findRawStorageUrlOffenders('fixture.ts', source)).toEqual([])
  })

  it('reports the correct 1-based line number for an offender past line 1', () => {
    const source = ['const a = 1', 'const b = 2', `<img src="${RAW_URL}" />`].join('\n')
    const offenders = findRawStorageUrlOffenders('fixture.tsx', source)
    expect(offenders).toHaveLength(1)
    expect(offenders[0].line).toBe(3)
  })

  it('flags every offending line in a file with more than one', () => {
    const source = [
      `<img src="${RAW_URL}" />`,
      `<img src={houseImage(x, W)} />`, // compliant
      `<img src="${RAW_URL}" />`,
    ].join('\n')
    const offenders = findRawStorageUrlOffenders('fixture.tsx', source)
    expect(offenders).toHaveLength(2)
    expect(offenders.map((o) => o.line)).toEqual([1, 3])
  })
})

describe('scanForRawStorageUrls (walks the real filesystem)', () => {
  it('excludes src/lib/images.ts, the one module allowed to build these URLs', () => {
    const offenders = scanForRawStorageUrls(join(process.cwd(), 'src', 'lib'))
    expect(offenders.some((o) => o.file.endsWith('/lib/images.ts'))).toBe(false)
  })

  it('skips *.test.ts/*.test.tsx files', () => {
    const offenders = scanForRawStorageUrls(join(process.cwd(), 'src', 'lib'))
    expect(offenders.some((o) => o.file.endsWith('raw-storage-url-guard.test.ts'))).toBe(false)
  })

  it('the real src/ tree has zero offenders', () => {
    const offenders = scanForRawStorageUrls(join(process.cwd(), 'src'))
    if (offenders.length > 0) {
      const report = offenders.map((o) => `${o.file}:${o.line}  ${o.snippet}`).join('\n')
      throw new Error(`raw Supabase storage URL(s) used directly as src:\n${report}`)
    }
    expect(offenders).toEqual([])
  })

  it('does not flag its own source file', () => {
    const offenders = scanForRawStorageUrls(join(process.cwd(), 'src', 'lib'))
    expect(offenders.some((o) => o.file.endsWith('/lib/raw-storage-url-guard.ts'))).toBe(false)
  })

  it('flags a real component once a raw URL replaces its houseImage call', () => {
    const relPath = 'src/components/BirdhousePhoto.tsx'
    const source = readFileSync(join(process.cwd(), relPath), 'utf8')
    expect(findRawStorageUrlOffenders(relPath, source)).toEqual([])

    const regressed = source.replace(
      'src={houseImage(src, IMG_THUMB)}',
      `src="${RAW_URL}"`
    )
    expect(regressed).not.toBe(source)
    const offenders = findRawStorageUrlOffenders(relPath, regressed)
    expect(offenders.length).toBeGreaterThan(0)
  })
})
