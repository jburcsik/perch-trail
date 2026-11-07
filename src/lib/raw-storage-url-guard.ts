// Source guard: every remote photo must go through houseImage() (images.ts), never
// a raw Supabase storage URL. Text scan over source lines, same convention as
// upload-call-site-guard.ts: a raw storage URL is flagged only when it follows a
// `src=` or `src:` token on the same line. Test files are skipped because their
// fixtures pair the two on purpose.

import { readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'

export interface RawStorageUrlOffender {
  file: string
  line: number
  snippet: string
}

// Any Supabase project's public storage path, matching the remotePattern in next.config.ts.
const RAW_STORAGE_URL_RE = /https?:\/\/[a-z0-9-]+\.supabase\.co\/storage\/v1\/object\/public\/\S*/i

// A JSX attribute (`src=`) or object property (`src:`).
const SRC_TOKEN_RE = /\bsrc\s*[:=]/i

const EXCLUDED_SUFFIX = '/lib/images.ts' // the one module allowed to build these URLs

/** Lines where a raw storage URL follows a src token. Pure; `file` only labels the result. */
export function findRawStorageUrlOffenders(file: string, source: string): RawStorageUrlOffender[] {
  const offenders: RawStorageUrlOffender[] = []
  const lines = source.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const srcMatch = SRC_TOKEN_RE.exec(line)
    if (!srcMatch) continue
    const urlMatch = RAW_STORAGE_URL_RE.exec(line)
    if (!urlMatch) continue
    if (urlMatch.index < srcMatch.index) continue // URL precedes src=, an unrelated coincidence on the line
    offenders.push({ file, line: i + 1, snippet: line.trim().slice(0, 160) })
  }
  return offenders
}

/** Source files under `dir`, skipping tests and images.ts (the one allowed builder). */
function listSourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir).sort()) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...listSourceFiles(full))
      continue
    }
    if (!/\.tsx?$/.test(entry) || /\.test\.tsx?$/.test(entry)) continue
    if (full.endsWith(EXCLUDED_SUFFIX)) continue
    out.push(full)
  }
  return out
}

/** Scan `srcDir`; an empty result is compliant. Run by `npm run check`. */
export function scanForRawStorageUrls(srcDir: string): RawStorageUrlOffender[] {
  const offenders: RawStorageUrlOffender[] = []
  for (const file of listSourceFiles(srcDir)) {
    offenders.push(...findRawStorageUrlOffenders(file, readFileSync(file, 'utf8')))
  }
  return offenders
}
