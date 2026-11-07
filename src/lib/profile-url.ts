export function parseQrCodeId(profileUrl: string): string | null {
  try {
    const u = new URL(profileUrl)
    const match = u.pathname.match(/\/h\/([A-Z0-9]{1,5})/i)
    if (!match) return null
    return match[1].toUpperCase()
  } catch {
    return null
  }
}
