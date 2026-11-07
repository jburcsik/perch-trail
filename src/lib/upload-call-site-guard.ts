// Source guard: every Supabase storage upload call must pass UPLOAD_FILE_OPTIONS
// (image-upload-contract.ts), so cache-control and content type never drift
// between call sites. Text scan, not an AST parse; a bare `.upload()` mention
// in prose is not a call because every real call passes a path.

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface UploadCallSite {
  file: string
  line: number
  snippet: string
}

// Method name, open paren, then a real argument character.
const CALL_START_RE = /\.(?:upload|uploadToSignedUrl)\(\s*[^\s)]/g

const REQUIRED_REFERENCE = 'UPLOAD_FILE_OPTIONS'

// Stops an unbalanced file from scanning forever.
const MAX_ARGS_SCAN = 2000

/** Extract the substring between the call's opening '(' (at `openParenIndex`)
 * and its matching close paren, by tracking paren depth. */
function extractCallArgs(source: string, openParenIndex: number): string {
  let depth = 0
  const end = Math.min(source.length, openParenIndex + MAX_ARGS_SCAN)
  for (let i = openParenIndex; i < end; i++) {
    if (source[i] === '(') depth++
    else if (source[i] === ')') {
      depth--
      if (depth === 0) return source.slice(openParenIndex + 1, i)
    }
  }
  return source.slice(openParenIndex + 1, end) // unbalanced within the cap: scan what we have
}

/** Upload calls in `source` whose arguments do not reference UPLOAD_FILE_OPTIONS. Pure. */
export function findOffendersInSource(file: string, source: string): UploadCallSite[] {
  const offenders: UploadCallSite[] = []
  for (const match of source.matchAll(CALL_START_RE)) {
    const openParenIndex = match.index + match[0].indexOf('(')
    const args = extractCallArgs(source, openParenIndex)
    if (args.includes(REQUIRED_REFERENCE)) continue

    const line = source.slice(0, match.index).split('\n').length
    const snippet = source.slice(match.index, match.index + 80).split('\n')[0].trim()
    offenders.push({ file, line, snippet })
  }
  return offenders
}

/** Recursively list .ts/.tsx source files under `dir`, skipping *.test.*. */
function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
      continue
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
    out.push(full)
  }
  return out
}

/** Scan `srcDir`; an empty result is compliant. Run by upload-call-site-guard.test.ts. */
export function scanUploadCallSites(srcDir: string): UploadCallSite[] {
  const offenders: UploadCallSite[] = []
  for (const file of listSourceFiles(srcDir)) {
    offenders.push(...findOffendersInSource(file, readFileSync(file, 'utf8')))
  }
  return offenders
}
