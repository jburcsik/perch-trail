// Walk a next-intl messages JSON file as a flat list of dotted leaf paths.
// Used by the parity check to address individual UI strings without caring
// about nesting depth.

export type MessageLeaf = { key: string; value: string }

export function walkMessages(obj: unknown, prefix = ''): MessageLeaf[] {
  const out: MessageLeaf[] = []
  if (typeof obj === 'string') {
    out.push({ key: prefix, value: obj })
    return out
  }
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const next = prefix ? `${prefix}.${k}` : k
      out.push(...walkMessages(v, next))
    }
  }
  return out
}

export function getByPath(obj: unknown, dotted: string): unknown {
  const parts = dotted.split('.')
  let cur: unknown = obj
  for (const p of parts) {
    if (!cur || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[p]
  }
  return cur
}

export function setByPath(obj: Record<string, unknown>, dotted: string, value: string): void {
  const parts = dotted.split('.')
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i]
    if (typeof cur[p] !== 'object' || cur[p] === null) cur[p] = {}
    cur = cur[p] as Record<string, unknown>
  }
  cur[parts[parts.length - 1]] = value
}
