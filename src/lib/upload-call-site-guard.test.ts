import { readFileSync } from 'fs'
import { join } from 'path'
import { findOffendersInSource, scanUploadCallSites } from './upload-call-site-guard'

describe('findOffendersInSource (pure: fixture strings, no filesystem)', () => {
  it('flags a .upload( call that does not reference UPLOAD_FILE_OPTIONS', () => {
    const source = `await supabase.storage.from('x').upload(path, file, { cacheControl: '3600' })`
    const offenders = findOffendersInSource('fixture.ts', source)
    expect(offenders).toHaveLength(1)
    expect(offenders[0].file).toBe('fixture.ts')
    expect(offenders[0].snippet).toContain('.upload(')
  })

  it('flags a .uploadToSignedUrl( call with no fileOptions argument at all', () => {
    const source = `await supabase.storage.from('x').uploadToSignedUrl(path, token, file)`
    const offenders = findOffendersInSource('fixture.ts', source)
    expect(offenders).toHaveLength(1)
  })

  it('passes a .uploadToSignedUrl( call that passes UPLOAD_FILE_OPTIONS directly', () => {
    const source = `await supabase.storage.from('x').uploadToSignedUrl(path, token, file, UPLOAD_FILE_OPTIONS)`
    expect(findOffendersInSource('fixture.ts', source)).toEqual([])
  })

  it('passes a .upload( call that spreads UPLOAD_FILE_OPTIONS inside an object literal', () => {
    const source = `await supabase.storage.from('x').upload(path, file, { ...UPLOAD_FILE_OPTIONS, upsert: true })`
    expect(findOffendersInSource('fixture.ts', source)).toEqual([])
  })

  it('ignores a comment that mentions .upload() with no real arguments', () => {
    const source = `// falls back to the SDK's default the way .upload() does.`
    expect(findOffendersInSource('fixture.ts', source)).toEqual([])
  })

  it('reports the correct 1-based line number for an offender past line 1', () => {
    const source = ['const a = 1', 'const b = 2', `x.upload(path, file, {})`].join('\n')
    const offenders = findOffendersInSource('fixture.ts', source)
    expect(offenders).toHaveLength(1)
    expect(offenders[0].line).toBe(3)
  })

  it('flags every non-compliant call site in a file with more than one', () => {
    const source = [
      `a.upload(p1, f1, {})`,
      `b.uploadToSignedUrl(p2, t2, f2, UPLOAD_FILE_OPTIONS)`, // compliant
      `c.upload(p3, f3, { upsert: true })`,
    ].join('\n')
    const offenders = findOffendersInSource('fixture.ts', source)
    expect(offenders).toHaveLength(2)
    expect(offenders.map((o) => o.line)).toEqual([1, 3])
  })
})

describe('scanUploadCallSites (walks the real filesystem)', () => {
  it('skips *.test.ts/*.test.tsx files', () => {
    const offenders = scanUploadCallSites(join(process.cwd(), 'src', 'lib'))
    expect(offenders.some((o) => o.file.endsWith('upload-call-site-guard.test.ts'))).toBe(false)
  })

  it('the real src/ tree has zero offenders', () => {
    const offenders = scanUploadCallSites(join(process.cwd(), 'src'))
    if (offenders.length > 0) {
      const report = offenders.map((o) => `${o.file}:${o.line}  ${o.snippet}`).join('\n')
      throw new Error(`upload call site(s) missing UPLOAD_FILE_OPTIONS:\n${report}`)
    }
    expect(offenders).toEqual([])
  })

  it('flags each real call-site file once UPLOAD_FILE_OPTIONS is removed from it', () => {
    const knownCallSiteFiles = [
      'src/app/[locale]/h/[id]/page.tsx',
      'src/app/admin/houses/[id]/page.tsx',
      'src/app/admin/quick-add/page.tsx',
      'src/lib/approval.ts',
    ]
    for (const relPath of knownCallSiteFiles) {
      const source = readFileSync(join(process.cwd(), relPath), 'utf8')
      expect(findOffendersInSource(relPath, source)).toEqual([])

      const stripped = source.replace(/UPLOAD_FILE_OPTIONS/g, 'BROKEN_REFERENCE')
      expect(findOffendersInSource(relPath, stripped).length).toBeGreaterThan(0)
    }
  })
})
