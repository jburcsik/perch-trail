/**
 * Admin allowlist from the comma-separated ADMIN_EMAILS env var. An empty
 * allowlist admits nobody, so a deploy without the variable has no admin.
 * Dependency-free so middleware and route handlers share one rule.
 */
export function isAllowedAdminEmail(email: string | null | undefined): boolean {
  const allowlist = (process.env.ADMIN_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
  if (allowlist.length === 0) return false
  return allowlist.includes((email ?? '').toLowerCase())
}
