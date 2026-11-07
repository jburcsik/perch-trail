/**
 * @jest-environment node
 */
import { findStaticImportChain, resolveSpecifier, staticImportSpecifiers, stripComments } from './static-import-graph'

describe('staticImportSpecifiers (pure: fixture strings, no filesystem)', () => {
  it('collects a default, a named and a side-effect import', () => {
    const source = [
      `import sharp from 'sharp'`,
      `import { a, b } from './pair'`,
      `import './side-effect'`,
    ].join('\n')
    expect(staticImportSpecifiers(source)).toEqual(['sharp', './pair', './side-effect'])
  })

  it('collects a specifier split across several lines', () => {
    const source = ['import {', '  first,', '  second,', "} from './wide'"].join('\n')
    expect(staticImportSpecifiers(source)).toEqual(['./wide'])
  })

  it('collects a re-export', () => {
    expect(staticImportSpecifiers(`export { X } from './y'`)).toEqual(['./y'])
    expect(staticImportSpecifiers(`export * from './z'`)).toEqual(['./z'])
  })

  it('ignores a dynamic import, which loads at call time and is catchable', () => {
    const source = `async function f() {\n  const { g } = await import('./lazy')\n  return g\n}`
    expect(staticImportSpecifiers(source)).toEqual([])
  })

  it('ignores a type-only import, erased at compile time and never loaded', () => {
    expect(staticImportSpecifiers(`import type { T } from './types'`)).toEqual([])
    expect(staticImportSpecifiers(`export type { T } from './types'`)).toEqual([])
  })

  it('ignores an import named only inside a comment', () => {
    const source = [`// import sharp from 'sharp'`, `/* import x from './x' */`, `import { ok } from './ok'`].join('\n')
    expect(staticImportSpecifiers(source)).toEqual(['./ok'])
  })

  it('does not mistake an exported declaration for a module statement', () => {
    const source = [`export function build() {`, `  return "from 'nowhere'"`, `}`, `import { real } from './real'`].join('\n')
    expect(staticImportSpecifiers(source)).toEqual(['./real'])
  })

  it('de-duplicates a module imported twice', () => {
    const source = [`import { a } from './same'`, `import { b } from './same'`].join('\n')
    expect(staticImportSpecifiers(source)).toEqual(['./same'])
  })
})

describe('stripComments', () => {
  it('removes block and whole-line comments but keeps code', () => {
    expect(stripComments(`/* gone */\n// gone\nconst kept = 1`).trim()).toBe('const kept = 1')
  })
})

describe('resolveSpecifier (walks the real filesystem)', () => {
  it('resolves an @/ alias to a file under src/', () => {
    expect(resolveSpecifier('src/app/api/health/route.ts', '@/lib/supabase-admin'))
      .toBe('src/lib/supabase-admin.ts')
  })

  it('resolves a relative specifier', () => {
    expect(resolveSpecifier('src/lib/approval.ts', './email')).toBe('src/lib/email.ts')
  })

  it('returns null for a bare package, since there is nothing local to walk into', () => {
    expect(resolveSpecifier('src/lib/approval.ts', '@supabase/supabase-js')).toBeNull()
    expect(resolveSpecifier('src/lib/image-compression-server.ts', 'sharp')).toBeNull()
  })

  it('returns null for a relative path that does not exist', () => {
    expect(resolveSpecifier('src/lib/approval.ts', './nope-not-a-module')).toBeNull()
  })
})

describe('findStaticImportChain', () => {
  it('finds sharp from the module that really does import it', () => {
    expect(findStaticImportChain('src/lib/image-compression-server.ts', 'sharp'))
      .toEqual(['src/lib/image-compression-server.ts'])
  })

  it('returns null when nothing in the graph imports the package', () => {
    expect(findStaticImportChain('src/lib/image-upload-contract.ts', 'sharp')).toBeNull()
  })
})

// Routes that never touch an image must not reach sharp through a static import.
describe('routes that never touch an image must not load sharp', () => {
  const ROUTES = [
    'src/app/api/admin/inquiries/[id]/send-welcome/route.ts',
    'src/app/api/admin/markers/[id]/promote/route.ts',
    'src/app/api/health/route.ts',
  ]

  it.each(ROUTES)('%s does not statically import sharp', (route) => {
    const chain = findStaticImportChain(route, 'sharp')
    expect(chain === null ? null : chain.join(' -> ')).toBeNull()
  })
})

// The one route that needs sharp loads it lazily, so a missing binary fails only the photo step.
describe('the route that does need sharp still loads it lazily', () => {
  it('src/app/api/admin/requests/[id]/route.ts does not statically import sharp', () => {
    const chain = findStaticImportChain('src/app/api/admin/requests/[id]/route.ts', 'sharp')
    expect(chain === null ? null : chain.join(' -> ')).toBeNull()
  })
})
