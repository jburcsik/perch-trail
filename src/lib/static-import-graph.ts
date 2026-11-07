// Static import-graph guard. A route handler's whole module graph loads before
// its own code runs, so one native-binary package (sharp) reached by a static
// import can fail the route at import time. The rule: a route reaches such a
// package only through a dynamic `await import()` inside the function that
// needs it. Regex over source text, like the other guards.

import { existsSync, readFileSync } from 'fs'
import { dirname, join, relative } from 'path'

const ROOT = process.cwd()

const RESOLVE_SUFFIXES = ['', '.ts', '.tsx', '.js', '.mjs', '/index.ts', '/index.tsx']

/** Strip block and line comments so prose mentioning an import isn't scanned. */
export function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '')
}

// Only these shapes can carry a module specifier. `export const`/`function`/
// `class` never do, and excluding them keeps the brace-continuation below from
// swallowing a whole function body looking for a `from` clause.
const STATEMENT_START = /^[ \t]*(?:import\b|export\s*(?:\*|\{|type\b))/

/**
 * Module specifiers a file pulls in AT LOAD TIME.
 *
 * Deliberately excludes `await import()` (deferred to call time, and catchable)
 * and `import type` (erased by the compiler, never loaded at runtime). Those
 * are exactly the two escape hatches this guard is meant to permit.
 */
export function staticImportSpecifiers(source: string): string[] {
  const specs: string[] = []
  let buf: string | null = null

  for (const line of stripComments(source).split('\n')) {
    if (buf === null) {
      if (!STATEMENT_START.test(line)) continue
      buf = line.trim()
    } else {
      buf = `${buf} ${line.trim()}`
    }

    const from = buf.match(/\bfrom\s*['"]([^'"]+)['"]/) ?? buf.match(/^import\s*['"]([^'"]+)['"]/)
    if (from) {
      if (!/^(?:import|export)\s+type\b/.test(buf)) specs.push(from[1])
      buf = null
      continue
    }

    // No specifier yet: keep buffering only while a `{ ... }` clause is open.
    const open = (buf.match(/\{/g)?.length ?? 0) - (buf.match(/\}/g)?.length ?? 0)
    if (open <= 0) buf = null
  }

  return [...new Set(specs)]
}

/**
 * Resolve a specifier to a repo-relative source file, or null when it is a bare
 * package (nothing to walk into) or resolves outside the repo.
 */
export function resolveSpecifier(fromFile: string, spec: string): string | null {
  let base: string
  if (spec.startsWith('@/')) base = join(ROOT, 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = join(ROOT, dirname(fromFile), spec)
  else return null

  for (const suffix of RESOLVE_SUFFIXES) {
    const candidate = `${base}${suffix}`
    if (suffix !== '' || /\.[jt]sx?$/.test(base)) {
      if (existsSync(candidate) && !existsSync(join(candidate, 'package.json'))) {
        return relative(ROOT, candidate)
      }
    }
  }
  return null
}

/**
 * Walk the static import graph from `entry`; return the chain of repo-relative
 * files ending at the module that statically imports `pkg`, or null if nothing
 * in the graph does.
 */
export function findStaticImportChain(entry: string, pkg: string): string[] | null {
  const seen = new Set<string>()
  const queue: string[][] = [[entry]]

  while (queue.length > 0) {
    const chain = queue.shift()!
    const file = chain[chain.length - 1]
    if (seen.has(file)) continue
    seen.add(file)

    const abs = join(ROOT, file)
    if (!existsSync(abs)) continue

    for (const spec of staticImportSpecifiers(readFileSync(abs, 'utf8'))) {
      if (spec === pkg || spec.startsWith(`${pkg}/`)) return chain
      const resolved = resolveSpecifier(file, spec)
      if (resolved && !seen.has(resolved)) queue.push([...chain, resolved])
    }
  }

  return null
}
