// Static guardrail gate: `npm run check`.
//
// Fast, no network, no runtime env. Schema and contract checks:
//   1. i18n locale parity (a key in en.json missing from a target locale)
//   2. migration filename convention (<timestamp>_snake_case.sql, unique timestamps)
//   3. SQL/TS locale agreement (the enqueue trigger's locale array)
//   4. raw Supabase storage URLs used directly as a src
//
// Exits non-zero on any blocking failure so it can gate commits and CI.

import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'
import { checkAllLocales, hasBlockingIssues, validateShapes, TARGET_LOCALES } from '../src/lib/messages-parity'
import { LOCALES } from '../src/i18n/locales'
import { scanForRawStorageUrls } from '../src/lib/raw-storage-url-guard'

type Finding = { level: 'error' | 'warn'; message: string }
type CheckResult = { name: string; status: 'pass' | 'warn' | 'fail'; findings: Finding[] }

const checks: CheckResult[] = []
const MIGRATIONS_DIR = join(process.cwd(), 'supabase', 'migrations')

// 1. i18n locale parity + shape ------------------------------------------------
console.log('i18n message files')
{
  const findings: Finding[] = []
  for (const e of validateShapes()) findings.push({ level: 'error', message: `${e.locale}.json invalid shape: ${e.error}` })
  const reports = checkAllLocales()
  for (const r of reports) {
    if (r.missing.length) findings.push({ level: 'error', message: `${r.locale}: missing key(s): ${r.missing.join(', ')}` })
    if (r.extra.length) findings.push({ level: 'error', message: `${r.locale}: key(s) not in en.json: ${r.extra.join(', ')}` })
    if (r.emptyLeaves.length) findings.push({ level: 'error', message: `${r.locale}: empty string(s): ${r.emptyLeaves.join(', ')}` })
    if (r.untranslated.length) findings.push({ level: 'warn', message: `${r.locale}: ${r.untranslated.length} string(s) identical to English` })
  }
  const errors = findings.filter((f) => f.level === 'error')
  const warns = findings.filter((f) => f.level === 'warn')
  for (const e of errors) console.error(`  FAIL ${e.message}`)
  for (const w of warns) console.warn(`  WARN ${w.message.slice(0, 120)}`)
  if (errors.length === 0) console.log(`  ok   parity en <-> ${TARGET_LOCALES.join(', ')}`)
  if (hasBlockingIssues(reports) && errors.length === 0) errors.push({ level: 'error', message: 'blocking parity issue' })
  checks.push({ name: 'i18n-parity', status: errors.length ? 'fail' : warns.length ? 'warn' : 'pass', findings })
}

// 2. migration filename convention --------------------------------------------
console.log('migrations')
{
  const findings: Finding[] = []
  const NAME = /^(\d{14,15})_[a-z0-9]+(?:_[a-z0-9]+)*\.sql$/
  const numbered = readdirSync(MIGRATIONS_DIR).filter((f) => /^\d/.test(f) && f.endsWith('.sql'))
  const seen = new Map<string, string>()
  for (const f of numbered.sort()) {
    const m = NAME.exec(f)
    if (!m) { findings.push({ level: 'error', message: `"${f}" must match <timestamp>_snake_case.sql` }); continue }
    if (seen.has(m[1])) findings.push({ level: 'error', message: `migration timestamp ${m[1]} duplicated: ${seen.get(m[1])} & ${f}` })
    else seen.set(m[1], f)
  }
  for (const e of findings) console.error(`  FAIL ${e.message}`)
  if (findings.length === 0) console.log(`  ok   ${numbered.length} migrations follow <timestamp>_snake_case.sql`)
  checks.push({ name: 'migration-naming', status: findings.length ? 'fail' : 'pass', findings })
}

// 3. SQL/TS locale agreement --------------------------------------------------
// The enqueue trigger's plpgsql locale array cannot import src/i18n/locales.ts,
// so the two are asserted equal here.
console.log('locale lists (TS <-> SQL)')
{
  const findings: Finding[] = []
  const migDir = MIGRATIONS_DIR
  const triggerFiles = readdirSync(migDir)
    .filter((f) => /^\d+_.*\.sql$/.test(f) && readFileSync(join(migDir, f), 'utf8').includes('all_locales TEXT[]'))
    .sort()
  const latest = triggerFiles.at(-1)
  if (!latest) {
    findings.push({ level: 'error', message: 'no migration defines all_locales, so SQL/TS locale agreement cannot be verified' })
  } else {
    const sql = readFileSync(join(migDir, latest), 'utf8')
    const m = /all_locales TEXT\[\]\s*:=\s*ARRAY\[([^\]]+)\]/.exec(sql)
    if (!m) {
      findings.push({ level: 'error', message: `${latest}: could not parse all_locales array` })
    } else {
      const sqlLocales = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]).sort()
      const tsLocales = [...LOCALES].sort()
      if (JSON.stringify(sqlLocales) !== JSON.stringify(tsLocales)) {
        findings.push({
          level: 'error',
          message: `${latest} all_locales [${sqlLocales}] != src/i18n/locales.ts LOCALES [${tsLocales}]`,
        })
      }
    }
  }
  for (const e of findings) console.error(`  FAIL ${e.message}`)
  if (findings.length === 0) console.log(`  ok   ${latest} trigger locales match src/i18n/locales.ts`)
  checks.push({ name: 'locale-sql-parity', status: findings.length ? 'fail' : 'pass', findings })
}

// 4. raw Supabase storage URLs used directly as a src -------------------------
// Every remote photo must be routed through ppImage() (src/lib/images.ts).
console.log('raw storage URL usage')
{
  const findings: Finding[] = []
  const offenders = scanForRawStorageUrls(join(process.cwd(), 'src'))
  for (const o of offenders) {
    findings.push({
      level: 'error',
      message: `${o.file}:${o.line}: raw Supabase storage URL used directly as a src; route it through ppImage() instead: ${o.snippet}`,
    })
  }
  for (const e of findings) console.error(`  FAIL ${e.message}`)
  if (findings.length === 0) console.log('  ok   no raw Supabase storage URLs used directly as a src outside images.ts')
  checks.push({ name: 'raw-storage-url', status: findings.length ? 'fail' : 'pass', findings })
}

const failed = checks.some((c) => c.status === 'fail')
console.log('')
if (failed) {
  console.error('FAIL guardrail check failed')
  process.exit(1)
}
console.log('ok   all guardrail checks passed')
